from __future__ import annotations

from typing import Any

from backend.schemas import ProjectInput
from backend.supabase_client import SupabaseClient


class ProjectService:
    def __init__(self, db: SupabaseClient | None = None): self.db = db or SupabaseClient()

    def list(self, *, limit: int = 25, offset: int = 0, status: str | None = None) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"select": "*", "order": "updated_at.desc", "limit": limit, "offset": offset}
        if status: params["status"] = f"eq.{status}"
        return self.db.table("projects", params=params) or []

    def get(self, project_id: str) -> dict[str, Any] | None:
        rows = self.db.table("projects", params={"select": "*", "id": f"eq.{project_id}", "limit": 1}) or []
        return rows[0] if rows else None

    def create(self, input_data: ProjectInput) -> dict[str, Any]:
        payload = input_data.model_dump(mode="json")
        rows = self.db.table("projects", method="POST", data=payload, prefer="return=representation")
        return rows[0]

    def update(self, project_id: str, changes: dict[str, Any]) -> dict[str, Any]:
        allowed = {"title", "project_type", "description", "status", "priority", "start_date", "final_deadline", "internal_deadline", "estimated_total_hours", "manual_progress", "is_active_context"}
        payload = {key: value for key, value in changes.items() if key in allowed}
        if not payload: raise ValueError("No supported fields supplied")
        if payload.get("status") == "archived": payload["is_active_context"] = False
        if payload.get("is_active_context") is True: self.db.rpc("set_active_project", {"p_project_id": project_id})
        rows = self.db.table("projects", method="PATCH", params={"id": f"eq.{project_id}"}, data=payload, prefer="return=representation")
        if not rows: raise ValueError("Project not found")
        return rows[0]

