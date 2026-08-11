"""
Role-filtered Pydantic schemas for intern profiles.

CRITICAL SECURITY:
- InternProfileIntern: only own profile fields
- InternProfileManager: operational fields, NO sensitive data
- InternProfileAdmin: all fields including sensitive Admin-only data

The API always picks the correct schema based on the requester's role.
Sensitive fields can never be accessed by Managers/Interns regardless of request manipulation.
"""
from __future__ import annotations
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, Any
from uuid import UUID
from pydantic import BaseModel, EmailStr, ConfigDict

from app.models.enums import InternStatus


# ─── Department response ────────────────────────────────────────────────────────
class DepartmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    is_active: bool


# ─── Manager reference (safe, no sensitive data) ────────────────────────────────
class ManagerRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    full_name: str
    company_email: str


# ─── INTERN role: own profile only ─────────────────────────────────────────────
class InternProfileIntern(BaseModel):
    """Fields visible to the intern viewing their own profile."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    new_tk_id: Optional[str] = None
    old_tk_id: Optional[str] = None
    department: Optional[DepartmentOut] = None
    reporting_manager: Optional[ManagerRef] = None
    title: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    internship_type: Optional[str] = None
    duration: Optional[str] = None
    joining_date: Optional[date] = None
    end_date: Optional[date] = None
    status: InternStatus
    # No: personal_email, stipend, bank_*, marital_status


# ─── MANAGER role: operational fields, no sensitive data ───────────────────────
class InternProfileManager(BaseModel):
    """
    Fields visible to Managers for all interns.
    SENSITIVE FIELDS ARE DELIBERATELY EXCLUDED.
    Never add: personal_email, stipend_*, bank_*, marital_status, payment_info_extra.
    """
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    full_name: str = ""         # populated from user.full_name
    company_email: str = ""     # populated from user.company_email
    new_tk_id: Optional[str] = None
    old_tk_id: Optional[str] = None
    department: Optional[DepartmentOut] = None
    reporting_manager: Optional[ManagerRef] = None
    title: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    internship_type: Optional[str] = None
    duration: Optional[str] = None
    joining_date: Optional[date] = None
    end_date: Optional[date] = None
    status: InternStatus
    remarks: Optional[str] = None
    is_overdue_tasks: Optional[bool] = None  # computed field injected by service


# ─── ADMIN role: complete profile ──────────────────────────────────────────────
class InternProfileAdmin(BaseModel):
    """
    Complete intern profile — Admin only.
    Includes all sensitive personal, HR, and financial fields.
    """
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    full_name: str = ""
    company_email: str = ""
    new_tk_id: Optional[str] = None
    old_tk_id: Optional[str] = None
    department: Optional[DepartmentOut] = None
    reporting_manager: Optional[ManagerRef] = None
    title: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    internship_type: Optional[str] = None
    duration: Optional[str] = None
    joining_date: Optional[date] = None
    end_date: Optional[date] = None
    status: InternStatus
    remarks: Optional[str] = None

    # [ADMIN-ONLY] Sensitive personal information
    personal_email: Optional[str] = None
    personal_phone: Optional[str] = None
    marital_status: Optional[str] = None

    # [ADMIN-ONLY] Financial
    stipend_amount: Optional[Decimal] = None
    stipend_type: Optional[str] = None
    is_paid: Optional[bool] = None
    bank_name: Optional[str] = None
    bank_ifsc: Optional[str] = None
    bank_account_number: Optional[str] = None   # decrypted by service, NEVER stored plain
    payment_info_extra: Optional[Any] = None

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ─── Input schemas ──────────────────────────────────────────────────────────────
class InternCreateRequest(BaseModel):
    """Admin-only: create a new intern (and their user account)."""
    full_name: str
    company_email: str       # Must be @talakunchi.com or @talakunchi.in

    role: str = "INTERN"     # Default intern

    # Profile
    new_tk_id: Optional[str] = None
    old_tk_id: Optional[str] = None
    department_id: Optional[UUID] = None
    reporting_manager_id: Optional[UUID] = None
    title: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    internship_type: Optional[str] = None
    duration: Optional[str] = None
    joining_date: Optional[date] = None
    end_date: Optional[date] = None
    remarks: Optional[str] = None

    # Sensitive — Admin only
    personal_email: Optional[str] = None
    personal_phone: Optional[str] = None
    marital_status: Optional[str] = None
    stipend_amount: Optional[Decimal] = None
    stipend_type: Optional[str] = None
    is_paid: Optional[bool] = False
    bank_account_number: Optional[str] = None
    bank_name: Optional[str] = None
    bank_ifsc: Optional[str] = None
    payment_info_extra: Optional[Any] = None

    # Optional: initial password (for email/password auth)
    initial_password: Optional[str] = None


class InternUpdateAdminRequest(BaseModel):
    """Admin: update any intern field."""
    full_name: Optional[str] = None
    new_tk_id: Optional[str] = None
    old_tk_id: Optional[str] = None
    department_id: Optional[UUID] = None
    reporting_manager_id: Optional[UUID] = None
    title: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    internship_type: Optional[str] = None
    duration: Optional[str] = None
    joining_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[InternStatus] = None
    remarks: Optional[str] = None
    personal_email: Optional[str] = None
    personal_phone: Optional[str] = None
    marital_status: Optional[str] = None
    stipend_amount: Optional[Decimal] = None
    stipend_type: Optional[str] = None
    is_paid: Optional[bool] = None
    bank_account_number: Optional[str] = None
    bank_name: Optional[str] = None
    bank_ifsc: Optional[str] = None
    payment_info_extra: Optional[Any] = None


class InternUpdateManagerRequest(BaseModel):
    """
    Manager: only allowed to update operational fields for their own assigned interns.
    Sensitive fields are excluded from this schema entirely.
    """
    title: Optional[str] = None
    location: Optional[str] = None
    remarks: Optional[str] = None
