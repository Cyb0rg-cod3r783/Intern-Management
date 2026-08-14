from __future__ import annotations
from datetime import date, datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict, field_validator
from app.models.enums import TaskStatus, TaskPriority, TaskApprovalStatus


def _validate_safe_url(value: Optional[str]) -> Optional[str]:
    """Reject dangerous URL schemes (javascript:, data:, vbscript:, etc.) to prevent
    stored-XSS via link fields that are later rendered as clickable <a href> in the UI."""
    if value is None:
        return value
    v = value.strip()
    if not v:
        return None
    lowered = v.lower()
    if lowered.startswith(("http://", "https://")):
        return v
    # Allow protocol-relative and bare-domain style links only if they don't smuggle a scheme
    if ":" in lowered.split("/", 1)[0]:
        raise ValueError("Link must start with http:// or https://")
    return v


class TaskUpdateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    task_id: UUID
    author_id: UUID
    author_name: str = ""
    note: str
    created_at: datetime


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    intern_id: UUID
    intern_name: str = ""
    assigned_by_id: Optional[UUID] = None
    assigned_by_name: str = ""
    project_id: Optional[UUID] = None
    project_name: str = ""
    title: str
    description: Optional[str] = None
    assigned_date: Optional[date] = None
    due_date: Optional[date] = None
    completed_date: Optional[date] = None
    status: TaskStatus
    priority: TaskPriority
    approval_status: TaskApprovalStatus = TaskApprovalStatus.APPROVED
    rejection_reason: Optional[str] = None
    evidence_link: Optional[str] = None
    is_overdue: bool = False
    updates: List[TaskUpdateOut] = []
    created_at: datetime
    updated_at: datetime


class TaskCreateRequest(BaseModel):
    intern_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    title: str

    description: Optional[str] = None
    assigned_date: Optional[date] = None
    due_date: Optional[date] = None
    priority: TaskPriority = TaskPriority.MEDIUM
    status: TaskStatus = TaskStatus.NOT_STARTED
    evidence_link: Optional[str] = None

    _validate_evidence_link = field_validator("evidence_link")(_validate_safe_url)


class TaskUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    project_id: Optional[UUID] = None
    due_date: Optional[date] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    evidence_link: Optional[str] = None
    completed_date: Optional[date] = None

    _validate_evidence_link = field_validator("evidence_link")(_validate_safe_url)


class TaskProgressUpdateRequest(BaseModel):
    note: str


class TaskRejectRequest(BaseModel):
    rejection_reason: Optional[str] = None
