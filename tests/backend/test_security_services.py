import hmac

import pytest

from backend.api import ApiError, describe_supabase_error, require_bearer
from backend.config import ConfigurationError, Settings
from backend.schemas import DependencyInput, TaskInput
from backend.proposal_service import ProposalService
from backend.supabase_client import SupabaseClient, SupabaseError
from backend.telegram_service import TelegramService


class FakeHandler:
    def __init__(self, authorization): self.headers = {"Authorization": authorization}


def test_cron_authentication():
    require_bearer(FakeHandler("Bearer cron-secret"), "cron-secret")
    with pytest.raises(ApiError) as error: require_bearer(FakeHandler("Bearer wrong"), "cron-secret")
    assert error.value.status == 401


def test_environment_validation_does_not_print_values():
    settings = Settings(mimo_api_key="private-key")
    with pytest.raises(ConfigurationError) as error: settings.require("supabase")
    assert "SUPABASE_URL" in str(error.value)
    assert "private-key" not in str(error.value)


def test_current_supabase_secret_key_is_not_sent_as_a_bearer_jwt():
    settings = Settings(
        supabase_url="https://example.supabase.co",
        supabase_service_role_key="sb_secret_current",
    )
    client = SupabaseClient(settings)
    assert client.headers["apikey"] == "sb_secret_current"
    assert "Authorization" not in client.headers


def test_legacy_supabase_service_role_key_keeps_bearer_header():
    settings = Settings(
        supabase_url="https://example.supabase.co",
        supabase_service_role_key="legacy.jwt.value",
    )
    client = SupabaseClient(settings)
    assert client.headers["Authorization"] == "Bearer legacy.jwt.value"


def test_supabase_failures_produce_safe_actionable_messages():
    schema_code, schema_message = describe_supabase_error(
        SupabaseError("Could not find the table public.projects in the schema cache", 404, "PGRST205")
    )
    credential_code, credential_message = describe_supabase_error(
        SupabaseError("Invalid JWT", 401, "PGRST301")
    )

    assert schema_code == "SUPABASE_SCHEMA_MISSING"
    assert "SQL migrations" in schema_message
    assert credential_code == "SUPABASE_CREDENTIALS_REJECTED"
    assert "SUPABASE_SECRET_KEY" in credential_message


def test_task_and_dependency_schema_guards():
    with pytest.raises(ValueError):
        DependencyInput(predecessor_task_id="11111111-1111-4111-8111-111111111111", dependent_task_id="11111111-1111-4111-8111-111111111111")
    with pytest.raises(ValueError, match="Blocked tasks"):
        TaskInput(project_id="11111111-1111-4111-8111-111111111111", title="Blocked task", status="blocked")


class FakeDatabase:
    def __init__(self): self.updates = set(); self.rpc_calls = []
    def table(self, table, method="GET", data=None, **kwargs):
        if table == "telegram_updates" and method == "POST":
            if data["update_id"] in self.updates: return []
            self.updates.add(data["update_id"]); return [data]
        return []
    def rpc(self, name, payload): self.rpc_calls.append((name, payload)); return {"status": "approved"}


class FakeTelegram:
    class Config: telegram_allowed_chat_id = "42"
    settings = Config()
    def __init__(self): self.sent = []
    def send(self, text, reply_markup=None):
        self.sent.append(text)
        return type("Result", (), {"ok": True})()


def test_duplicate_telegram_update_is_not_applied_twice():
    database = FakeDatabase(); telegram = FakeTelegram(); service = TelegramService(database, telegram)
    update = {"update_id": 7, "message": {"chat": {"id": 42}, "text": "/help"}}
    assert service.process_update(update)["handled"]
    assert service.process_update(update) == {"duplicate": True}
    assert len(telegram.sent) == 1


def test_proposal_approval_routes_to_transaction_rpc():
    database = FakeDatabase(); service = ProposalService(database)
    from backend.schemas import ProposalReviewRequest
    request = ProposalReviewRequest(proposal_id="11111111-1111-4111-8111-111111111111", action="approve")
    service.review(request)
    assert database.rpc_calls[0][0] == "approve_ai_proposal"
