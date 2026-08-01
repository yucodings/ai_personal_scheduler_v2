from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone

from backend.chat_service import ChatService, purge_expired_chat_history
from backend.config import Settings


class NeverAI:
    def structured_chat(self, **_kwargs):
        raise AssertionError("Project creation should not call the AI provider")


class FakeChatDatabase:
    def __init__(self):
        self.messages = []
        self.projects = []
        self.conversations = [{
            "id": "conversation-1",
            "project_id": None,
            "title": "Skyler conversation",
            "updated_at": "2026-08-02T00:00:00+00:00",
        }]
        self.delete_calls = []
        self.next_message_id = 1

    def table(self, table, method="GET", params=None, data=None, **_kwargs):
        params = params or {}
        if method == "DELETE":
            self.delete_calls.append((table, deepcopy(params)))
            return None

        if table == "ai_messages":
            if method == "GET":
                rows = [row for row in self.messages if row["conversation_id"] == params["conversation_id"][3:]]
                return list(reversed(deepcopy(rows)))[: int(params.get("limit", 12))]
            if method == "POST":
                row = {
                    "id": f"message-{self.next_message_id}",
                    "created_at": f"2026-08-02T00:00:{self.next_message_id:02d}+00:00",
                    **deepcopy(data),
                }
                self.next_message_id += 1
                self.messages.append(row)
                return [deepcopy(row)]
            if method == "PATCH":
                message_id = params["id"][3:]
                for row in self.messages:
                    if row["id"] == message_id:
                        row.update(deepcopy(data))
                return []

        if table == "ai_conversations":
            if method == "GET":
                return [{"id": self.conversations[0]["id"]}]
            if method == "POST":
                row = {"id": "conversation-1", "updated_at": "2026-08-02T00:00:00+00:00", **deepcopy(data)}
                self.conversations = [row]
                return [deepcopy(row)]
            if method == "PATCH":
                self.conversations[0].update(deepcopy(data))
                return []

        if table == "projects":
            if method == "GET":
                if params.get("is_active_context") == "eq.true":
                    return [deepcopy(row) for row in self.projects if row.get("is_active_context")]
                return deepcopy(self.projects)
            if method == "POST":
                row = {
                    "id": "project-1",
                    "is_active_context": False,
                    **deepcopy(data),
                }
                self.projects.append(row)
                return [deepcopy(row)]
            if method == "PATCH":
                project_id = params["id"][3:]
                for row in self.projects:
                    if row["id"] == project_id:
                        row.update(deepcopy(data))
                        return [deepcopy(row)]
                return []

        if table == "app_settings":
            return [{"default_project_approval_mode": "full_plan"}]
        return []

    def rpc(self, name, payload):
        assert name == "set_active_project"
        project_id = payload["p_project_id"]
        for row in self.projects:
            row["is_active_context"] = row["id"] == project_id
        return deepcopy(next(row for row in self.projects if row["id"] == project_id))


def test_chat_project_creation_is_persisted_only_after_approval():
    database = FakeChatDatabase()
    settings = Settings(ai_provider="deepseek", chat_retention_days=7)
    service = ChatService(database, NeverAI(), settings)

    proposal = service.chat(
        message="create a project name Digital Entrepreneurship",
        channel="web",
    )

    assert proposal["proposal_required"] is True
    assert "temporary deadline" in proposal["reply"]
    assert database.projects == []

    approved = service.chat(
        message="approve",
        channel="web",
        conversation_id=proposal["conversation_id"],
    )

    assert approved["workspace_changed"] is True
    assert approved["created_project_id"] == "project-1"
    assert database.projects[0]["title"] == "Digital Entrepreneurship"
    assert database.projects[0]["is_active_context"] is True
    assert database.conversations[0]["project_id"] == "project-1"
    pending = next(
        row["structured_action_data"]["pending_action"]
        for row in database.messages
        if (row.get("structured_action_data") or {}).get("pending_action")
    )
    assert pending["status"] == "approved"


def test_chat_retention_deletes_messages_and_conversations_older_than_seven_days():
    database = FakeChatDatabase()
    cutoff = purge_expired_chat_history(
        database,
        Settings(chat_retention_days=7),
        now=datetime(2026, 8, 2, tzinfo=timezone.utc),
    )

    assert cutoff == "2026-07-26T00:00:00+00:00"
    assert database.delete_calls == [
        ("ai_messages", {"created_at": "lt.2026-07-26T00:00:00+00:00"}),
        ("ai_conversations", {"updated_at": "lt.2026-07-26T00:00:00+00:00"}),
    ]


def test_legacy_raw_deepseek_project_proposal_can_still_be_approved():
    database = FakeChatDatabase()
    database.messages.append({
        "id": "legacy-message",
        "conversation_id": "conversation-1",
        "role": "assistant",
        "content": """{"reply":"I can create a project called 'Legacy Project'.","intent":"create_project","proposal_required":true,"proposal":"Create it"}""",
        "structured_action_data": None,
        "channel": "web",
        "created_at": "2026-08-02T00:00:00+00:00",
    })
    service = ChatService(
        database,
        NeverAI(),
        Settings(ai_provider="deepseek", chat_retention_days=7),
    )

    result = service.chat(
        message="approve",
        channel="web",
        conversation_id="conversation-1",
    )

    assert result["workspace_changed"] is True
    assert database.projects[0]["title"] == "Legacy Project"
