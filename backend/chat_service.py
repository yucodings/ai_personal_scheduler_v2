from __future__ import annotations

import re
from datetime import date, datetime, timedelta, timezone
from typing import Any

from backend.ai_client import AIClient
from backend.ai_provider import SKYLER_SYSTEM_PROMPT
from backend.config import Settings, get_settings
from backend.project_service import ProjectService
from backend.proposal_service import ProposalService
from backend.retrieval_service import build_context, get_document_chunks, search_project
from backend.schemas import ProjectInput
from backend.supabase_client import SupabaseClient

CREATE_PROJECT_PATTERN = re.compile(
    r"\bcreate\s+(?:a\s+)?project(?:\s+(?:name|named|called))?\s+['\"]?(.+?)['\"]?\s*[.!?]*$",
    re.IGNORECASE,
)
APPROVAL_PATTERN = re.compile(r"^\s*(?:approve|approved|confirm)\b", re.IGNORECASE)
REJECTION_PATTERN = re.compile(r"^\s*(?:reject|cancel|do not create|don't create)\b", re.IGNORECASE)
LEGACY_CREATE_INTENT_PATTERN = re.compile(
    r"[\"']intent[\"']\s*:\s*[\"']create_project[\"']",
    re.IGNORECASE,
)
LEGACY_PROJECT_TITLE_PATTERN = re.compile(
    r"\bproject\s+(?:called|named)\s+['\"]([^'\"]{2,160})['\"]",
    re.IGNORECASE,
)


def purge_expired_chat_history(
    db: SupabaseClient,
    settings: Settings | None = None,
    now: datetime | None = None,
) -> str:
    config = settings or get_settings()
    retention_days = max(1, config.chat_retention_days)
    cutoff = (now or datetime.now(timezone.utc)) - timedelta(days=retention_days)
    cutoff_value = cutoff.isoformat()
    db.table("ai_messages", method="DELETE", params={"created_at": f"lt.{cutoff_value}"})
    db.table("ai_conversations", method="DELETE", params={"updated_at": f"lt.{cutoff_value}"})
    return cutoff_value


class ChatService:
    def __init__(
        self,
        db: SupabaseClient | None = None,
        ai: AIClient | None = None,
        settings: Settings | None = None,
    ):
        self.db = db or SupabaseClient()
        self.settings = settings or get_settings()
        self.ai = ai or AIClient(self.settings)
        self.proposals = ProposalService(self.db)
        self.projects = ProjectService(self.db)

    def chat(
        self,
        *,
        message: str,
        channel: str,
        project_id: str | None = None,
        conversation_id: str | None = None,
        document_id: str | None = None,
    ) -> dict[str, Any]:
        purge_expired_chat_history(self.db, self.settings)
        project_id = project_id or self._active_project_id()
        conversation_id = conversation_id or self._conversation(channel, project_id)
        recent = self.db.table(
            "ai_messages",
            params={
                "select": "id,role,content,structured_action_data,created_at",
                "conversation_id": f"eq.{conversation_id}",
                "order": "created_at.desc",
                "limit": 12,
            },
        ) or []
        recent.reverse()
        self._store_message(conversation_id, "user", message, channel)

        latest_action = self._latest_project_creation(recent)
        if APPROVAL_PATTERN.match(message):
            return self._approve_project_creation(
                latest_action,
                conversation_id=conversation_id,
                channel=channel,
            )
        if REJECTION_PATTERN.match(message) and latest_action and latest_action[1].get("status") == "pending":
            return self._reject_project_creation(
                latest_action,
                conversation_id=conversation_id,
                channel=channel,
                project_id=project_id,
            )

        title = self._project_title(message)
        if title:
            return self._propose_project_creation(
                title,
                conversation_id=conversation_id,
                channel=channel,
            )

        chunks = (
            get_document_chunks(project_id, document_id, client=self.db)
            if project_id and document_id
            else search_project(project_id, message, client=self.db) if project_id else []
        )
        if document_id and not chunks:
            return self._simple_reply(
                "The attached file is not ready, has no readable text, or does not belong to this project.",
                conversation_id=conversation_id,
                channel=channel,
                project_id=project_id,
            )
        context, citations = build_context(chunks, self.settings)
        messages = [
            {"role": "system", "content": SKYLER_SYSTEM_PROMPT},
            *[{"role": row["role"], "content": row["content"]} for row in recent],
            {"role": "user", "content": message},
        ]
        result = self.ai.structured_chat(messages=messages, context=context)
        envelope = result.envelope
        payload = envelope.model_dump(mode="json")
        payload["citations"] = payload.get("citations") or citations
        if envelope.proposal_required and envelope.proposal is not None:
            proposal = envelope.proposal.model_dump(mode="json")
            proposal_row = self.proposals.create(
                project_id=str(envelope.proposal.project_id),
                proposal_type=envelope.proposal.type,
                payload=proposal,
                summary=envelope.proposal.summary,
                approval_mode=self._approval_mode(),
            )
            payload["proposal_id"] = proposal_row["id"]
        self._store_message(conversation_id, "assistant", envelope.reply, channel, {"envelope": payload})
        return {
            **payload,
            "conversation_id": conversation_id,
            "project_id": project_id,
            "proposal_id": payload.get("proposal_id"),
        }

    def _propose_project_creation(
        self,
        title: str,
        *,
        conversation_id: str,
        channel: str,
    ) -> dict[str, Any]:
        action = self._project_creation_action(title)
        start = action["payload"]["start_date"]
        deadline = action["payload"]["final_deadline"]
        reply = (
            f"Proposal ready: create ‘{title}’ as an active project with medium priority, "
            f"starting {start} and a temporary deadline of {deadline}. "
            "Reply “approve” to create it, or “cancel” to discard this proposal. "
            "You can edit these defaults after creation."
        )
        payload = {
            "reply": reply,
            "intent": "general",
            "proposal_required": True,
            "proposal": None,
            "citations": [],
            "warnings": ["Project creation uses visible defaults until you edit the project."],
            "pending_action": action,
        }
        self._store_message(
            conversation_id,
            "assistant",
            reply,
            channel,
            {"envelope": payload, "pending_action": action},
        )
        return {**payload, "conversation_id": conversation_id, "project_id": None}

    def _approve_project_creation(
        self,
        latest_action: tuple[dict[str, Any], dict[str, Any]] | None,
        *,
        conversation_id: str,
        channel: str,
    ) -> dict[str, Any]:
        if not latest_action:
            return self._simple_reply(
                "There is no pending project-creation proposal to approve.",
                conversation_id=conversation_id,
                channel=channel,
            )
        source_message, action = latest_action
        if action.get("status") == "approved":
            return self._simple_reply(
                "That project-creation proposal was already approved.",
                conversation_id=conversation_id,
                channel=channel,
                project_id=str(action.get("created_project_id") or "") or None,
            )
        if action.get("status") != "pending":
            return self._simple_reply(
                "That project-creation proposal is no longer pending.",
                conversation_id=conversation_id,
                channel=channel,
            )

        project = self.projects.create(ProjectInput.model_validate(action["payload"]))
        project_id = str(project["id"])
        self.projects.update(project_id, {"is_active_context": True, "status": "active"})
        action["status"] = "approved"
        action["created_project_id"] = project_id
        self._update_action(source_message, action)
        self.db.table(
            "ai_conversations",
            method="PATCH",
            params={"id": f"eq.{conversation_id}"},
            data={"project_id": project_id, "title": f"{project['title']} conversation", "updated_at": "now()"},
        )
        reply = f"Created ‘{project['title']}’ and added it to your workspace. It is now the active project."
        payload = self._simple_reply(
            reply,
            conversation_id=conversation_id,
            channel=channel,
            project_id=project_id,
        )
        payload["workspace_changed"] = True
        payload["created_project_id"] = project_id
        return payload

    def _reject_project_creation(
        self,
        latest_action: tuple[dict[str, Any], dict[str, Any]],
        *,
        conversation_id: str,
        channel: str,
        project_id: str | None,
    ) -> dict[str, Any]:
        source_message, action = latest_action
        action["status"] = "rejected"
        self._update_action(source_message, action)
        return self._simple_reply(
            "Project creation cancelled. No workspace data was changed.",
            conversation_id=conversation_id,
            channel=channel,
            project_id=project_id,
        )

    def _simple_reply(
        self,
        reply: str,
        *,
        conversation_id: str,
        channel: str,
        project_id: str | None = None,
    ) -> dict[str, Any]:
        payload = {
            "reply": reply,
            "intent": "general",
            "proposal_required": False,
            "proposal": None,
            "citations": [],
            "warnings": [],
        }
        self._store_message(conversation_id, "assistant", reply, channel, {"envelope": payload})
        return {**payload, "conversation_id": conversation_id, "project_id": project_id}

    def _update_action(self, source_message: dict[str, Any], action: dict[str, Any]) -> None:
        structured = source_message.get("structured_action_data") or {}
        structured["pending_action"] = action
        self.db.table(
            "ai_messages",
            method="PATCH",
            params={"id": f"eq.{source_message['id']}"},
            data={"structured_action_data": structured},
        )

    @staticmethod
    def _project_title(message: str) -> str | None:
        match = CREATE_PROJECT_PATTERN.search(message.strip())
        if not match:
            return None
        title = match.group(1).strip().strip("'\"")
        return title[:160] if len(title) >= 2 else None

    def _latest_project_creation(
        self,
        recent: list[dict[str, Any]],
    ) -> tuple[dict[str, Any], dict[str, Any]] | None:
        for row in reversed(recent):
            structured = row.get("structured_action_data") or {}
            action = structured.get("pending_action") if isinstance(structured, dict) else None
            if isinstance(action, dict) and action.get("type") == "create_project":
                return row, action
            content = str(row.get("content") or "")
            if row.get("role") == "assistant" and LEGACY_CREATE_INTENT_PATTERN.search(content):
                title_match = LEGACY_PROJECT_TITLE_PATTERN.search(content)
                if title_match:
                    return row, self._project_creation_action(title_match.group(1).strip())
        return None

    @staticmethod
    def _project_creation_action(title: str) -> dict[str, Any]:
        start = date.today()
        deadline = start + timedelta(days=30)
        project = ProjectInput(
            title=title,
            project_type="other",
            description="",
            status="active",
            priority="medium",
            start_date=start,
            final_deadline=deadline,
            estimated_total_hours=0,
        )
        return {
            "type": "create_project",
            "status": "pending",
            "payload": project.model_dump(mode="json"),
        }

    def _conversation(self, channel: str, project_id: str | None) -> str:
        rows = self.db.table(
            "ai_conversations",
            params={
                "select": "id",
                "channel": f"eq.{channel}",
                "project_id": f"eq.{project_id}" if project_id else "is.null",
                "order": "updated_at.desc",
                "limit": 1,
            },
        ) or []
        if rows:
            return str(rows[0]["id"])
        created = self.db.table(
            "ai_conversations",
            method="POST",
            data={"channel": channel, "project_id": project_id, "title": "Skyler conversation"},
            prefer="return=representation",
        )
        return str(created[0]["id"])

    def _store_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        channel: str,
        structured: dict[str, Any] | None = None,
    ) -> None:
        self.db.table(
            "ai_messages",
            method="POST",
            data={
                "conversation_id": conversation_id,
                "role": role,
                "content": content,
                "structured_action_data": structured,
                "channel": channel,
            },
        )
        self.db.table(
            "ai_conversations",
            method="PATCH",
            params={"id": f"eq.{conversation_id}"},
            data={"updated_at": "now()"},
        )

    def _active_project_id(self) -> str | None:
        rows = self.db.table(
            "projects",
            params={"select": "id", "is_active_context": "eq.true", "limit": 1},
        ) or []
        return str(rows[0]["id"]) if rows else None

    def _approval_mode(self) -> str:
        rows = self.db.table(
            "app_settings",
            params={
                "select": "default_project_approval_mode",
                "id": "eq.singleton",
                "limit": 1,
            },
        ) or []
        return rows[0].get("default_project_approval_mode", "full_plan") if rows else "full_plan"
