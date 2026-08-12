from __future__ import annotations
from datetime import date, datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict
from app.models.enums import TaskStatus, TaskPriority


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


class TaskUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    project_id: Optional[UUID] = None
    due_date: Optional[date] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    evidence_link: Optional[str] = None
    completed_date: Optional[date] = None


class TaskProgressUpdateRequest(BaseModel):
    note: str
