import hmac

import pytest

from backend.api import ApiError, require_bearer
from backend.config import ConfigurationError, Settings
from backend.schemas import DependencyInput, TaskInput
from backend.proposal_service import ProposalService
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
