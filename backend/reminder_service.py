from __future__ import annotations

from datetime import date
from typing import Any

from backend.config import get_settings
from backend.planning_engine import allocate_daily_plan
from backend.supabase_client import SupabaseClient
from backend.telegram_client import TelegramClient, escape_telegram, status_keyboard


class ReminderService:
    def __init__(self, db: SupabaseClient | None = None, telegram: TelegramClient | None = None):
        self.db = db or SupabaseClient(); self.telegram = telegram or TelegramClient(); self.settings = get_settings()

    def morning(self, today: date | None = None) -> dict[str, Any]:
        current = today or date.today(); tasks = self._open_tasks(); settings = self._app_settings(); max_hours = float(settings.get("daily_working_hour_limit", self.settings.default_daily_work_hours)); plan_items = allocate_daily_plan(tasks, max_hours, current)
        plan_rows = self.db.table("daily_plans", method="POST", data={"plan_date": current.isoformat(), "period": "morning", "generated_summary": "Focused plan generated from priority, dependencies, due dates, and capacity.", "total_planned_hours": sum(item.planned_hours for item in plan_items), "completion_percentage": 0, "risk_summary": self._risk_summary()}, prefer="resolution=merge-duplicates,return=representation")
        plan = plan_rows[0]
        if plan_items: self.db.table("daily_plan_items", method="POST", data=[{"daily_plan_id": plan["id"], "task_id": item.task_id, "ordering": index, "planned_duration_minutes": round(item.planned_hours * 60), "is_completed": False} for index, item in enumerate(plan_items)], prefer="resolution=merge-duplicates")
        lines = [f"🌅 <b>Good morning. Here is today’s plan.</b>", ""]
        for index, item in enumerate(plan_items, 1): lines.append(f"{index}. {escape_telegram(item.title)} — {item.planned_hours:g}h")
        lines += ["", f"<b>Total planned work:</b> {sum(item.planned_hours for item in plan_items):g}h", f"<b>At-risk projects:</b> {self._risk_count()}", "", "<b>Skyler’s advice:</b>", escape_telegram(plan_items[0].reason if plan_items else "No open work needs scheduling today.")]
        result = self.telegram.send("\n".join(lines)); self._log("morning_plan", result.ok, result.error)
        return {"plan": plan, "items": [item.__dict__ for item in plan_items], "notification_sent": result.ok}

    def evening(self, today: date | None = None) -> dict[str, Any]:
        current = today or date.today(); plans = self.db.table("daily_plans", params={"select": "*,daily_plan_items(*,tasks(title,status,progress_percent))", "plan_date": f"eq.{current.isoformat()}", "period": "eq.morning", "limit": 1}) or []
        plan = plans[0] if plans else {"daily_plan_items": []}; items = plan.get("daily_plan_items", []); completed = [item for item in items if item.get("tasks", {}).get("status") == "completed"]
        lines = ["🌙 <b>Evening progress check</b>", "", f"Completed: {len(completed)}/{len(items)} planned tasks", ""]
        for item in items: lines.append(("✅ " if item.get("tasks", {}).get("status") == "completed" else "○ ") + escape_telegram(item.get("tasks", {}).get("title", "Task")))
        lines += ["", "What changed today? Share progress or a blocker."]
        markup = status_keyboard(str(items[0]["task_id"])) if items else None; result = self.telegram.send("\n".join(lines), reply_markup=markup); self._log("evening_check", result.ok, result.error)
        return {"planned": len(items), "completed": len(completed), "notification_sent": result.ok}

    def _open_tasks(self): return self.db.table("tasks", params={"select": "*,task_dependencies!task_dependencies_dependent_task_id_fkey(predecessor_task_id)", "status": "not.in.(completed,cancelled)", "order": "due_date.asc"}) or []
    def _app_settings(self):
        rows = self.db.table("app_settings", params={"select": "*", "id": "eq.singleton", "limit": 1}) or []
        return rows[0] if rows else {}
    def _risk_count(self): return len(self.db.table("projects", params={"select": "id", "risk_status": "in.(at_risk,delayed,blocked)"}) or [])
    def _risk_summary(self): return f"{self._risk_count()} project(s) need attention."
    def _log(self, kind: str, success: bool, error: str | None): self.db.table("notification_logs", method="POST", data={"channel": "telegram", "notification_type": kind, "status": "sent" if success else "failed", "error_message": error})
