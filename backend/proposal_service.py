from __future__ import annotations

import hashlib
import json
from typing import Any

from backend.schemas import ProposalReviewRequest
from backend.supabase_client import SupabaseClient


def proposal_fingerprint(project_id: str, proposal_type: str, payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(f"{project_id}:{proposal_type}:{canonical}".encode()).hexdigest()


class ProposalService:
    def __init__(self, db: SupabaseClient | None = None): self.db = db or SupabaseClient()
    def create(self, *, project_id: str, proposal_type: str, payload: dict[str, Any], summary: str, approval_mode: str, source_document_id: str | None = None):
        fingerprint = proposal_fingerprint(project_id, proposal_type, payload)
        existing = self.db.table("ai_proposals", params={"select": "*", "fingerprint": f"eq.{fingerprint}", "status": "in.(pending,partially_approved)", "limit": 1}) or []
        if existing: return existing[0]
        rows = self.db.table("ai_proposals", method="POST", data={"project_id": project_id, "proposal_type": proposal_type, "source_document_id": source_document_id, "proposed_payload": payload, "human_summary": summary, "approval_mode": approval_mode, "status": "pending", "fingerprint": fingerprint, "review_state": {"reviewed_milestones": []}}, prefer="return=representation")
        return rows[0]
    def review(self, request: ProposalReviewRequest):
        if request.action == "approve": return self.db.rpc("approve_ai_proposal", {"p_proposal_id": str(request.proposal_id), "p_edited_payload": request.edited_payload})
        if request.action == "approve_milestone":
            if not request.milestone_id: raise ValueError("milestone_id is required")
            return self.db.rpc("approve_proposal_milestone", {"p_proposal_id": str(request.proposal_id), "p_milestone_client_id": request.milestone_id, "p_edited_payload": request.edited_payload})
        if request.action == "reject": return self.db.table("ai_proposals", method="PATCH", params={"id": f"eq.{request.proposal_id}", "status": "in.(pending,partially_approved)"}, data={"status": "rejected"}, prefer="return=representation")
        return {"regenerate": True, "proposal_id": str(request.proposal_id)}

