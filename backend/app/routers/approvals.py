import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import User, UserRole, InternProfile, InternApprovalRequest, Department, AuditAction
from app.models.enums import InternStatus
from app.schemas.approval import ApprovalRequestOut, ApprovalActionRequest
from app.schemas.intern import DepartmentOut
from app.middleware.rbac import get_current_user, require_admin_or_manager
from app.services.audit_service import log_action
from app.services.notification_service import notify, notify_admins
from app.services.history_service import record_history_log

router = APIRouter(prefix="/approvals", tags=["Approvals"])


def _build_approval_out(req: InternApprovalRequest) -> ApprovalRequestOut:
    out = ApprovalRequestOut(
        id=req.id,
        intern_id=req.intern_id,
        intern_name=req.intern_profile.user.full_name if req.intern_profile and req.intern_profile.user else "",
        intern_email=req.intern_profile.user.company_email if req.intern_profile and req.intern_profile.user else "",
        tk_id=req.intern_profile.new_tk_id if req.intern_profile else None,
        request_type=req.request_type,
        current_department=DepartmentOut.model_validate(req.current_department) if req.current_department else None,
        target_department=DepartmentOut.model_validate(req.target_department) if req.target_department else None,
        requested_by_name=req.requested_by.full_name if req.requested_by else "Admin",
        assigned_manager_name=req.assigned_manager.full_name if req.assigned_manager else "",
        status=req.status,
        rejection_reason=req.rejection_reason,
        created_at=req.created_at,
        updated_at=req.updated_at,
    )
    return out


# ─── GET /approvals/pending ───────────────────────────────────────────────────
@router.get("/pending", response_model=List[ApprovalRequestOut])
def get_pending_approvals(
    current_user: User = Depends(require_admin_or_manager),
    db: Session = Depends(get_db),
):
    """List pending onboarding & transfer approval requests relevant to current user."""
    query = (
        db.query(InternApprovalRequest)
        .options(
            joinedload(InternApprovalRequest.intern_profile).joinedload(InternProfile.user),
            joinedload(InternApprovalRequest.current_department),
            joinedload(InternApprovalRequest.target_department),
            joinedload(InternApprovalRequest.requested_by),
            joinedload(InternApprovalRequest.assigned_manager),
        )
        .filter(InternApprovalRequest.status == "PENDING")
    )

    if current_user.role == UserRole.MANAGER:
        # Filter for requests targeted to manager's ID or manager's department
        conditions = [InternApprovalRequest.assigned_manager_id == current_user.id]
        if current_user.department_id:
            conditions.append(InternApprovalRequest.target_department_id == current_user.department_id)
        
        from sqlalchemy import or_
        query = query.filter(or_(*conditions))

    requests = query.order_by(InternApprovalRequest.created_at.desc()).all()
    return [_build_approval_out(r) for r in requests]


# ─── POST /approvals/{request_id}/accept ───────────────────────────────────────
@router.post("/{request_id}/accept", response_model=ApprovalRequestOut)
def accept_approval_request(
    request_id: str,
    current_user: User = Depends(require_admin_or_manager),
    db: Session = Depends(get_db),
):
    """Manager accepts an intern onboarding or department transfer request."""
    req = (
        db.query(InternApprovalRequest)
        .options(
            joinedload(InternApprovalRequest.intern_profile).joinedload(InternProfile.user),
            joinedload(InternApprovalRequest.current_department),
            joinedload(InternApprovalRequest.target_department),
            joinedload(InternApprovalRequest.requested_by),
            joinedload(InternApprovalRequest.assigned_manager),
        )
        .filter(InternApprovalRequest.id == uuid.UUID(request_id))
        .first()
    )
    if not req:
        raise HTTPException(status_code=404, detail="Approval request not found.")
    if req.status != "PENDING":
        raise HTTPException(status_code=400, detail=f"Request is already {req.status}.")

    profile = req.intern_profile
    if not profile:
        raise HTTPException(status_code=404, detail="Intern profile associated with request not found.")

    req.status = "ACCEPTED"

    if req.request_type == "ONBOARDING":
        profile.status = InternStatus.ACTIVE
        if req.target_department_id:
            profile.department_id = req.target_department_id
        if req.assigned_manager_id:
            profile.reporting_manager_id = req.assigned_manager_id
        
        target_dept_name = req.target_department.name if req.target_department else "Department"

        record_history_log(
            db,
            intern_profile_id=profile.id,
            user_id=profile.user_id,
            event_type="STATUS_CHANGE",
            title="Onboarding Approved by Manager",
            description=f"Manager {current_user.full_name} accepted onboarding placement into {target_dept_name}.",
            old_value="PENDING_APPROVAL",
            new_value="ACTIVE",
            performed_by_id=current_user.id,
        )

        # Notify Admin who created or all admins
        notify_admins(
            db,
            "Intern Accepted",
            f"Manager {current_user.full_name} accepted intern '{profile.user.full_name}' into {target_dept_name}.",
            "INTERN_ACCEPTED",
            f"/admin/interns"
        )
        # Notify Intern
        notify(
            db,
            profile.user_id,
            "Department Assignment Confirmed",
            f"Welcome! Your onboarding into {target_dept_name} has been accepted by Manager {current_user.full_name}.",
            "ONBOARDING_ACCEPTED",
            "/intern/profile"
        )

    elif req.request_type == "DEPARTMENT_TRANSFER":
        target_dept_name = req.target_department.name if req.target_department else "New Department"
        old_dept_name = req.current_department.name if req.current_department else "Previous Department"
        profile.department_id = req.target_department_id
        if current_user.role == UserRole.MANAGER:
            profile.reporting_manager_id = current_user.id

        record_history_log(
            db,
            intern_profile_id=profile.id,
            user_id=profile.user_id,
            event_type="DEPARTMENT_TRANSFER",
            title="Department Transfer Accepted",
            description=f"Manager {current_user.full_name} accepted department transfer from '{old_dept_name}' to '{target_dept_name}'.",
            old_value=old_dept_name,
            new_value=target_dept_name,
            performed_by_id=current_user.id,
        )
            
        notify_admins(
            db,
            "Department Transfer Accepted",
            f"Manager {current_user.full_name} accepted department transfer for '{profile.user.full_name}' to {target_dept_name}.",
            "TRANSFER_ACCEPTED",
            f"/admin/interns"
        )

    log_action(db, str(current_user.id), AuditAction.APPROVE_INTERN,
               target_type="intern", target_id=str(profile.user_id),
               metadata={"request_type": req.request_type, "intern_name": profile.user.full_name})
    db.commit()
    db.refresh(req)
    return _build_approval_out(req)


# ─── POST /approvals/{request_id}/reject ───────────────────────────────────────
@router.post("/{request_id}/reject", response_model=ApprovalRequestOut)
def reject_approval_request(
    request_id: str,
    body: ApprovalActionRequest,
    current_user: User = Depends(require_admin_or_manager),
    db: Session = Depends(get_db),
):
    """Manager rejects an intern onboarding or department transfer request."""
    req = (
        db.query(InternApprovalRequest)
        .options(
            joinedload(InternApprovalRequest.intern_profile).joinedload(InternProfile.user),
            joinedload(InternApprovalRequest.current_department),
            joinedload(InternApprovalRequest.target_department),
            joinedload(InternApprovalRequest.requested_by),
            joinedload(InternApprovalRequest.assigned_manager),
        )
        .filter(InternApprovalRequest.id == uuid.UUID(request_id))
        .first()
    )
    if not req:
        raise HTTPException(status_code=404, detail="Approval request not found.")
    if req.status != "PENDING":
        raise HTTPException(status_code=400, detail=f"Request is already {req.status}.")

    profile = req.intern_profile
    if not profile:
        raise HTTPException(status_code=404, detail="Intern profile associated with request not found.")

    reason = body.rejection_reason or "No reason provided"
    req.status = "REJECTED"
    req.rejection_reason = reason

    if req.request_type == "ONBOARDING":
        profile.status = InternStatus.REJECTED_BY_MANAGER
        record_history_log(
            db,
            intern_profile_id=profile.id,
            user_id=profile.user_id,
            event_type="STATUS_CHANGE",
            title="Onboarding Declined by Manager",
            description=f"Manager {current_user.full_name} declined onboarding. Feedback: '{reason}'",
            old_value="PENDING_APPROVAL",
            new_value="REJECTED_BY_MANAGER",
            performed_by_id=current_user.id,
        )
        notify_admins(
            db,
            "Intern Onboarding Declined",
            f"Manager {current_user.full_name} declined onboarding for '{profile.user.full_name}'. Reason: '{reason}'",
            "INTERN_REJECTED",
            f"/admin/interns"
        )
    elif req.request_type == "DEPARTMENT_TRANSFER":
        record_history_log(
            db,
            intern_profile_id=profile.id,
            user_id=profile.user_id,
            event_type="DEPARTMENT_TRANSFER",
            title="Department Transfer Declined",
            description=f"Manager {current_user.full_name} declined department transfer. Reason: '{reason}'",
            performed_by_id=current_user.id,
        )
        notify_admins(
            db,
            "Transfer Request Declined",
            f"Manager {current_user.full_name} declined department transfer for '{profile.user.full_name}'. Reason: '{reason}'",
            "TRANSFER_REJECTED",
            f"/admin/interns"
        )

    log_action(db, str(current_user.id), AuditAction.REJECT_INTERN,
               target_type="intern", target_id=str(profile.user_id),
               metadata={"request_type": req.request_type, "reason": reason})
    db.commit()
    db.refresh(req)
    return _build_approval_out(req)
