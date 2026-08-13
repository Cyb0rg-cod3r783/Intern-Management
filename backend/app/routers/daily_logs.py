import uuid
from datetime import date, datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_

from app.database import get_db
from app.models import User, UserRole, InternProfile, Task, Project, Department, DailyWorkLog, DailyWorkLogEntry
from app.models.enums import InternStatus, TaskStatus
from app.middleware.rbac import get_current_user, require_manager, require_admin
from app.schemas.daily_log import (
    DailyLogCreateRequest, DailyLogOut, DailyLogEntryOut, DepartmentDailyLogSummaryOut
)
from app.services.notification_service import notify
from app.services.audit_service import log_action

router = APIRouter(prefix="/daily-logs", tags=["Daily Work Logs"])


def _build_log_out(log: DailyWorkLog) -> DailyLogOut:
    entries_out = []
    for e in log.entries:
        entries_out.append(DailyLogEntryOut(
            id=e.id,
            task_id=e.task_id,
            task_title=e.task.title if e.task else None,
            project_id=e.project_id,
            project_name=e.project.name if e.project else None,
            hours_spent=e.hours_spent,
            description=e.description,
            evidence_link=e.evidence_link,
            created_at=e.created_at,
        ))

    return DailyLogOut(
        id=log.id,
        intern_id=log.intern_id,
        intern_name=log.intern.full_name if log.intern else "Unknown",
        intern_email=log.intern.company_email if log.intern else "",
        department_id=log.department_id,
        department_name=log.department.name if log.department else None,
        log_date=log.log_date,
        total_hours=log.total_hours,
        summary_notes=log.summary_notes,
        created_at=log.created_at,
        updated_at=log.updated_at,
        entries=entries_out,
    )


# ─── POST /daily-logs (Create / Update Daily Log) ──────────────────────────────
@router.post("/", response_model=DailyLogOut)
def submit_daily_log(
    body: DailyLogCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Intern / Manager: Submit or update daily work log.
    Allows task hour allocations and status updates.
    """
    log_d = body.log_date or date.today()
    if log_d > date.today():
        raise HTTPException(status_code=400, detail="Cannot submit work logs for future dates.")

    # Get user profile & department
    dept_id = current_user.department_id

    # Check for existing log on this date
    existing_log = (
        db.query(DailyWorkLog)
        .filter(DailyWorkLog.intern_id == current_user.id, DailyWorkLog.log_date == log_d)
        .first()
    )

    if existing_log:
        work_log = existing_log
        work_log.total_hours = body.total_hours
        work_log.summary_notes = body.summary_notes
        work_log.updated_at = datetime.utcnow()
        # Delete old entries and replace
        db.query(DailyWorkLogEntry).filter(DailyWorkLogEntry.work_log_id == work_log.id).delete()
    else:
        work_log = DailyWorkLog(
            intern_id=current_user.id,
            department_id=dept_id,
            log_date=log_d,
            total_hours=body.total_hours,
            summary_notes=body.summary_notes,
        )
        db.add(work_log)

    db.flush()

    # Process per-task entries
    for item in body.entries:
        # Determine project_id from task if not provided
        proj_id = item.project_id
        if item.task_id and not proj_id:
            t_obj = db.query(Task).filter(Task.id == item.task_id).first()
            if t_obj:
                proj_id = t_obj.project_id
                # Apply task status update if requested
                if item.new_task_status:
                    try:
                        st_enum = TaskStatus(item.new_task_status)
                        t_obj.status = st_enum
                        if st_enum == TaskStatus.COMPLETED and not t_obj.completed_date:
                            t_obj.completed_date = date.today()
                    except ValueError:
                        pass

        entry = DailyWorkLogEntry(
            work_log_id=work_log.id,
            task_id=item.task_id,
            project_id=proj_id,
            hours_spent=item.hours_spent,
            description=item.description,
            evidence_link=item.evidence_link,
        )
        db.add(entry)

    db.commit()

    log_action(db, str(current_user.id), "DAILY_LOG_SUBMITTED", "DailyWorkLog", str(work_log.id), {
        "log_date": log_d.isoformat(),
        "total_hours": body.total_hours,
        "entries_count": len(body.entries),
    })

    db.refresh(work_log)
    return _build_log_out(work_log)


# ─── GET /daily-logs/my (Intern History) ──────────────────────────────────────
@router.get("/my", response_model=List[DailyLogOut])
def get_my_daily_logs(
    limit: int = Query(30, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve history of daily work logs for the logged-in user."""
    logs = (
        db.query(DailyWorkLog)
        .options(
            joinedload(DailyWorkLog.entries).joinedload(DailyWorkLogEntry.task),
            joinedload(DailyWorkLog.entries).joinedload(DailyWorkLogEntry.project),
            joinedload(DailyWorkLog.department),
        )
        .filter(DailyWorkLog.intern_id == current_user.id)
        .order_by(DailyWorkLog.log_date.desc())
        .limit(limit)
        .all()
    )
    return [_build_log_out(l) for l in logs]


# ─── GET /daily-logs/intern/{intern_id} (Full Intern History for Manager/Admin) ─
@router.get("/intern/{intern_id}", response_model=List[DailyLogOut])
def get_intern_daily_log_history(
    intern_id: uuid.UUID,
    limit: int = Query(60, ge=1, le=200),
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """
    Manager / Admin: Retrieve complete history of daily work logs for a specific intern.
    Department-isolated for Managers.
    """
    target_user = db.query(User).filter(User.id == intern_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Intern user not found.")

    if current_user.role == UserRole.MANAGER and current_user.department_id:
        # Verify intern belongs to manager's department or management pool
        profile = db.query(InternProfile).filter(InternProfile.user_id == intern_id).first()
        if profile and profile.department_id != current_user.department_id and profile.reporting_manager_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied. Intern belongs to another department.")

    logs = (
        db.query(DailyWorkLog)
        .options(
            joinedload(DailyWorkLog.entries).joinedload(DailyWorkLogEntry.task),
            joinedload(DailyWorkLog.entries).joinedload(DailyWorkLogEntry.project),
            joinedload(DailyWorkLog.intern),
            joinedload(DailyWorkLog.department),
        )
        .filter(DailyWorkLog.intern_id == intern_id)
        .order_by(DailyWorkLog.log_date.desc())
        .limit(limit)
        .all()
    )
    return [_build_log_out(l) for l in logs]


# ─── GET /daily-logs/manager (Department Logs & Summary) ────────────────────────
@router.get("/manager")
def get_manager_daily_logs(
    log_date: Optional[date] = Query(None),
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """
    Manager / Admin: View department daily work log stream, team summary, and missing log flags.
    """
    target_date = log_date or date.today()
    dept_id = current_user.department_id if current_user.role == UserRole.MANAGER else None

    # Fetch active department interns
    profile_query = db.query(InternProfile).filter(InternProfile.status == InternStatus.ACTIVE)
    if dept_id:
        profile_query = profile_query.filter(
            or_(
                InternProfile.department_id == dept_id,
                InternProfile.reporting_manager_id == current_user.id
            )
        )
    profiles = profile_query.all()

    # Team log status for target_date
    summary_list = []
    missing_count = 0

    for p in profiles:
        log = (
            db.query(DailyWorkLog)
            .filter(DailyWorkLog.intern_id == p.user_id, DailyWorkLog.log_date == target_date)
            .first()
        )
        has_logged = log is not None
        if not has_logged:
            missing_count += 1

        summary_list.append({
            "intern_id": p.user_id,
            "profile_id": p.id,
            "intern_name": p.user.full_name if p.user else "Unknown",
            "company_email": p.user.company_email if p.user else "",
            "new_tk_id": p.new_tk_id,
            "has_logged_today": has_logged,
            "total_hours_today": log.total_hours if log else 0.0,
            "latest_log_date": target_date if has_logged else (log.log_date if log else None),
            "latest_log_id": log.id if log else None,
        })

    # Detailed logs for target_date
    log_query = db.query(DailyWorkLog).options(
        joinedload(DailyWorkLog.entries).joinedload(DailyWorkLogEntry.task),
        joinedload(DailyWorkLog.entries).joinedload(DailyWorkLogEntry.project),
        joinedload(DailyWorkLog.intern),
        joinedload(DailyWorkLog.department),
    ).filter(DailyWorkLog.log_date == target_date)

    if dept_id:
        log_query = log_query.filter(
            or_(
                DailyWorkLog.department_id == dept_id,
                DailyWorkLog.intern_id.in_([p.user_id for p in profiles])
            )
        )

    logs = log_query.order_by(DailyWorkLog.created_at.desc()).all()

    return {
        "target_date": target_date.isoformat(),
        "total_team_members": len(profiles),
        "logged_count": len(profiles) - missing_count,
        "missing_count": missing_count,
        "team_summary": summary_list,
        "logs": [_build_log_out(l) for l in logs],
    }


# ─── GET /daily-logs/admin (Company-wide Overview) ───────────────────────────
@router.get("/admin")
def get_admin_daily_logs(
    log_date: Optional[date] = Query(None),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Admin-only: Company-wide daily log timesheet analytics.
    """
    target_date = log_date or date.today()
    logs = (
        db.query(DailyWorkLog)
        .options(
            joinedload(DailyWorkLog.entries).joinedload(DailyWorkLogEntry.task),
            joinedload(DailyWorkLog.entries).joinedload(DailyWorkLogEntry.project),
            joinedload(DailyWorkLog.intern),
            joinedload(DailyWorkLog.department),
        )
        .filter(DailyWorkLog.log_date == target_date)
        .order_by(DailyWorkLog.created_at.desc())
        .all()
    )

    total_active_interns = db.query(func.count(InternProfile.id)).filter(InternProfile.status == InternStatus.ACTIVE).scalar() or 0
    total_hours = sum(l.total_hours for l in logs)

    return {
        "target_date": target_date.isoformat(),
        "total_active_interns": total_active_interns,
        "total_logged_today": len(logs),
        "total_hours_logged": round(total_hours, 1),
        "logs": [_build_log_out(l) for l in logs],
    }


# ─── POST /daily-logs/send-reminder/{intern_id} ─────────────────────────────
@router.post("/send-reminder/{intern_id}")
def send_daily_log_reminder(
    intern_id: uuid.UUID,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """
    Manager / Admin: Send a 1-click nudge reminder to an intern to submit their daily work log.
    """
    target_user = db.query(User).filter(User.id == intern_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Intern user not found.")

    today_str = date.today().strftime("%d %b %Y")
    notify(
        db=db,
        recipient_id=intern_id,
        title="Daily Work Log Reminder",
        message=f"Please log your work hours and task progress for today ({today_str}).",
        notification_type="DAILY_LOG_REMINDER",
        link="/intern/daily-logs",
    )

    db.commit()
    return {"success": True, "message": f"Reminder sent to {target_user.full_name}."}


# ─── POST /daily-logs/check-missing (Missing Log Trigger Routine) ───────────
@router.post("/check-missing")
def check_and_notify_missing_logs(
    target_date: Optional[date] = Query(None),
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """
    Scans active interns for missing daily work logs on target_date (defaults to today)
    and notifies reporting managers.
    """
    chk_date = target_date or date.today()
    active_profiles = db.query(InternProfile).filter(InternProfile.status == InternStatus.ACTIVE).all()

    notified_count = 0
    for profile in active_profiles:
        # Check if log exists
        has_log = (
            db.query(DailyWorkLog)
            .filter(DailyWorkLog.intern_id == profile.user_id, DailyWorkLog.log_date == chk_date)
            .first()
        ) is not None

        if not has_log and profile.reporting_manager_id:
            # Send notification to reporting manager
            mgr_id = profile.reporting_manager_id
            intern_name = profile.user.full_name if profile.user else "Intern"
            date_fmt = chk_date.strftime("%d %b %Y")

            notify(
                db=db,
                recipient_id=mgr_id,
                title=f"Missing Daily Log: {intern_name}",
                message=f"{intern_name} has not submitted their daily work log for {date_fmt}.",
                notification_type="MISSING_DAILY_LOG_ALERT",
                link="/manager/dashboard",
            )
            notified_count += 1

    db.commit()
    return {"success": True, "target_date": chk_date.isoformat(), "notified_managers_count": notified_count}
