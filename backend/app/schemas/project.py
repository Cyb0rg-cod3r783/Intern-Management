from datetime import date, datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict
from app.schemas.intern import DepartmentOut, UserRef


class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    status: Optional[str] = "ACTIVE"
    start_date: Optional[date] = None
    target_end_date: Optional[date] = None
    department_id: Optional[str] = None


class ProjectCreateRequest(ProjectBase):
    pass


class ProjectUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[date] = None
    target_end_date: Optional[date] = None
    department_id: Optional[str] = None


class ProjectAssignInternsRequest(BaseModel):
    user_ids: List[str]


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID                          # UUID from ORM → serialised as string in JSON
    name: str
    description: Optional[str] = None
    status: str
    start_date: Optional[date] = None
    target_end_date: Optional[date] = None
    department_id: Optional[UUID] = None  # UUID from ORM → serialised as string in JSON
    department: Optional[DepartmentOut] = None
    interns: List[UserRef] = []
    task_count: int = 0
    completed_task_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
