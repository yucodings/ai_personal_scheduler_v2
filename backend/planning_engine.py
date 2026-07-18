from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any, Iterable, Mapping


@dataclass(frozen=True)
class PlannedItem:
    task_id: str
    title: str
    planned_hours: float
    reason: str


_PRIORITY = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def allocate_daily_plan(tasks: Iterable[Mapping[str, Any]], max_hours: float, today: date | None = None) -> list[PlannedItem]:
    current = today or date.today()
    task_list = list(tasks)
    completed_ids = {str(task["id"]) for task in task_list if task.get("status") == "completed"}
    eligible = [task for task in task_list if task.get("status") not in {"completed", "cancelled", "blocked"} and all(str(dep) in completed_ids for dep in task.get("dependencies", []))]
    eligible.sort(key=lambda task: (0 if _date(task.get("due_date")) and _date(task.get("due_date")) < current else 1, _PRIORITY.get(task.get("priority", "medium"), 2), _date(task.get("due_date")) or date.max, task.get("sequence", 0)))
    capacity = max(0.0, max_hours)
    result: list[PlannedItem] = []
    for task in eligible:
        if capacity <= 0.01:
            break
        remaining = max(0.25, float(task.get("estimated_hours", 0)) * (1 - float(task.get("progress_percent", 0)) / 100))
        allocated = round(min(remaining, capacity), 2)
        due = _date(task.get("due_date"))
        if due and due < current:
            reason = "Overdue—recover this first"
        elif task.get("priority") in {"critical", "high"}:
            reason = "High priority and time-sensitive"
        else:
            reason = "Best fit for today’s remaining capacity"
        result.append(PlannedItem(str(task["id"]), task["title"], allocated, reason))
        capacity -= allocated
    return result


def validate_dependencies(edges: Iterable[tuple[str, str]]) -> None:
    graph: dict[str, set[str]] = {}
    for predecessor, dependent in edges:
        if predecessor == dependent:
            raise ValueError("Self-dependencies are not allowed")
        graph.setdefault(predecessor, set()).add(dependent)
        graph.setdefault(dependent, set())
    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(node: str) -> None:
        if node in visiting:
            raise ValueError("Dependency cycle detected")
        if node in visited:
            return
        visiting.add(node)
        for child in graph[node]:
            visit(child)
        visiting.remove(node)
        visited.add(node)

    for node in graph:
        visit(node)


def _date(value: Any) -> date | None:
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value[:10])
        except ValueError:
            return None
    return None

