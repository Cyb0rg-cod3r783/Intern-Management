from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator
import uuid

from app.schemas.task import _validate_safe_url


class DailyLogEntryCreateRequest(BaseModel):
    task_id: Optional[uuid.UUID] = None
    project_id: Optional[uuid.UUID] = None
    hours_spent: float = Field(default=0.0, ge=0.0, le=24.0)
    description: Optional[str] = None
    evidence_link: Optional[str] = None
    new_task_status: Optional[str] = None  # Optional status update for the task: IN_PROGRESS, BLOCKED, COMPLETED

    _validate_evidence_link = field_validator("evidence_link")(_validate_safe_url)


class DailyLogCreateRequest(BaseModel):
    log_date: Optional[date] = None  # Defaults to date.today() if omitted
    total_hours: float = Field(default=8.0, gt=0.0, le=24.0)
    summary_notes: Optional[str] = None
    entries: List[DailyLogEntryCreateRequest] = []


class DailyLogEntryOut(BaseModel):
    id: uuid.UUID
    task_id: Optional[uuid.UUID] = None
    task_title: Optional[str] = None
    project_id: Optional[uuid.UUID] = None
    project_name: Optional[str] = None
    hours_spent: float
    description: Optional[str] = None
    evidence_link: Optional[str] = None
    created_at: datetime


class DailyLogOut(BaseModel):
    id: uuid.UUID
    intern_id: uuid.UUID
    intern_name: str
    intern_email: str
    department_id: Optional[uuid.UUID] = None
    department_name: Optional[str] = None
    log_date: date
    total_hours: float
    summary_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    entries: List[DailyLogEntryOut] = []


class DepartmentDailyLogSummaryOut(BaseModel):
    intern_id: uuid.UUID
    intern_name: str
    company_email: str
    new_tk_id: Optional[str] = None
    has_logged_today: bool
    total_hours_today: float
    latest_log_date: Optional[date] = None
    latest_log_id: Optional[uuid.UUID] = None
