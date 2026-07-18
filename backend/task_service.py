from __future__ import annotations

from typing import Any

from backend.planning_engine import validate_dependencies
from backend.schemas import DependencyInput, TaskInput, TaskProgressInput
from backend.supabase_client import SupabaseClient


class TaskService:
    def __init__(self, db: SupabaseClient | None = None): self.db = db or SupabaseClient()
    def list(self, project_id: str, limit: int = 100, offset: int = 0): return self.db.table("tasks", params={"select": "*,task_dependencies!task_dependencies_dependent_task_id_fkey(predecessor_task_id)", "project_id": f"eq.{project_id}", "order": "sequence.asc,due_date.asc", "limit": limit, "offset": offset}) or []
    def create(self, data: TaskInput): return self.db.table("tasks", method="POST", data=data.model_dump(mode="json"), prefer="return=representation")[0]
    def update_progress(self, data: TaskProgressInput): return self.db.rpc("record_task_progress", data.model_dump(mode="json"))
    def add_dependency(self, data: DependencyInput):
        predecessor = str(data.predecessor_task_id); dependent = str(data.dependent_task_id)
        existing = self.db.table("task_dependencies", params={"select": "predecessor_task_id,dependent_task_id"}) or []
        validate_dependencies([(str(row["predecessor_task_id"]), str(row["dependent_task_id"])) for row in existing] + [(predecessor, dependent)])
        return self.db.table("task_dependencies", method="POST", data=data.model_dump(mode="json"), prefer="return=representation")[0]

