"""
Interns router — role-filtered intern CRUD.

Security model:
- GET /interns: Admin → all fields. Manager → no sensitive. Intern → own only.
- POST /interns: Admin only.
- PUT /interns/{id}: Admin always. Manager only if reporting_manager_id == current_user.id.
- DELETE /interns/{id}: Admin only (deactivation).
"""
import uuid
from typing import List, Optional
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import User, UserRole, InternProfile, AuditAction
from app.schemas.intern import (
    InternProfileAdmin, InternProfileManager, InternProfileIntern,
    InternCreateRequest, InternUpdateAdminRequest, InternUpdateManagerRequest,
    DepartmentOut, ManagerRef,
)
from app.middleware.rbac import (
    get_current_user, require_admin, require_admin_or_manager,
    assert_can_edit_intern,
)
from app.services.auth_service import hash_password, is_allowed_domain
from app.services.crypto_service import encrypt_optional, decrypt_optional
from app.services.audit_service import log_action
from app.services.notification_service import notify_admins

router = APIRouter(prefix="/interns", tags=["Interns"])


def _enrich_profile(profile: InternProfile) -> dict:
    """Add denormalized user fields to profile for serialization."""
    d = {}
    if profile.user:
        d["full_name"] = profile.user.full_name
        d["company_email"] = profile.user.company_email
    return d


def _build_admin_response(profile: InternProfile) -> InternProfileAdmin:
    data = InternProfileAdmin.model_validate(profile)
    data.full_name = profile.user.full_name if profile.user else ""
    data.company_email = profile.user.company_email if profile.user else ""
    # Decrypt bank account number
    data.bank_account_number = decrypt_optional(profile.bank_account_number_encrypted)
    return data


def _build_manager_response(profile: InternProfile) -> InternProfileManager:
    data = InternProfileManager.model_validate(profile)
    data.full_name = profile.user.full_name if profile.user else ""
    data.company_email = profile.user.company_email if profile.user else ""
    return data


def _build_intern_response(profile: InternProfile) -> InternProfileIntern:
    return InternProfileIntern.model_validate(profile)


def _load_profile(db: Session, intern_id: str) -> InternProfile:
    profile = (
        db.query(InternProfile)
        .options(
            joinedload(InternProfile.user),
            joinedload(InternProfile.department),
            joinedload(InternProfile.reporting_manager),
        )
        .filter(InternProfile.user_id == uuid.UUID(intern_id))
        .first()
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Intern not found.")
    return profile


# ─── GET /interns ──────────────────────────────────────────────────────────────
@router.get("/")
def list_interns(
    request: Request,
    department_id: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    manager_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List interns with role-filtered response:
    - Admin: all interns, all fields
    - Manager: all interns, operational fields only
    - Intern: 403
    """
    if current_user.role == UserRole.INTERN:
        raise HTTPException(status_code=403, detail="Interns cannot list other interns.")

    query = (
        db.query(InternProfile)
        .join(User, InternProfile.user_id == User.id)
        .options(
            joinedload(InternProfile.user),
            joinedload(InternProfile.department),
            joinedload(InternProfile.reporting_manager),
        )
        .filter(User.is_active == True)
    )

    if department_id:
        query = query.filter(InternProfile.department_id == uuid.UUID(department_id))
    if status_filter:
        query = query.filter(InternProfile.status == status_filter)
    if manager_id:
        query = query.filter(InternProfile.reporting_manager_id == uuid.UUID(manager_id))
    if search:
        query = query.filter(
            User.full_name.ilike(f"%{search}%") |
            User.company_email.ilike(f"%{search}%") |
            InternProfile.new_tk_id.ilike(f"%{search}%")
        )

    profiles = query.all()

    if current_user.role == UserRole.ADMIN:
        return [_build_admin_response(p) for p in profiles]
    else:  # MANAGER
        return [_build_manager_response(p) for p in profiles]


# ─── GET /interns/{intern_id} ──────────────────────────────────────────────────
@router.get("/{intern_id}")
def get_intern(
    request: Request,
    intern_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get a single intern profile (role-filtered).
    Intern: own profile only. Manager: operational fields only. Admin: all fields.
    """
    profile = _load_profile(db, intern_id)

    if current_user.role == UserRole.INTERN:
        if str(profile.user_id) != str(current_user.id):
            raise HTTPException(status_code=403, detail="You can only view your own profile.")
        log_action(db, str(current_user.id), AuditAction.VIEW_PROFILE,
                   target_type="intern", target_id=intern_id)
        db.commit()
        return _build_intern_response(profile)

    if current_user.role == UserRole.MANAGER:
        log_action(db, str(current_user.id), AuditAction.VIEW_PROFILE,
                   target_type="intern", target_id=intern_id)
        db.commit()
        return _build_manager_response(profile)

    # Admin
    log_action(db, str(current_user.id), AuditAction.VIEW_SENSITIVE_PROFILE,
               target_type="intern", target_id=intern_id)
    db.commit()
    return _build_admin_response(profile)


# ─── POST /interns ─────────────────────────────────────────────────────────────
@router.post("/", status_code=status.HTTP_201_CREATED)
def create_intern(
    request: Request,
    body: InternCreateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin only: create a new intern user + profile."""
    if not is_allowed_domain(body.company_email):
        raise HTTPException(status_code=400, detail="Company email must be a @talakunchi.com or @talakunchi.in address.")


    # Check duplicate email
    existing = db.query(User).filter(User.company_email == body.company_email.lower()).first()
    if existing:
        raise HTTPException(status_code=409, detail="A user with this company email already exists.")

    # Create user
    new_user = User(
        company_email=body.company_email.lower(),
        full_name=body.full_name,
        role=UserRole.INTERN,
        is_active=True,
        password_hash=hash_password(body.initial_password) if body.initial_password else None,
    )
    db.add(new_user)
    db.flush()  # get ID

    # Create profile with encrypted bank data
    bank_encrypted = encrypt_optional(body.bank_account_number)

    profile = InternProfile(
        user_id=new_user.id,
        new_tk_id=body.new_tk_id,
        old_tk_id=body.old_tk_id,
        department_id=body.department_id,
        reporting_manager_id=body.reporting_manager_id,
        title=body.title,
        category=body.category,
        location=body.location,
        internship_type=body.internship_type,
        duration=body.duration,
        joining_date=body.joining_date,
        end_date=body.end_date,
        remarks=body.remarks,
        personal_email=body.personal_email,
        personal_phone=body.personal_phone,
        marital_status=body.marital_status,
        stipend_amount=body.stipend_amount,
        stipend_type=body.stipend_type,
        is_paid=body.is_paid,
        bank_account_number_encrypted=bank_encrypted,
        bank_name=body.bank_name,
        bank_ifsc=body.bank_ifsc,
        payment_info_extra=body.payment_info_extra,
    )
    db.add(profile)

    log_action(db, str(current_user.id), AuditAction.CREATE_INTERN,
               target_type="intern", target_id=str(new_user.id),
               metadata={"email": body.company_email})
    db.commit()
    db.refresh(profile)

    return _build_admin_response(_load_profile(db, str(new_user.id)))


# ─── PUT /interns/{intern_id} ──────────────────────────────────────────────────
@router.put("/{intern_id}")
def update_intern(
    request: Request,
    intern_id: str,
    body: dict,  # Accept raw dict and parse role-appropriately
    current_user: User = Depends(require_admin_or_manager),
    db: Session = Depends(get_db),
):
    """Update intern. Admin: all fields. Manager: only own interns, operational fields."""
    profile = _load_profile(db, intern_id)
    assert_can_edit_intern(current_user, profile)

    if current_user.role == UserRole.ADMIN:
        parsed = InternUpdateAdminRequest(**body)
        if parsed.full_name is not None:
            profile.user.full_name = parsed.full_name
        for field in ["new_tk_id", "old_tk_id", "department_id", "reporting_manager_id",
                      "title", "category", "location", "internship_type", "duration",
                      "joining_date", "end_date", "status", "remarks",
                      "personal_email", "personal_phone", "marital_status", "stipend_amount",
                      "stipend_type", "is_paid", "bank_name", "bank_ifsc", "payment_info_extra"]:
            val = getattr(parsed, field, None)
            if val is not None:
                setattr(profile, field, val)

        if parsed.bank_account_number is not None:
            profile.bank_account_number_encrypted = encrypt_optional(parsed.bank_account_number)
            log_action(db, str(current_user.id), AuditAction.EDIT_STIPEND,
                       target_type="intern", target_id=intern_id,
                       metadata={"field": "bank_account_number"})

        if parsed.bank_account_number is not None or parsed.stipend_amount is not None or parsed.personal_email is not None:
            intern_name = profile.user.full_name if profile.user else "Intern"
            notify_admins(
                db, "🔒 Sensitive Data Alert",
                f"{current_user.full_name} updated sensitive records for {intern_name}.",
                "SENSITIVE_DATA", f"/admin/interns/{intern_id}"
            )

        log_action(db, str(current_user.id), AuditAction.EDIT_INTERN,
                   target_type="intern", target_id=intern_id)

    else:  # MANAGER
        parsed = InternUpdateManagerRequest(**body)
        for field in ["title", "location", "remarks"]:
            val = getattr(parsed, field, None)
            if val is not None:
                setattr(profile, field, val)
        log_action(db, str(current_user.id), AuditAction.EDIT_INTERN,
                   target_type="intern", target_id=intern_id)

    db.commit()
    return _build_admin_response(_load_profile(db, intern_id)) if current_user.role == UserRole.ADMIN \
        else _build_manager_response(_load_profile(db, intern_id))


# ─── DELETE /interns/{intern_id} (deactivate) ─────────────────────────────────
@router.delete("/{intern_id}", status_code=status.HTTP_200_OK)
def deactivate_intern(
    intern_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin only: deactivate an intern (soft delete)."""
    profile = _load_profile(db, intern_id)
    profile.user.is_active = False
    profile.status = "INACTIVE"

    log_action(db, str(current_user.id), AuditAction.DEACTIVATE_USER,
               target_type="intern", target_id=intern_id)
    db.commit()
    return {"message": "Intern deactivated successfully."}
