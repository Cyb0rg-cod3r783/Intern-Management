from __future__ import annotations
from datetime import datetime
from typing import Optional, Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    id: UUID
    actor_id: Optional[UUID] = None
    actor_name: str = ""
    actor_email: str = ""
    action: str
    target_type: Optional[str] = None
    target_id: Optional[UUID] = None
    metadata: Optional[Any] = Field(None, validation_alias="extra_metadata")
    ip_address: Optional[str] = None
    created_at: datetime



class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    company_email: str
    full_name: str
    role: str
    is_active: bool
    department_id: Optional[UUID] = None
    created_at: datetime


class UserCreateRequest(BaseModel):
    """Admin-only: create a manager or admin user account."""
    company_email: str
    full_name: str
    role: str  # ADMIN, MANAGER
    initial_password: Optional[str] = None
    department_id: Optional[UUID] = None


class UserUpdateRequest(BaseModel):
    """Admin-only: update user account details."""
    company_email: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    department_id: Optional[UUID] = None
    is_active: Optional[bool] = None


class DepartmentCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None


class DepartmentUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
