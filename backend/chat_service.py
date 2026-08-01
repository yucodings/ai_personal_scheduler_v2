from __future__ import annotations

from typing import Any
from uuid import uuid4

from backend.ai_client import AIClient
from backend.ai_provider import SKYLER_SYSTEM_PROMPT
from backend.proposal_service import ProposalService
from backend.retrieval_service import build_context, search_project
from backend.supabase_client import SupabaseClient


class ChatService:
    def __init__(self, db: SupabaseClient | None = None, ai: AIClient | None = None):
        self.db = db or SupabaseClient(); self.ai = ai or AIClient(); self.proposals = ProposalService(self.db)

    def chat(self, *, message: str, channel: str, project_id: str | None = None, conversation_id: str | None = None) -> dict[str, Any]:
        project_id = project_id or self._active_project_id()
        conversation_id = conversation_id or self._conversation(channel, project_id)
        recent = self.db.table("ai_messages", params={"select": "role,content", "conversation_id": f"eq.{conversation_id}", "order": "created_at.desc", "limit": 12}) or []
        recent.reverse(); self._store_message(conversation_id, "user", message, channel)
        chunks = search_project(project_id, message, client=self.db) if project_id else []
        context, citations = build_context(chunks)
        messages = [{"role": "system", "content": SKYLER_SYSTEM_PROMPT}, *[{"role": row["role"], "content": row["content"]} for row in recent], {"role": "user", "content": message}]
        result = self.ai.structured_chat(messages=messages, context=context); envelope = result.envelope
        payload = envelope.model_dump(mode="json"); payload["citations"] = payload.get("citations") or citations
        proposal_id = None
        if envelope.proposal_required and envelope.proposal is not None:
            proposal = envelope.proposal.model_dump(mode="json"); proposal_id = self.proposals.create(project_id=str(envelope.proposal.project_id), proposal_type=envelope.proposal.type, payload=proposal, summary=envelope.proposal.summary, approval_mode=self._approval_mode())
            payload["proposal_id"] = proposal_id["id"]
        self._store_message(conversation_id, "assistant", envelope.reply, channel, {"envelope": payload})
        return {**payload, "conversation_id": conversation_id, "project_id": project_id, "proposal_id": payload.get("proposal_id")}

    def _conversation(self, channel: str, project_id: str | None) -> str:
        rows = self.db.table("ai_conversations", params={"select": "id", "channel": f"eq.{channel}", "project_id": f"eq.{project_id}" if project_id else "is.null", "order": "updated_at.desc", "limit": 1}) or []
        if rows: return str(rows[0]["id"])
        created = self.db.table("ai_conversations", method="POST", data={"channel": channel, "project_id": project_id, "title": "Skyler conversation"}, prefer="return=representation")
        return str(created[0]["id"])
    def _store_message(self, conversation_id: str, role: str, content: str, channel: str, structured: dict[str, Any] | None = None):
        self.db.table("ai_messages", method="POST", data={"conversation_id": conversation_id, "role": role, "content": content, "structured_action_data": structured, "channel": channel})
        self.db.table("ai_conversations", method="PATCH", params={"id": f"eq.{conversation_id}"}, data={"updated_at": "now()"})
    def _active_project_id(self) -> str | None:
        rows = self.db.table("projects", params={"select": "id", "is_active_context": "eq.true", "limit": 1}) or []
        return str(rows[0]["id"]) if rows else None
    def _approval_mode(self) -> str:
        rows = self.db.table("app_settings", params={"select": "default_project_approval_mode", "id": "eq.singleton", "limit": 1}) or []
        return rows[0].get("default_project_approval_mode", "full_plan") if rows else "full_plan"
