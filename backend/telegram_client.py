from __future__ import annotations

import html
import json
from dataclasses import dataclass
from typing import Any

import requests

from backend.config import Settings, get_settings


def escape_telegram(value: str) -> str: return html.escape(value, quote=False)


@dataclass(frozen=True)
class TelegramResult:
    ok: bool; message_id: int | None = None; error: str | None = None


class TelegramClient:
    def __init__(self, settings: Settings | None = None, session: requests.Session | None = None):
        self.settings = settings or get_settings(); self.session = session or requests.Session()
    @property
    def base_url(self):
        self.settings.require("telegram")
        return f"https://api.telegram.org/bot{self.settings.telegram_bot_token}"
    def send(self, text: str, *, reply_markup: dict[str, Any] | None = None) -> TelegramResult:
        payload: dict[str, Any] = {"chat_id": self.settings.telegram_allowed_chat_id, "text": text[:4096], "parse_mode": "HTML", "disable_web_page_preview": True}
        if reply_markup: payload["reply_markup"] = reply_markup
        try:
            response = self.session.post(f"{self.base_url}/sendMessage", json=payload, timeout=20); data = response.json()
        except (requests.RequestException, json.JSONDecodeError) as exc: return TelegramResult(False, error=f"Telegram connection failed: {type(exc).__name__}")
        if not response.ok or not data.get("ok"): return TelegramResult(False, error=data.get("description", "Telegram request failed"))
        return TelegramResult(True, int(data["result"]["message_id"]))
    def answer_callback(self, callback_query_id: str, text: str = "Updated") -> bool:
        return self.session.post(f"{self.base_url}/answerCallbackQuery", json={"callback_query_id": callback_query_id, "text": text[:200]}, timeout=15).ok
    def set_webhook(self, url: str) -> dict[str, Any]:
        if not url.startswith("https://"): raise ValueError("Production webhook URL must use HTTPS")
        response = self.session.post(f"{self.base_url}/setWebhook", json={"url": url, "secret_token": self.settings.telegram_webhook_secret, "allowed_updates": ["message", "callback_query"], "drop_pending_updates": False}, timeout=20)
        return response.json()
    def webhook_info(self) -> dict[str, Any]: return self.session.get(f"{self.base_url}/getWebhookInfo", timeout=15).json()
    def test_connection(self) -> TelegramResult: return self.send("🤖 <b>Skyler is connected.</b>\nThis private progress channel is ready.")


def status_keyboard(task_id: str) -> dict[str, Any]:
    return {"inline_keyboard": [[{"text": "✅ Complete", "callback_data": f"task:complete:{task_id}"}, {"text": "◐ Partial", "callback_data": f"task:partial:{task_id}"}], [{"text": "⛔ Blocked", "callback_data": f"task:blocked:{task_id}"}, {"text": "○ Not started", "callback_data": f"task:not_started:{task_id}"}]]}


def proposal_keyboard(proposal_id: str) -> dict[str, Any]:
    return {"inline_keyboard": [[{"text": "Approve", "callback_data": f"proposal:approve:{proposal_id}"}, {"text": "Modify", "callback_data": f"proposal:modify:{proposal_id}"}, {"text": "Reject", "callback_data": f"proposal:reject:{proposal_id}"}]]}

