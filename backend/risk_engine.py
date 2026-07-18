from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any, Iterable, Mapping


@dataclass(frozen=True)
class RiskAssessment:
    status: str; reason: str; overdue_tasks: int; blocked_tasks: int; available_days: int; required_hours_per_day: float


def _v(item: Mapping[str, Any] | object, name: str, default=None): return item.get(name, default) if isinstance(item, Mapping) else getattr(item, name, default)


def assess_risk(*, project_status: str, final_deadline: date, displayed_progress: float, expected_progress: float, remaining_hours: float, tasks: Iterable[Mapping[str, Any] | object], daily_capacity: float = 6, today: date | None = None) -> RiskAssessment:
    current = today or date.today(); task_list = list(tasks); available_days = max(0, (final_deadline - current).days + 1); required = round(remaining_hours / max(1, available_days), 2)
    overdue = sum(1 for task in task_list if _v(task, "status") not in {"completed", "cancelled"} and _date(_v(task, "due_date")) and _date(_v(task, "due_date")) < current)
    blocked_items = [task for task in task_list if _v(task, "status") == "blocked"]; critical_blocked = any(_v(task, "priority") in {"critical", "high"} for task in blocked_items); variance = displayed_progress - expected_progress
    if project_status == "completed" or displayed_progress >= 100: return RiskAssessment("completed", "Project work is complete.", overdue, len(blocked_items), available_days, required)
    if critical_blocked: return RiskAssessment("blocked", "A high-priority or critical task is blocked.", overdue, len(blocked_items), available_days, required)
    if final_deadline < current: return RiskAssessment("delayed", "The final deadline has passed.", overdue, len(blocked_items), available_days, required)
    if overdue > 0 or variance <= -20: return RiskAssessment("delayed", f"{overdue} task(s) are overdue." if overdue else "Progress is at least 20 points behind plan.", overdue, len(blocked_items), available_days, required)
    if variance <= -10: return RiskAssessment("at_risk", "Progress is at least 10 points behind plan.", overdue, len(blocked_items), available_days, required)
    if required > daily_capacity * 1.15: return RiskAssessment("at_risk", f"Remaining work requires {required:g} hours per day, above the configured capacity.", overdue, len(blocked_items), available_days, required)
    if blocked_items: return RiskAssessment("at_risk", "Blocked work needs attention.", overdue, len(blocked_items), available_days, required)
    return RiskAssessment("on_track", "Progress and remaining workload are within plan.", overdue, 0, available_days, required)


def _date(value: Any) -> date | None:
    if isinstance(value, date): return value
    if isinstance(value, str):
        try: return date.fromisoformat(value[:10])
        except ValueError: return None
    return None

