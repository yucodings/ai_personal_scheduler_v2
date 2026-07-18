from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Iterable, Mapping, Any


@dataclass(frozen=True)
class ProgressSnapshot:
    calculated_progress: float
    displayed_progress: float
    expected_progress: float
    variance: float
    remaining_hours: float
    manual_override_active: bool


def _value(item: Mapping[str, Any] | object, name: str, default=None):
    return item.get(name, default) if isinstance(item, Mapping) else getattr(item, name, default)


def calculated_progress(tasks: Iterable[Mapping[str, Any] | object]) -> float:
    active = [task for task in tasks if _value(task, "status") != "cancelled"]
    if not active: return 0.0
    weights = [max(0.0, float(_value(task, "effort_weight", 1) or 0)) for task in active]
    denominator = sum(weights)
    if denominator <= 0: return 0.0
    numerator = sum(min(100.0, max(0.0, float(_value(task, "progress_percent", 0) or 0))) * weight for task, weight in zip(active, weights))
    return round(numerator / denominator, 2)


def expected_progress(tasks: Iterable[Mapping[str, Any] | object], today: date | None = None) -> float:
    current = today or date.today(); weighted = 0.0; total_weight = 0.0
    for task in tasks:
        if _value(task, "status") == "cancelled": continue
        weight = max(0.0, float(_value(task, "effort_weight", 1) or 0)); start = _as_date(_value(task, "planned_start")); due = _as_date(_value(task, "due_date"))
        if not start or not due: continue
        if current < start: expected = 0.0
        elif current >= due: expected = 100.0
        else: expected = 100.0 * (current - start).days / max(1, (due - start).days)
        weighted += expected * weight; total_weight += weight
    return round(weighted / total_weight, 2) if total_weight else 0.0


def remaining_hours(tasks: Iterable[Mapping[str, Any] | object]) -> float:
    total = 0.0
    for task in tasks:
        if _value(task, "status") in {"completed", "cancelled"}: continue
        estimate = max(0.0, float(_value(task, "estimated_hours", 0) or 0)); progress = min(100.0, max(0.0, float(_value(task, "progress_percent", 0) or 0)))
        total += estimate * (1 - progress / 100)
    return round(total, 2)


def snapshot(tasks: Iterable[Mapping[str, Any] | object], manual_progress: float | None = None, today: date | None = None) -> ProgressSnapshot:
    task_list = list(tasks); calculated = calculated_progress(task_list); expected = expected_progress(task_list, today); displayed = calculated if manual_progress is None else min(100.0, max(0.0, float(manual_progress)))
    return ProgressSnapshot(calculated, round(displayed, 2), expected, round(displayed - expected, 2), remaining_hours(task_list), manual_progress is not None)


def milestone_progress(tasks: Iterable[Mapping[str, Any] | object]) -> float: return calculated_progress(tasks)


def _as_date(value: Any) -> date | None:
    if isinstance(value, date): return value
    if isinstance(value, str):
        try: return date.fromisoformat(value[:10])
        except ValueError: return None
    return None

