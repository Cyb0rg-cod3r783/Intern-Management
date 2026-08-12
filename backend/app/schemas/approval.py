from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict
from app.schemas.intern import DepartmentOut, UserRef


class ApprovalActionRequest(BaseModel):
    rejection_reason: Optional[str] = None


class ApprovalRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    intern_id: UUID
    intern_name: str = ""
    intern_email: str = ""
    tk_id: Optional[str] = None
    request_type: str  # ONBOARDING, DEPARTMENT_TRANSFER
    current_department: Optional[DepartmentOut] = None
    target_department: Optional[DepartmentOut] = None
    requested_by_name: str = ""
    assigned_manager_name: str = ""
    status: str  # PENDING, ACCEPTED, REJECTED
    rejection_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
