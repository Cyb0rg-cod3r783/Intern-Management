from __future__ import annotations
from datetime import datetime
from typing import Optional, List, Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class PerformedByRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    full_name: str
    company_email: str
    role: str


class InternHistoryLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    intern_profile_id: UUID
    user_id: UUID
    event_type: str
    title: str
    description: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    extra_metadata: Optional[Any] = None
    performed_by: Optional[PerformedByRef] = None
    is_sensitive: bool = False
    created_at: datetime


class ProjectHistoryItem(BaseModel):
    id: UUID
    name: str
    status: str
    assigned_at: Optional[datetime] = None


class TaskHistorySummary(BaseModel):
    total_assigned: int
    completed: int
    in_progress: int
    blocked: int
    overdue: int


class InternHistoryResponse(BaseModel):
    summary: dict
    projects_history: List[ProjectHistoryItem]
    tasks_summary: TaskHistorySummary
    logs: List[InternHistoryLogOut]
