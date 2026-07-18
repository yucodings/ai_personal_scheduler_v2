from __future__ import annotations

from datetime import date
from enum import StrEnum
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Priority(StrEnum): low = "low"; medium = "medium"; high = "high"; critical = "critical"
class ProjectStatus(StrEnum): planned = "planned"; active = "active"; paused = "paused"; completed = "completed"; archived = "archived"
class TaskStatus(StrEnum):
    not_started = "not_started"; started = "started"; in_progress = "in_progress"; nearly_complete = "nearly_complete"; completed = "completed"; blocked = "blocked"; cancelled = "cancelled"


class LoginRequest(StrictModel): password: str = Field(min_length=1, max_length=256)


class ProjectInput(StrictModel):
    title: str = Field(min_length=2, max_length=160)
    project_type: Literal["subject", "assignment", "examination", "competition", "hackathon", "final_year_project", "internship", "event", "personal", "other"]
    description: str = Field(default="", max_length=5000)
    status: ProjectStatus = ProjectStatus.planned
    priority: Priority = Priority.medium
    start_date: date
    final_deadline: date
    internal_deadline: date | None = None
    estimated_total_hours: float = Field(default=0, ge=0, le=10000)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.final_deadline < self.start_date: raise ValueError("Final deadline must be on or after the start date")
        if self.internal_deadline and not (self.start_date <= self.internal_deadline <= self.final_deadline): raise ValueError("Internal deadline must fall within the project dates")
        return self


class MilestoneInput(StrictModel):
    project_id: UUID; title: str = Field(min_length=2, max_length=200); description: str = Field(default="", max_length=5000); sequence: int = Field(default=0, ge=0); start_date: date | None = None; due_date: date | None = None; estimated_hours: float = Field(default=0, ge=0, le=10000)


class TaskInput(StrictModel):
    project_id: UUID; milestone_id: UUID | None = None; parent_task_id: UUID | None = None; title: str = Field(min_length=2, max_length=240); description: str = Field(default="", max_length=10000); status: TaskStatus = TaskStatus.not_started; progress_percent: float = Field(default=0, ge=0, le=100); priority: Priority = Priority.medium; effort_weight: float = Field(default=1, gt=0, le=1000); estimated_hours: float = Field(default=0, ge=0, le=10000); actual_hours: float = Field(default=0, ge=0, le=10000); planned_start: date | None = None; due_date: date | None = None; blocked_reason: str | None = Field(default=None, max_length=2000); sequence: int = Field(default=0, ge=0)

    @model_validator(mode="after")
    def normalize_status(self):
        if self.status == TaskStatus.completed: self.progress_percent = 100
        if self.status == TaskStatus.not_started: self.progress_percent = 0
        if self.status == TaskStatus.blocked and not self.blocked_reason: raise ValueError("Blocked tasks require a reason")
        return self


class TaskProgressInput(StrictModel):
    task_id: UUID; status: TaskStatus; progress_percent: float = Field(ge=0, le=100); actual_hours_added: float = Field(default=0, ge=0, le=24); note: str | None = Field(default=None, max_length=2000); source: Literal["web", "telegram", "system", "ai"] = "web"


class DependencyInput(StrictModel):
    predecessor_task_id: UUID; dependent_task_id: UUID; dependency_type: Literal["finish_to_start", "start_to_start", "finish_to_finish"] = "finish_to_start"
    @model_validator(mode="after")
    def not_self(self):
        if self.predecessor_task_id == self.dependent_task_id: raise ValueError("A task cannot depend on itself")
        return self


class Citation(StrictModel): document_id: UUID | None = None; filename: str; reference: str; chunk_id: UUID | None = None
class ProposalTask(StrictModel): client_id: str = Field(min_length=1, max_length=100); title: str; description: str = ""; priority: Priority = Priority.medium; estimated_hours: float = Field(ge=0); effort_weight: float = Field(default=1, gt=0); planned_start: date | None = None; due_date: date | None = None; parent_client_id: str | None = None; depends_on: list[str] = []
class ProposalMilestone(StrictModel): client_id: str; title: str; description: str = ""; sequence: int = Field(ge=0); start_date: date | None = None; due_date: date | None = None; estimated_hours: float = Field(default=0, ge=0); tasks: list[ProposalTask]
class ProjectPlanProposal(StrictModel): type: Literal["project_plan"] = "project_plan"; project_id: UUID; summary: str; milestones: list[ProposalMilestone]; recommended_dates: list[dict[str, Any]] = []
class RescheduleProposal(StrictModel): type: Literal["reschedule"] = "reschedule"; project_id: UUID; summary: str; changes: list[dict[str, Any]]


class AIEnvelope(StrictModel):
    reply: str
    intent: Literal["query_project", "create_project_plan", "update_progress", "reschedule", "general"]
    proposal_required: bool = False
    proposal: ProjectPlanProposal | RescheduleProposal | None = None
    citations: list[Citation] = []
    warnings: list[str] = []

    @model_validator(mode="after")
    def proposal_matches_flag(self):
        if self.proposal_required and self.proposal is None: raise ValueError("proposal_required needs proposal data")
        if self.proposal is not None and not self.proposal_required: raise ValueError("proposal data requires confirmation")
        return self


class ChatRequest(StrictModel): message: str = Field(min_length=1, max_length=20000); project_id: UUID | None = None; conversation_id: UUID | None = None; channel: Literal["web", "telegram"] = "web"
class ProposalReviewRequest(StrictModel): proposal_id: UUID; action: Literal["approve", "reject", "approve_milestone", "regenerate"]; milestone_id: str | None = None; edited_payload: dict[str, Any] | None = None


class DocumentFinalizeRequest(StrictModel):
    document_id: UUID; project_id: UUID; extracted_text: str = Field(min_length=1, max_length=5_000_000); extraction_method: Literal["browser_ocr", "browser_pdf_ocr", "server_parser", "zip_inspection"]; ocr_confidence: float | None = Field(default=None, ge=0, le=100)

    @field_validator("extracted_text")
    @classmethod
    def no_nul(cls, value: str): return value.replace("\x00", "")

