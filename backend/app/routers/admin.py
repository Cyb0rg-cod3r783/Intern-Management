"""
Admin router — analytics dashboard, user management, data export.
All endpoints require Admin role.
"""
from datetime import date, timedelta
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
import csv
import io

from app.database import get_db
from app.models import User, UserRole, InternProfile, Task, Department, AuditAction
from app.models.enums import InternStatus, TaskStatus
from app.middleware.rbac import require_admin, require_manager

from app.services.auth_service import hash_password, is_allowed_domain
from app.services.audit_service import log_action
from app.schemas.misc import UserCreateRequest, UserOut

router = APIRouter(prefix="/admin", tags=["Admin"])


# ─── Analytics dashboard ───────────────────────────────────────────────────────
@router.get("/analytics")
def get_analytics(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin-only analytics summary."""
    today = date.today()
    in_30_days = today + timedelta(days=30)

    total = db.query(InternProfile).count()
    active = db.query(InternProfile).filter(InternProfile.status == InternStatus.ACTIVE).count()
    alumni = db.query(InternProfile).filter(InternProfile.status == InternStatus.ALUMNI).count()
    inactive = db.query(InternProfile).filter(InternProfile.status == InternStatus.INACTIVE).count()

    # Paid vs unpaid (ADMIN-ONLY)
    paid = db.query(InternProfile).filter(InternProfile.is_paid == True).count()
    unpaid = db.query(InternProfile).filter(
        (InternProfile.is_paid == False) | (InternProfile.is_paid == None)
    ).count()

    # Ending soon
    ending_soon = db.query(InternProfile).filter(
        InternProfile.end_date.between(today, in_30_days),
        InternProfile.status == InternStatus.ACTIVE,
    ).count()

    # By department
    by_dept = db.query(
        Department.name, func.count(InternProfile.id)
    ).join(InternProfile, InternProfile.department_id == Department.id, isouter=True) \
     .group_by(Department.name).all()

    # Task stats
    total_tasks = db.query(Task).count()
    completed_tasks = db.query(Task).filter(Task.status == TaskStatus.COMPLETED).count()
    in_progress_tasks = db.query(Task).filter(Task.status == TaskStatus.IN_PROGRESS).count()
    blocked_tasks = db.query(Task).filter(Task.status == TaskStatus.BLOCKED).count()

    # Overdue (computed)
    all_open_tasks = db.query(Task).filter(
        Task.status != TaskStatus.COMPLETED,
        Task.due_date < today,
    ).count()

    # Stipend summary (ADMIN-ONLY)
    stipend_total = db.query(func.sum(InternProfile.stipend_amount)).scalar() or 0

    return {
        "interns": {
            "total": total,
            "active": active,
            "alumni": alumni,
            "inactive": inactive,
            "paid": paid,
            "unpaid": unpaid,
            "ending_soon_30_days": ending_soon,
        },
        "by_department": [{"name": name, "count": count} for name, count in by_dept],
        "tasks": {
            "total": total_tasks,
            "completed": completed_tasks,
            "in_progress": in_progress_tasks,
            "blocked": blocked_tasks,
            "overdue": all_open_tasks,
            "completion_rate": round(completed_tasks / total_tasks * 100, 1) if total_tasks else 0,
        },
        "financial": {
            "total_monthly_stipend": float(stipend_total),
            "paid_interns": paid,
            "unpaid_interns": unpaid,
        },
    }


# ─── User management ───────────────────────────────────────────────────────────
@router.get("/users", response_model=List[UserOut])
def list_users(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    users = db.query(User).all()
    return [UserOut.model_validate(u) for u in users]


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    body: UserCreateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin creates a Manager or Admin user account."""
    if not is_allowed_domain(body.company_email):
        raise HTTPException(status_code=400, detail="Only @talakunchi.com and @talakunchi.in emails are permitted.")


    existing = db.query(User).filter(User.company_email == body.company_email.lower()).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already exists.")

    role_map = {"ADMIN": UserRole.ADMIN, "MANAGER": UserRole.MANAGER, "INTERN": UserRole.INTERN}
    role = role_map.get(body.role.upper())
    if not role:
        raise HTTPException(status_code=400, detail="Invalid role.")

    user = User(
        company_email=body.company_email.lower(),
        full_name=body.full_name,
        role=role,
        is_active=True,
        password_hash=hash_password(body.initial_password) if body.initial_password else None,
    )
    db.add(user)
    log_action(db, str(current_user.id), AuditAction.USER_CREATED,
               metadata={"email": body.company_email, "role": body.role})
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.get("/managers")
def list_managers(
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):

    """Admin: list all managers (for assignment dropdowns)."""
    managers = db.query(User).filter(
        User.role == UserRole.MANAGER,
        User.is_active == True,
    ).all()
    return [{"id": str(m.id), "full_name": m.full_name, "company_email": m.company_email}
            for m in managers]


# ─── Data export (Admin-only) ──────────────────────────────────────────────────
@router.get("/export/interns")
def export_interns_csv(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin-only: export all intern data as CSV (includes sensitive fields)."""
    from app.services.crypto_service import decrypt_optional

    profiles = db.query(InternProfile).join(User, InternProfile.user_id == User.id).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Full Name", "Company Email", "New TK ID", "Old TK ID", "Department",
        "Reporting Manager", "Title", "Category", "Location", "Internship Type",
        "Duration", "Joining Date", "End Date", "Status",
        "Personal Email", "Marital Status", "Stipend Amount", "Stipend Type",
        "Is Paid", "Bank Name", "Bank IFSC", "Bank Account (Encrypted)",
        "Remarks",
    ])

    for p in profiles:
        writer.writerow([
            p.user.full_name if p.user else "",
            p.user.company_email if p.user else "",
            p.new_tk_id or "",
            p.old_tk_id or "",
            p.department.name if p.department else "",
            p.reporting_manager.full_name if p.reporting_manager else "",
            p.title or "",
            p.category or "",
            p.location or "",
            p.internship_type or "",
            p.duration or "",
            str(p.joining_date) if p.joining_date else "",
            str(p.end_date) if p.end_date else "",
            p.status.value if p.status else "",
            p.personal_email or "",
            p.marital_status or "",
            str(p.stipend_amount) if p.stipend_amount else "",
            p.stipend_type or "",
            str(p.is_paid) if p.is_paid is not None else "",
            p.bank_name or "",
            p.bank_ifsc or "",
            decrypt_optional(p.bank_account_number_encrypted) or "",
            p.remarks or "",
        ])

    log_action(db, str(current_user.id), AuditAction.EXPORT_DATA,
               metadata={"type": "intern_csv", "count": len(profiles)})
    db.commit()

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=interns_export.csv"},
    )
