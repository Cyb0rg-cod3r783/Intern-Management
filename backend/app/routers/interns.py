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
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import User, UserRole, InternProfile, AuditAction, AuditLog, Notification, Task, TaskUpdate, Handover, InternApprovalRequest, InternHistoryLog, Project, project_interns
from app.models.enums import InternStatus, TaskStatus
from app.schemas.intern import (
    InternProfileAdmin, InternProfileManager, InternProfileIntern,
    InternCreateRequest, InternUpdateAdminRequest, InternUpdateManagerRequest,
    DepartmentOut, ManagerRef,
)
from app.schemas.history import InternHistoryLogOut, InternHistoryResponse, ProjectHistoryItem, TaskHistorySummary, PerformedByRef
from app.middleware.rbac import (
    get_current_user, require_admin, require_admin_or_manager,
    assert_can_edit_intern,
)
from app.services.auth_service import hash_password, is_allowed_domain
from app.services.crypto_service import encrypt_optional, decrypt_optional
from app.services.audit_service import log_action
from app.services.notification_service import notify, notify_admins
from app.services.history_service import record_history_log, detect_and_record_profile_changes

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
    """Load profile by either profile ID or user ID for maximum endpoint compatibility."""
    try:
        target_uuid = uuid.UUID(intern_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Invalid intern ID format.")

    profile = (
        db.query(InternProfile)
        .options(
            joinedload(InternProfile.user),
            joinedload(InternProfile.department),
            joinedload(InternProfile.reporting_manager),
        )
        .filter(or_(InternProfile.id == target_uuid, InternProfile.user_id == target_uuid))
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
    elif current_user.role == UserRole.MANAGER:
        # Exclude candidates pending onboarding approval or rejected from Manager's active lists
        query = query.filter(InternProfile.status.notin_([InternStatus.PENDING_APPROVAL, InternStatus.REJECTED_BY_MANAGER]))
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

    # Initial status is PENDING_APPROVAL if department/manager assigned, else ACTIVE
    initial_status = InternStatus.PENDING_APPROVAL if (body.department_id or body.reporting_manager_id) else InternStatus.ACTIVE

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
        status=initial_status,
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
    db.flush()

    if initial_status == InternStatus.PENDING_APPROVAL:
        # Create approval request for manager
        approval_req = InternApprovalRequest(
            intern_id=profile.id,
            request_type="ONBOARDING",
            target_department_id=body.department_id,
            requested_by_id=current_user.id,
            assigned_manager_id=body.reporting_manager_id,
            status="PENDING",
        )
        db.add(approval_req)

        # Notify Manager(s)
        managers_to_notify = []
        if body.reporting_manager_id:
            mgr = db.query(User).filter(User.id == body.reporting_manager_id).first()
            if mgr:
                managers_to_notify.append(mgr)
        elif body.department_id:
            managers_to_notify = db.query(User).filter(
                User.role == UserRole.MANAGER, User.department_id == body.department_id
            ).all()

        for mgr in managers_to_notify:
            notify(
                db, mgr.id, "⏳ New Intern Onboarding Request",
                f"New intern '{new_user.full_name}' was onboarded. Please review and accept/decline department placement.",
                "APPROVAL_REQUEST", "/manager/dashboard"
            )

    log_action(db, str(current_user.id), AuditAction.CREATE_INTERN,
               target_type="intern", target_id=str(new_user.id),
               metadata={"email": body.company_email})

    record_history_log(
        db,
        intern_profile_id=profile.id,
        user_id=new_user.id,
        event_type="ONBOARDING",
        title="Intern Account Created & Onboarded",
        description=f"Intern account for {new_user.full_name} created by {current_user.full_name}.",
        new_value=initial_status.value,
        performed_by_id=current_user.id,
    )

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

    # Snapshot old state for history tracking
    old_data = {
        "category": profile.category or "intern",
        "internship_type": profile.internship_type or "paid",
        "end_date": profile.end_date,
        "duration": profile.duration,
        "stipend_amount": profile.stipend_amount,
        "stipend_type": profile.stipend_type,
        "department_id": profile.department_id,
        "reporting_manager_id": profile.reporting_manager_id,
        "status": profile.status,
    }

    if current_user.role == UserRole.ADMIN:
        parsed = InternUpdateAdminRequest(**body)
        old_dept_id = profile.department_id

        # Validate Promotion Category Matrix
        if parsed.category is not None and parsed.category.lower() != (profile.category or "intern").lower():
            old_cat = (profile.category or "intern").lower()
            new_cat = parsed.category.lower()
            valid_targets = {
                "intern": ["trainee", "contract", "full_time"],
                "trainee": ["contract", "full_time"],
                "contract": ["full_time"],
                "full_time": [],
            }
            if new_cat not in valid_targets.get(old_cat, []):
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid promotion transition from '{old_cat.upper()}' to '{new_cat.upper()}'. Allowed targets: {[t.upper() for t in valid_targets.get(old_cat, [])]}"
                )
            
            # Enforce Paid requirement for trainee, contract, full_time
            if new_cat in ["trainee", "contract", "full_time"]:
                parsed.internship_type = "paid"
                parsed.is_paid = True
                if parsed.stipend_amount is None and (profile.stipend_amount is None or profile.stipend_amount <= 0):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Promotion to {new_cat.upper()} requires a valid paid stipend amount (> 0)."
                    )

        if parsed.full_name is not None:
            profile.user.full_name = parsed.full_name

        # Check if Admin is initiating a department transfer
        is_transfer_request = (parsed.department_id is not None and str(parsed.department_id) != str(old_dept_id) if old_dept_id else parsed.department_id is not None)

        fields_to_update = ["new_tk_id", "old_tk_id",
                            "title", "category", "location", "internship_type", "duration",
                            "joining_date", "end_date", "status", "remarks",
                            "personal_email", "personal_phone", "marital_status", "stipend_amount",
                            "stipend_type", "is_paid", "bank_name", "bank_ifsc", "payment_info_extra"]

        # Only update department_id and reporting_manager_id directly if NOT a transfer request needing approval
        if not is_transfer_request:
            fields_to_update.extend(["department_id", "reporting_manager_id"])

        for field in fields_to_update:
            val = getattr(parsed, field, None)
            if val is not None:
                setattr(profile, field, val)

        # Trigger department transfer request if department changed by Admin
        if is_transfer_request:
            transfer_req = InternApprovalRequest(
                intern_id=profile.id,
                request_type="DEPARTMENT_TRANSFER",
                current_department_id=old_dept_id,
                target_department_id=parsed.department_id,
                requested_by_id=current_user.id,
                assigned_manager_id=parsed.reporting_manager_id,
                status="PENDING",
            )
            db.add(transfer_req)

            target_managers = db.query(User).filter(
                User.role == UserRole.MANAGER, User.department_id == parsed.department_id
            ).all()
            for mgr in target_managers:
                notify(
                    db, mgr.id, "🔄 Department Transfer Request",
                    f"Intern '{profile.user.full_name}' has been requested for transfer into your department. Please review and accept/decline in Pending Approvals.",
                    "APPROVAL_REQUEST", "/manager/dashboard"
                )

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
        for field in ["title", "location", "remarks", "end_date", "duration"]:
            val = getattr(parsed, field, None)
            if val is not None:
                setattr(profile, field, val)
        log_action(db, str(current_user.id), AuditAction.EDIT_INTERN,
                   target_type="intern", target_id=intern_id)

    new_data = {
        "category": profile.category,
        "internship_type": profile.internship_type,
        "end_date": profile.end_date,
        "duration": profile.duration,
        "stipend_amount": profile.stipend_amount,
        "stipend_type": profile.stipend_type,
        "department_id": profile.department_id,
        "reporting_manager_id": profile.reporting_manager_id,
        "status": profile.status,
    }

    # Record structured history logs for detected changes
    detect_and_record_profile_changes(db, profile, old_data, new_data, current_user)

    db.commit()
    return _build_admin_response(_load_profile(db, intern_id)) if current_user.role == UserRole.ADMIN \
        else _build_manager_response(_load_profile(db, intern_id))


# ─── GET /interns/{intern_id}/history ──────────────────────────────────────────
@router.get("/{intern_id}/history", response_model=InternHistoryResponse)
def get_intern_history(
    intern_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get full career and lifecycle history timeline for an intern.
    - Admin: sees complete history including stipend revision logs.
    - Manager: sees history for managed intern; stipend revision logs are hidden for privacy.
    - Intern: sees own non-sensitive history logs.
    """
    profile = _load_profile(db, intern_id)
    u_uuid = profile.user_id

    if current_user.role == UserRole.INTERN:
        if str(profile.user_id) != str(current_user.id):
            raise HTTPException(status_code=403, detail="You can only view your own history.")
    elif current_user.role == UserRole.MANAGER:
        if str(profile.reporting_manager_id) != str(current_user.id) and \
           (not current_user.department_id or str(profile.department_id) != str(current_user.department_id)):
            raise HTTPException(status_code=403, detail="Access denied. You can only view history for interns in your department or assigned to you.")

    # 1. Fetch History Logs
    logs_query = (
        db.query(InternHistoryLog)
        .options(joinedload(InternHistoryLog.performed_by))
        .filter(InternHistoryLog.user_id == u_uuid)
    )

    if current_user.role in (UserRole.MANAGER, UserRole.INTERN):
        # Filter out stipend / financial sensitive logs for Manager and Intern roles
        logs_query = logs_query.filter(InternHistoryLog.is_sensitive == False)

    logs = logs_query.order_by(InternHistoryLog.created_at.desc()).all()

    # 2. Fetch Projects Worked On
    proj_rows = (
        db.query(Project, project_interns.c.assigned_at)
        .join(project_interns, Project.id == project_interns.c.project_id)
        .filter(project_interns.c.user_id == u_uuid)
        .order_by(project_interns.c.assigned_at.desc())
        .all()
    )
    projects_history = [
        ProjectHistoryItem(
            id=p.id,
            name=p.name,
            status=p.status,
            assigned_at=assigned_at,
        )
        for p, assigned_at in proj_rows
    ]

    # 3. Compute Task Summary
    tasks = db.query(Task).filter(Task.intern_id == u_uuid).all()
    total_t = len(tasks)
    completed_t = sum(1 for t in tasks if t.status == TaskStatus.COMPLETED)
    in_prog_t = sum(1 for t in tasks if t.status == TaskStatus.IN_PROGRESS)
    blocked_t = sum(1 for t in tasks if t.status == TaskStatus.BLOCKED)
    overdue_t = sum(1 for t in tasks if t.is_overdue)

    tasks_summary = TaskHistorySummary(
        total_assigned=total_t,
        completed=completed_t,
        in_progress=in_prog_t,
        blocked=blocked_t,
        overdue=overdue_t,
    )

    # 4. Summary Counters
    extension_count = sum(1 for log in logs if log.event_type == "INTERNSHIP_EXTENSION")
    dept_transfer_count = sum(1 for log in logs if log.event_type == "DEPARTMENT_TRANSFER")
    manager_change_count = sum(1 for log in logs if log.event_type == "MANAGER_CHANGE")
    stipend_revisions_count = sum(1 for log in logs if log.event_type == "STIPEND_REVISION") if current_user.role == UserRole.ADMIN else 0

    summary_dict = {
        "extension_count": extension_count,
        "department_transfer_count": dept_transfer_count,
        "manager_change_count": manager_change_count,
        "stipend_revisions_count": stipend_revisions_count,
        "projects_count": len(projects_history),
        "tasks_completed_count": completed_t,
        "joining_date": str(profile.joining_date) if profile.joining_date else None,
        "current_end_date": str(profile.end_date) if profile.end_date else None,
        "current_status": profile.status.value if isinstance(profile.status, InternStatus) else str(profile.status),
    }

    # Format output logs
    formatted_logs = []
    for l in logs:
        log_out = InternHistoryLogOut.model_validate(l)
        if l.performed_by:
            log_out.performed_by = PerformedByRef.model_validate(l.performed_by)
        formatted_logs.append(log_out)

    return InternHistoryResponse(
        summary=summary_dict,
        projects_history=projects_history,
        tasks_summary=tasks_summary,
        logs=formatted_logs,
    )


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
    profile.status = InternStatus.INACTIVE

    log_action(db, str(current_user.id), AuditAction.DEACTIVATE_USER,
               target_type="intern", target_id=intern_id)
    db.commit()
    return {"message": "Intern deactivated successfully."}


def _delete_intern_cascading(db: Session, target_user_id: str):
    """Helper to permanently purge an intern and all associated records across all tables."""
    u_uuid = uuid.UUID(str(target_user_id))

    # 1. Clear approval requests for profile or manager/requester
    profile = db.query(InternProfile).filter(InternProfile.user_id == u_uuid).first()
    if profile:
        db.query(InternApprovalRequest).filter(InternApprovalRequest.intern_id == profile.id).delete(synchronize_session=False)
    db.query(InternApprovalRequest).filter(
        (InternApprovalRequest.requested_by_id == u_uuid) | (InternApprovalRequest.assigned_manager_id == u_uuid)
    ).delete(synchronize_session=False)

    # 2. Clear project_interns association
    db.execute(project_interns.delete().where(project_interns.c.user_id == u_uuid))

    # 3. Clear task updates
    user_task_ids = [t[0] for t in db.query(Task.id).filter((Task.intern_id == u_uuid) | (Task.assigned_by_id == u_uuid)).all()]
    if user_task_ids:
        db.query(TaskUpdate).filter(TaskUpdate.task_id.in_(user_task_ids)).delete(synchronize_session=False)
    db.query(TaskUpdate).filter(TaskUpdate.author_id == u_uuid).delete(synchronize_session=False)

    # 4. Clear tasks
    db.query(Task).filter((Task.intern_id == u_uuid) | (Task.assigned_by_id == u_uuid)).delete(synchronize_session=False)

    # 5. Clear handovers
    db.query(Handover).filter(
        (Handover.outgoing_intern_id == u_uuid) | (Handover.receiving_person_id == u_uuid) | (Handover.initiated_by_id == u_uuid)
    ).delete(synchronize_session=False)

    # 6. Clear notifications (recipient_id)
    db.query(Notification).filter(Notification.recipient_id == u_uuid).delete(synchronize_session=False)

    # 7. Unlink reporting manager from other profiles if this user was a manager
    db.query(InternProfile).filter(InternProfile.reporting_manager_id == u_uuid).update({"reporting_manager_id": None}, synchronize_session=False)

    # 8. Unlink actor_id on audit logs to preserve audit trails while allowing user deletion
    db.query(AuditLog).filter(AuditLog.actor_id == u_uuid).update({"actor_id": None}, synchronize_session=False)

    # 9. Clear intern profile
    db.query(InternProfile).filter(InternProfile.user_id == u_uuid).delete(synchronize_session=False)

    # 10. Clear user account
    db.query(User).filter(User.id == u_uuid).delete(synchronize_session=False)


@router.delete("/{intern_id}/permanent", status_code=status.HTTP_200_OK)
def delete_intern_permanently(
    intern_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin only: permanently delete an intern and purge all records."""
    profile = _load_profile(db, intern_id)
    target_user_id = str(profile.user_id)

    log_action(db, str(current_user.id), AuditAction.USER_DELETED,
               target_type="intern", target_id=target_user_id,
               metadata={"email": profile.user.company_email, "name": profile.user.full_name})

    _delete_intern_cascading(db, target_user_id)
    db.commit()

    return {"message": "Intern permanently deleted."}
