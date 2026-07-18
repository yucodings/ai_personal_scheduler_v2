from __future__ import annotations

import hmac
from datetime import date, timedelta
from typing import Any

from backend.chat_service import ChatService
from backend.supabase_client import SupabaseClient
from backend.task_service import TaskService
from backend.schemas import TaskProgressInput
from backend.telegram_client import TelegramClient, escape_telegram, proposal_keyboard, status_keyboard


HELP = """<b>Skyler commands</b>
/today — today’s plan
/projects — project overview
/use &lt;name&gt; — change active project
/progress — active project progress
/due — work due this week
/blocked — blocked work
/done &lt;task&gt; — complete a task
/plan — generate planning advice
/settings — current preferences

You can also write naturally: “Mark testing 50%” or “Why is my FYP at risk?”"""


class TelegramService:
    def __init__(self, db: SupabaseClient | None = None, telegram: TelegramClient | None = None): self.db = db or SupabaseClient(); self.telegram = telegram or TelegramClient(); self.chat = ChatService(self.db)
    def process_update(self, update: dict[str, Any]) -> dict[str, Any]:
        update_id = update.get("update_id")
        if update_id is None: return {"ignored": True}
        inserted = self.db.table("telegram_updates", method="POST", data={"update_id": update_id}, prefer="resolution=ignore-duplicates,return=representation") or []
        if not inserted: return {"duplicate": True}
        if update.get("callback_query"): return self._callback(update["callback_query"])
        message = update.get("message") or {}; chat_id = str((message.get("chat") or {}).get("id", ""))
        if not hmac.compare_digest(chat_id, self.telegram.settings.telegram_allowed_chat_id): return {"ignored": True}
        text = (message.get("text") or "").strip()
        if not text: return {"ignored": True}
        reply, markup = self._command(text) if text.startswith("/") else self._natural(text)
        result = self.telegram.send(reply, reply_markup=markup)
        return {"handled": True, "sent": result.ok}
    def _command(self, text: str) -> tuple[str, dict[str, Any] | None]:
        command, _, argument = text.partition(" "); command = command.split("@")[0].lower()
        if command in {"/start", "/help"}: return HELP, None
        if command == "/today":
            plans = self.db.table("daily_plans", params={"select": "*,daily_plan_items(*,tasks(title,status))", "plan_date": f"eq.{date.today().isoformat()}", "period": "eq.morning", "limit": 1}) or []
            if not plans: return "No plan has been generated yet. Use /plan for advice.", None
            items = plans[0].get("daily_plan_items", []); lines = ["<b>Today’s plan</b>", *[f"{index}. {escape_telegram(item.get('tasks', {}).get('title', 'Task'))}" for index, item in enumerate(items, 1)]]
            return "\n".join(lines), status_keyboard(str(items[0]["task_id"])) if items else None
        if command == "/projects":
            projects = self.db.table("projects", params={"select": "title,displayed_progress,risk_status,is_active_context", "status": "not.in.(archived,completed)", "order": "final_deadline.asc"}) or []
            return "<b>Projects</b>\n" + "\n".join(f"{'●' if p['is_active_context'] else '○'} {escape_telegram(p['title'])} — {p['displayed_progress']:g}% · {p['risk_status'].replace('_', ' ')}" for p in projects), None
        if command == "/use": return self._use_project(argument), None
        if command == "/progress":
            project = self._active_project(); return (f"<b>{escape_telegram(project['title'])}</b>\nActual {project['displayed_progress']:g}% · Expected {project['expected_progress']:g}% · Variance {project['progress_variance']:+g}\nRisk: {project['risk_status'].replace('_', ' ')}" if project else "No active project. Use /use &lt;name&gt;.", None)
        if command == "/due": return self._tasks_where("due_date", f"lte.{(date.today() + timedelta(days=7)).isoformat()}", "Due within 7 days")
        if command == "/blocked": return self._tasks_where("status", "eq.blocked", "Blocked tasks")
        if command == "/done": return self._done(argument)
        if command == "/plan": return self._natural("What should I work on today? Explain priorities and respect my daily capacity.")
        if command == "/settings":
            rows = self.db.table("app_settings", params={"select": "timezone,morning_reminder_time,evening_reminder_time,daily_working_hour_limit,default_project_approval_mode", "id": "eq.singleton", "limit": 1}) or []
            value = rows[0] if rows else {}; return "<b>Settings</b>\n" + "\n".join(f"{escape_telegram(k.replace('_', ' ').title())}: {escape_telegram(str(v))}" for k, v in value.items()), None
        return HELP, None
    def _natural(self, text: str) -> tuple[str, dict[str, Any] | None]:
        result = self.chat.chat(message=text, channel="telegram"); reply = escape_telegram(result["reply"])
        if result.get("citations"): reply += "\n\nSources: " + "; ".join(escape_telegram(f"{c['filename']} ({c['reference']})") for c in result["citations"][:3])
        return reply, proposal_keyboard(result["proposal_id"]) if result.get("proposal_id") else None
    def _callback(self, callback: dict[str, Any]) -> dict[str, Any]:
        chat_id = str(((callback.get("message") or {}).get("chat") or {}).get("id", ""))
        if not hmac.compare_digest(chat_id, self.telegram.settings.telegram_allowed_chat_id): return {"ignored": True}
        kind, action, record_id = (callback.get("data") or "::").split(":", 2)
        if kind == "task":
            mapping = {"complete": ("completed", 100), "partial": ("in_progress", 50), "not_started": ("not_started", 0), "blocked": ("blocked", 0)}; status, progress = mapping[action]
            body = {"task_id": record_id, "status": status, "progress_percent": progress, "source": "telegram"}
            if status == "blocked": body["note"] = "Blocked from Telegram callback"
            try: TaskService(self.db).update_progress(TaskProgressInput.model_validate(body))
            except Exception: self.telegram.answer_callback(callback["id"], "Could not update task"); return {"handled": False}
        elif kind == "proposal" and action in {"approve", "reject"}:
            self.db.rpc("approve_ai_proposal", {"p_proposal_id": record_id, "p_edited_payload": None}) if action == "approve" else self.db.table("ai_proposals", method="PATCH", params={"id": f"eq.{record_id}"}, data={"status": "rejected"})
        self.telegram.answer_callback(callback["id"]); return {"handled": True}
    def _active_project(self):
        rows = self.db.table("projects", params={"select": "*", "is_active_context": "eq.true", "limit": 1}) or []
        return rows[0] if rows else None
    def _use_project(self, name: str):
        if not name.strip(): return "Usage: /use &lt;project name&gt;"
        rows = self.db.table("projects", params={"select": "id,title", "title": f"ilike.*{name.strip()}*", "limit": 3}) or []
        if not rows: return "No matching project found."
        if len(rows) > 1: return "Multiple projects match:\n" + "\n".join(f"• {escape_telegram(row['title'])}" for row in rows)
        self.db.rpc("set_active_project", {"p_project_id": rows[0]["id"]}); return f"Active project: <b>{escape_telegram(rows[0]['title'])}</b>"
    def _tasks_where(self, field: str, condition: str, title: str):
        rows = self.db.table("tasks", params={"select": "id,title,due_date,project_id", field: condition, "status": "not.in.(completed,cancelled)" if field != "status" else condition, "order": "due_date.asc", "limit": 12}) or []
        return (f"<b>{title}</b>\n" + "\n".join(f"• {escape_telegram(row['title'])} — {row.get('due_date') or 'no date'}" for row in rows) if rows else f"No {title.lower()}.", status_keyboard(str(rows[0]["id"])) if rows else None)
    def _done(self, name: str):
        rows = self.db.table("tasks", params={"select": "id,title", "title": f"ilike.*{name.strip()}*", "status": "not.in.(completed,cancelled)", "limit": 3}) or []
        if len(rows) != 1: return ("No matching open task." if not rows else "Multiple tasks match. Please be more specific."), None
        TaskService(self.db).update_progress(TaskProgressInput.model_validate({"task_id": rows[0]["id"], "status": "completed", "progress_percent": 100, "source": "telegram"})); return f"✅ Completed: {escape_telegram(rows[0]['title'])}", None

