"""
Admin router — analytics dashboard, user management, data export.
All endpoints require Admin role.
"""
from datetime import date, datetime, timedelta
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
import csv
import io
import uuid

from app.database import get_db
from app.models import User, UserRole, InternProfile, Task, Department, AuditAction, Notification, Handover, Project
from app.models.enums import InternStatus, TaskStatus
from app.middleware.rbac import require_admin, require_manager

from app.services.auth_service import hash_password, is_allowed_domain
from app.services.audit_service import log_action
from app.services.notification_service import notify_admins
from app.schemas.misc import UserCreateRequest, UserUpdateRequest, UserOut
from app.utils import parse_uuid

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

    # Paid vs unpaid (ADMIN-ONLY - filter ACTIVE interns accurately)
    active_interns = db.query(InternProfile).filter(InternProfile.status == InternStatus.ACTIVE).all()
    paid = 0
    unpaid = 0
    stipend_total = 0.0

    for profile in active_interns:
        stipend = float(profile.stipend_amount or 0.0)
        is_p = bool(profile.is_paid) or stipend > 0 or (profile.internship_type or "").lower() == "paid"
        if is_p:
            paid += 1
            stipend_total += stipend
        else:
            unpaid += 1

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


@router.get("/analytics/financial-overview")
def get_financial_overview(
    timeframe: str = Query("monthly", regex="^(monthly|quarterly|half_yearly|annually|custom)$"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    from datetime import datetime as dt

    multiplier = 1.0
    period_label = "Monthly (1 Month)"

    if timeframe == "quarterly":
        multiplier = 3.0
        period_label = "Quarterly (3 Months)"
    elif timeframe == "half_yearly":
        multiplier = 6.0
        period_label = "Half-Yearly (6 Months)"
    elif timeframe == "annually":
        multiplier = 12.0
        period_label = "Annually (12 Months)"
    elif timeframe == "custom" and start_date and end_date:
        try:
            d1 = dt.strptime(start_date, "%Y-%m-%d").date()
            d2 = dt.strptime(end_date, "%Y-%m-%d").date()
            if d2 >= d1:
                days = (d2 - d1).days + 1
                multiplier = round(days / 30.4375, 2)
                period_label = f"Custom ({d1.strftime('%b %d, %Y')} – {d2.strftime('%b %d, %Y')} • {days} days)"
        except Exception:
            multiplier = 1.0
            period_label = "Custom Range"

    active_interns = db.query(InternProfile).filter(InternProfile.status == InternStatus.ACTIVE).all()
    paid_count = 0
    unpaid_count = 0
    monthly_stipend_sum = 0.0

    for profile in active_interns:
        stipend = float(profile.stipend_amount or 0.0)
        is_p = bool(profile.is_paid) or stipend > 0 or (profile.internship_type or "").lower() == "paid"
        if is_p:
            paid_count += 1
            monthly_stipend_sum += stipend
        else:
            unpaid_count += 1

    calculated_timeframe_stipend = round(monthly_stipend_sum * multiplier, 2)

    return {
        "timeframe": timeframe,
        "period_label": period_label,
        "multiplier": multiplier,
        "total_active_interns": len(active_interns),
        "paid_interns": paid_count,
        "unpaid_interns": unpaid_count,
        "monthly_stipend_total": round(monthly_stipend_sum, 2),
        "calculated_stipend_total": calculated_timeframe_stipend,
        "average_stipend_per_paid_intern": round(monthly_stipend_sum / max(paid_count, 1), 2),
    }


@router.get("/analytics/ending-soon")
def get_ending_soon_interns(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Admin-only: Executive retention analytics for candidates whose tenure is ending soon.
    Returns candidates sorted by days remaining ascending with urgency metrics.
    """
    today = date.today()
    return _compute_ending_soon_interns(db, days=days)


def _compute_ending_soon_interns(db: Session, days: int = 30, department_id: Optional[Any] = None, manager_id: Optional[Any] = None):
    today = date.today()
    target_date = today + timedelta(days=days)

    query = db.query(InternProfile).filter(
        InternProfile.status == InternStatus.ACTIVE,
        InternProfile.end_date.isnot(None),
        InternProfile.end_date >= today,
        InternProfile.end_date <= target_date,
    )

    if department_id:
        if manager_id:
            query = query.filter(
                or_(
                    InternProfile.department_id == department_id,
                    InternProfile.reporting_manager_id == manager_id
                )
            )
        else:
            query = query.filter(InternProfile.department_id == department_id)

    active_ending_profiles = query.order_by(InternProfile.end_date.asc()).all()

    candidates = []
    critical_count_7 = 0
    paid_count = 0
    unpaid_count = 0
    ending_stipend_total = 0.0

    for profile in active_ending_profiles:
        days_rem = (profile.end_date - today).days if profile.end_date else 0
        urgency = "CRITICAL" if days_rem <= 7 else ("WARNING" if days_rem <= 15 else "INFO")
        if days_rem <= 7:
            critical_count_7 += 1

        stipend = float(profile.stipend_amount or 0.0)
        is_p = bool(profile.is_paid) or stipend > 0 or (profile.internship_type or "").lower() == "paid"

        if is_p:
            paid_count += 1
            ending_stipend_total += stipend
        else:
            unpaid_count += 1

        candidates.append({
            "id": profile.id,
            "user_id": profile.user_id,
            "full_name": profile.user.full_name if profile.user else "Unknown",
            "company_email": profile.user.company_email if profile.user else "",
            "new_tk_id": profile.new_tk_id,
            "old_tk_id": profile.old_tk_id,
            "category": profile.category or "intern",
            "internship_type": profile.internship_type or ("paid" if is_p else "unpaid"),
            "is_paid": is_p,
            "stipend_amount": stipend,
            "department_id": profile.department_id,
            "department_name": profile.department.name if profile.department else "Unassigned",
            "reporting_manager_name": profile.reporting_manager.full_name if profile.reporting_manager else "None",
            "joining_date": profile.joining_date.isoformat() if profile.joining_date else None,
            "end_date": profile.end_date.isoformat() if profile.end_date else None,
            "days_remaining": days_rem,
            "urgency_level": urgency,
        })

    return {
        "days_window": days,
        "total_ending": len(candidates),
        "critical_count_7_days": critical_count_7,
        "paid_ending_count": paid_count,
        "unpaid_ending_count": unpaid_count,
        "ending_stipend_total": round(ending_stipend_total, 2),
        "candidates": candidates,
    }


def _compute_project_task_health(db: Session, department_id: Optional[Any] = None):
    today = date.today()
    query = db.query(Project)
    if department_id:
        query = query.filter(
            or_(
                Project.department_id == department_id,
                Project.interns.any(User.department_id == department_id)
            )
        )
    projects = query.order_by(Project.created_at.desc()).all()

    project_health_list = []
    total_projects = len(projects)
    projects_on_track = 0
    projects_at_risk = 0
    projects_completed = 0

    total_tasks_all = 0
    completed_tasks_all = 0
    overdue_tasks_all = 0
    blocked_tasks_all = 0

    for p in projects:
        tasks = db.query(Task).filter(Task.project_id == p.id).all()
        total_p_tasks = len(tasks)
        completed_p_tasks = sum(1 for t in tasks if t.status == TaskStatus.COMPLETED)
        in_progress_p_tasks = sum(1 for t in tasks if t.status == TaskStatus.IN_PROGRESS)
        blocked_p_tasks = sum(1 for t in tasks if t.status == TaskStatus.BLOCKED)
        overdue_p_tasks = sum(1 for t in tasks if t.status != TaskStatus.COMPLETED and t.due_date and t.due_date < today)

        total_tasks_all += total_p_tasks
        completed_tasks_all += completed_p_tasks
        overdue_tasks_all += overdue_p_tasks
        blocked_tasks_all += blocked_p_tasks

        comp_rate = round(completed_p_tasks / total_p_tasks * 100, 1) if total_p_tasks > 0 else 0.0

        if total_p_tasks > 0 and completed_p_tasks == total_p_tasks:
            health = "COMPLETED"
            projects_completed += 1
        elif overdue_p_tasks > 0 or blocked_p_tasks > 0:
            health = "AT_RISK"
            projects_at_risk += 1
        else:
            health = "ON_TRACK"
            projects_on_track += 1

        team_count = len(p.interns) if p.interns else 0
        dept_name = p.department.name if p.department else "Unassigned"

        project_health_list.append({
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "department_name": dept_name,
            "team_count": team_count,
            "total_tasks": total_p_tasks,
            "completed_tasks": completed_p_tasks,
            "in_progress_tasks": in_progress_p_tasks,
            "blocked_tasks": blocked_p_tasks,
            "overdue_tasks": overdue_p_tasks,
            "completion_rate": comp_rate,
            "health_status": health,
        })

    # Standalone Tasks
    gen_query = db.query(Task).filter(Task.project_id.is_(None))
    if department_id:
        gen_query = gen_query.join(User, Task.intern_id == User.id).filter(User.department_id == department_id)
    general_tasks = gen_query.all()

    if general_tasks:
        gen_total = len(general_tasks)
        gen_completed = sum(1 for t in general_tasks if t.status == TaskStatus.COMPLETED)
        gen_in_progress = sum(1 for t in general_tasks if t.status == TaskStatus.IN_PROGRESS)
        gen_blocked = sum(1 for t in general_tasks if t.status == TaskStatus.BLOCKED)
        gen_overdue = sum(1 for t in general_tasks if t.status != TaskStatus.COMPLETED and t.due_date and t.due_date < today)

        total_tasks_all += gen_total
        completed_tasks_all += gen_completed
        overdue_tasks_all += gen_overdue
        blocked_tasks_all += gen_blocked

        gen_comp_rate = round(gen_completed / gen_total * 100, 1) if gen_total > 0 else 0.0
        gen_health = "AT_RISK" if (gen_overdue > 0 or gen_blocked > 0) else ("COMPLETED" if gen_completed == gen_total else "ON_TRACK")

        project_health_list.append({
            "id": "general",
            "name": "General / Standalone Tasks",
            "description": "Tasks not linked to a specific project squad",
            "department_name": "General",
            "team_count": 0,
            "total_tasks": gen_total,
            "completed_tasks": gen_completed,
            "in_progress_tasks": gen_in_progress,
            "blocked_tasks": gen_blocked,
            "overdue_tasks": gen_overdue,
            "completion_rate": gen_comp_rate,
            "health_status": gen_health,
        })

    overall_rate = round(completed_tasks_all / total_tasks_all * 100, 1) if total_tasks_all > 0 else 0.0

    return {
        "overall_projects": total_projects,
        "projects_on_track": projects_on_track,
        "projects_at_risk": projects_at_risk,
        "projects_completed": projects_completed,
        "total_tasks": total_tasks_all,
        "completed_tasks": completed_tasks_all,
        "overdue_tasks": overdue_tasks_all,
        "blocked_tasks": blocked_tasks_all,
        "overall_completion_rate": overall_rate,
        "projects": project_health_list,
    }


@router.get("/analytics/project-task-health")
def get_project_task_health(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Admin-only: Executive project & task execution health analytics.
    Calculates completion rate, overdue/blocked bottlenecks, and health status per project.
    """
    return _compute_project_task_health(db)


# ─── Manager-Scoped Analytics Endpoints ─────────────────────────────────────
@router.get("/manager/analytics/project-task-health")
def get_manager_project_task_health(
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """
    Manager/Admin: Department-scoped project & task execution health.
    """
    dept_id = current_user.department_id if current_user.role == UserRole.MANAGER else None
    return _compute_project_task_health(db, department_id=dept_id)


# ─── GET /admin/analytics/projects/{project_id} (Executive Project Intelligence) ──
@router.get("/analytics/projects/{project_id}")
def get_executive_project_intelligence(
    project_id: str,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """
    Admin / Executive / Manager: Deep Project Intelligence Analytics.
    Returns summary, phase, health status, monthly burn cost, total man-hours logged,
    per-contributor labor allocation breakdown, and task update metrics.
    """
    from app.models import Project, Task, TaskUpdate, DailyWorkLog, DailyWorkLogEntry, InternProfile, User
    from app.models.enums import InternStatus, TaskStatus

    p_uuid = parse_uuid(project_id, "project_id")
    project = db.query(Project).filter(Project.id == p_uuid).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    # Manager department check
    if current_user.role == UserRole.MANAGER and current_user.department_id:
        if project.department_id and project.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied to projects in other departments.")

    # Fetch tasks
    tasks = db.query(Task).filter(Task.project_id == p_uuid).all()
    task_ids = [t.id for t in tasks]
    total_tasks = len(tasks)
    completed_tasks = sum(1 for t in tasks if t.status == TaskStatus.COMPLETED)
    in_progress_tasks = sum(1 for t in tasks if t.status == TaskStatus.IN_PROGRESS)
    blocked_tasks = sum(1 for t in tasks if t.status == TaskStatus.BLOCKED)
    overdue_tasks = sum(1 for t in tasks if t.is_overdue)
    completion_rate = round((completed_tasks / total_tasks * 100), 1) if total_tasks > 0 else 0.0

    # Fetch TaskUpdates count
    total_updates = db.query(func.count(TaskUpdate.id)).filter(TaskUpdate.task_id.in_(task_ids)).scalar() if task_ids else 0

    # Fetch man-hours from DailyWorkLogEntry
    entries = db.query(DailyWorkLogEntry).join(DailyWorkLog, DailyWorkLogEntry.work_log_id == DailyWorkLog.id).filter(
        or_(
            DailyWorkLogEntry.project_id == p_uuid,
            DailyWorkLogEntry.task_id.in_(task_ids) if task_ids else False
        )
    ).all()

    total_man_hours = round(sum(e.hours_spent for e in entries), 1)

    # Per-contributor breakdown
    contributors_map = {}
    for intern in project.interns:
        prof = db.query(InternProfile).filter(InternProfile.user_id == intern.id).first()
        t_assigned = [t for t in tasks if str(t.intern_id) == str(intern.id)]
        t_comp = [t for t in t_assigned if t.status == TaskStatus.COMPLETED]
        
        # Hours logged by this intern on this project
        intern_hrs = sum(e.hours_spent for e in entries if e.work_log and str(e.work_log.intern_id) == str(intern.id))

        contributors_map[str(intern.id)] = {
            "intern_id": str(intern.id),
            "intern_name": intern.full_name,
            "company_email": intern.company_email,
            "new_tk_id": prof.new_tk_id if prof else None,
            "tasks_assigned": len(t_assigned),
            "tasks_completed": len(t_comp),
            "hours_logged": round(intern_hrs, 1),
            "effort_share_pct": round((intern_hrs / total_man_hours * 100), 1) if total_man_hours > 0 else 0.0,
            "monthly_stipend": float(prof.stipend_amount) if prof and prof.stipend_amount else 0.0,
        }

    contributors_list = list(contributors_map.values())

    # Financial Cost (Monthly burn rate for assigned active interns)
    monthly_burn_cost = sum(c["monthly_stipend"] for c in contributors_list)

    # Health status calculation
    if project.status == "COMPLETED" or (total_tasks > 0 and completed_tasks == total_tasks):
        health_status = "COMPLETED"
    elif overdue_tasks > 0 or blocked_tasks > 0:
        health_status = "AT_RISK"
    else:
        health_status = "ON_TRACK"

    # Recent updates feed
    recent_updates = []
    if task_ids:
        raw_updates = (
            db.query(TaskUpdate)
            .filter(TaskUpdate.task_id.in_(task_ids))
            .order_by(TaskUpdate.created_at.desc())
            .limit(10)
            .all()
        )
        for u in raw_updates:
            recent_updates.append({
                "id": str(u.id),
                "task_id": str(u.task_id),
                "task_title": u.task.title if u.task else None,
                "author_name": u.author.full_name if u.author else "System",
                "note": u.note,
                "created_at": u.created_at.isoformat(),
            })

    return {
        "id": str(project.id),
        "name": project.name,
        "description": project.description,
        "status": project.status,
        "phase": project.phase or "DEVELOPMENT",
        "health_status": health_status,
        "department_name": project.department.name if project.department else "Unassigned",
        "start_date": project.start_date.isoformat() if project.start_date else None,
        "target_end_date": project.target_end_date.isoformat() if project.target_end_date else None,
        "total_team_members": len(project.interns),
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "in_progress_tasks": in_progress_tasks,
        "blocked_tasks": blocked_tasks,
        "overdue_tasks": overdue_tasks,
        "completion_rate": completion_rate,
        "total_updates_count": total_updates,
        "total_man_hours_logged": total_man_hours,
        "monthly_burn_cost": round(monthly_burn_cost, 2),
        "contributors": contributors_list,
        "recent_updates": recent_updates,
    }


@router.get("/manager/analytics/ending-soon")
def get_manager_ending_soon_interns(
    days: int = 30,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """
    Manager/Admin: Department-scoped upcoming tenure completions.
    """
    dept_id = current_user.department_id if current_user.role == UserRole.MANAGER else None
    mgr_id = current_user.id if current_user.role == UserRole.MANAGER else None
    return _compute_ending_soon_interns(db, days=days, department_id=dept_id, manager_id=mgr_id)


@router.get("/analytics/project-costs")
def get_project_costs(
    timeframe: str = "monthly",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Admin-only: Per-project financial cost calculations.
    Calculates cost based on active interns assigned to projects and their stipend amounts.
    Supports timeframe: 'monthly', 'quarterly', 'half_yearly', 'annually', 'custom'.
    """
    from datetime import datetime as dt

    multiplier = 1.0
    period_label = "Monthly"

    if timeframe == "quarterly":
        multiplier = 3.0
        period_label = "Quarterly (3 Months)"
    elif timeframe == "half_yearly":
        multiplier = 6.0
        period_label = "Half-Yearly (6 Months)"
    elif timeframe == "annually":
        multiplier = 12.0
        period_label = "Annually (12 Months)"
    elif timeframe == "custom" and start_date and end_date:
        try:
            d1 = dt.strptime(start_date, "%Y-%m-%d").date()
            d2 = dt.strptime(end_date, "%Y-%m-%d").date()
            if d2 >= d1:
                days = (d2 - d1).days + 1
                multiplier = round(days / 30.4375, 2)
                period_label = f"Custom ({d1.strftime('%b %d, %Y')} – {d2.strftime('%b %d, %Y')} • {days} days)"
        except Exception:
            multiplier = 1.0
            period_label = "Custom Range"

    projects = db.query(Project).all()
    project_cost_list = []
    total_timeframe_cost = 0.0
    total_monthly_cost = 0.0

    for p in projects:
        assigned_interns = []
        project_monthly_stipend = 0.0

        for u in p.interns:
            profile = u.intern_profile
            if profile and profile.status == InternStatus.ACTIVE:
                stipend = float(profile.stipend_amount or 0.0)
                project_monthly_stipend += stipend
                assigned_interns.append({
                    "id": str(profile.id),
                    "user_id": str(u.id),
                    "full_name": u.full_name,
                    "company_email": u.company_email,
                    "stipend_amount": stipend,
                    "is_paid": bool(profile.is_paid),
                })

        timeframe_cost = round(project_monthly_stipend * multiplier, 2)
        total_monthly_cost += project_monthly_stipend
        total_timeframe_cost += timeframe_cost

        project_cost_list.append({
            "id": str(p.id),
            "name": p.name,
            "description": p.description,
            "status": p.status.value if hasattr(p.status, "value") else str(p.status),
            "department_id": str(p.department_id) if p.department_id else None,
            "department_name": p.department.name if p.department else "Company-wide",
            "interns_count": len(assigned_interns),
            "monthly_cost": project_monthly_stipend,
            "calculated_cost": timeframe_cost,
            "assigned_interns": assigned_interns,
        })

    project_cost_list.sort(key=lambda x: x["calculated_cost"], reverse=True)

    return {
        "timeframe": timeframe,
        "period_label": period_label,
        "multiplier": multiplier,
        "total_projects": len(projects),
        "total_monthly_cost": total_monthly_cost,
        "total_timeframe_cost": total_timeframe_cost,
        "average_project_cost": round(total_timeframe_cost / len(projects), 2) if projects else 0.0,
        "projects": project_cost_list,
    }


@router.get("/analytics/department-costs")
def get_department_costs(
    timeframe: str = Query("monthly", regex="^(monthly|quarterly|half_yearly|annually|custom)$"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    from datetime import datetime as dt

    multiplier = 1.0
    period_label = "Monthly (1 Month)"

    if timeframe == "quarterly":
        multiplier = 3.0
        period_label = "Quarterly (3 Months)"
    elif timeframe == "half_yearly":
        multiplier = 6.0
        period_label = "Half-Yearly (6 Months)"
    elif timeframe == "annually":
        multiplier = 12.0
        period_label = "Annually (12 Months)"
    elif timeframe == "custom" and start_date and end_date:
        try:
            d1 = dt.strptime(start_date, "%Y-%m-%d").date()
            d2 = dt.strptime(end_date, "%Y-%m-%d").date()
            if d2 >= d1:
                days = (d2 - d1).days + 1
                multiplier = round(days / 30.4375, 2)
                period_label = f"Custom ({d1.strftime('%b %d, %Y')} – {d2.strftime('%b %d, %Y')} • {days} days)"
        except Exception:
            multiplier = 1.0
            period_label = "Custom Range"

    departments = db.query(Department).all()
    department_cost_list = []
    total_timeframe_cost = 0.0
    total_monthly_cost = 0.0
    total_active_interns = 0

    for d in departments:
        assigned_interns = []
        dept_monthly_stipend = 0.0

        for profile in d.interns:
            if profile and profile.status == InternStatus.ACTIVE:
                stipend = float(profile.stipend_amount or 0.0)
                dept_monthly_stipend += stipend
                u = profile.user
                assigned_interns.append({
                    "id": str(profile.id),
                    "user_id": str(u.id) if u else None,
                    "full_name": u.full_name if u else "Unknown",
                    "company_email": u.company_email if u else "",
                    "new_tk_id": profile.new_tk_id,
                    "stipend_amount": stipend,
                    "is_paid": bool(profile.is_paid),
                })

        timeframe_cost = round(dept_monthly_stipend * multiplier, 2)
        total_monthly_cost += dept_monthly_stipend
        total_timeframe_cost += timeframe_cost
        total_active_interns += len(assigned_interns)

        department_cost_list.append({
            "id": str(d.id),
            "name": d.name,
            "description": d.description,
            "is_active": d.is_active,
            "interns_count": len(assigned_interns),
            "monthly_cost": dept_monthly_stipend,
            "calculated_cost": timeframe_cost,
            "assigned_interns": assigned_interns,
        })

    # Active interns not assigned to a specific department (Unassigned / General)
    unassigned_profiles = db.query(InternProfile).filter(
        InternProfile.department_id.is_(None),
        InternProfile.status == InternStatus.ACTIVE
    ).all()

    if unassigned_profiles:
        assigned_interns = []
        dept_monthly_stipend = 0.0
        for profile in unassigned_profiles:
            stipend = float(profile.stipend_amount or 0.0)
            dept_monthly_stipend += stipend
            u = profile.user
            assigned_interns.append({
                "id": str(profile.id),
                "user_id": str(u.id) if u else None,
                "full_name": u.full_name if u else "Unknown",
                "company_email": u.company_email if u else "",
                "new_tk_id": profile.new_tk_id,
                "stipend_amount": stipend,
                "is_paid": bool(profile.is_paid),
            })
        timeframe_cost = round(dept_monthly_stipend * multiplier, 2)
        total_monthly_cost += dept_monthly_stipend
        total_timeframe_cost += timeframe_cost
        total_active_interns += len(assigned_interns)

        department_cost_list.append({
            "id": "unassigned",
            "name": "Unassigned / General",
            "description": "Interns not assigned to a specific department",
            "is_active": True,
            "interns_count": len(assigned_interns),
            "monthly_cost": dept_monthly_stipend,
            "calculated_cost": timeframe_cost,
            "assigned_interns": assigned_interns,
        })

    department_cost_list.sort(key=lambda x: x["calculated_cost"], reverse=True)

    return {
        "timeframe": timeframe,
        "period_label": period_label,
        "multiplier": multiplier,
        "total_departments": len(department_cost_list),
        "total_active_interns": total_active_interns,
        "total_monthly_cost": round(total_monthly_cost, 2),
        "total_timeframe_cost": round(total_timeframe_cost, 2),
        "average_department_cost": round(total_timeframe_cost / max(len(department_cost_list), 1), 2),
        "departments": department_cost_list,
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
        department_id=body.department_id,
        password_hash=hash_password(body.initial_password) if body.initial_password else None,
    )
    db.add(user)
    log_action(db, str(current_user.id), AuditAction.USER_CREATED,
               metadata={"email": body.company_email, "role": body.role})
    db.commit()
    db.refresh(user)

    # Trigger: Account Created Alert to Admins
    notify_admins(
        db, "New Account Created",
        f"New {user.role.value} account created for {user.company_email} ({user.full_name}).",
        "ACCOUNT_CREATED", "/admin/managers"
    )
    db.commit()

    return UserOut.model_validate(user)


@router.put("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: str,
    body: UserUpdateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin only: edit a user account (Name, Email, Role, Department, Active status)."""
    user = db.query(User).filter(User.id == parse_uuid(user_id, "user_id")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if body.company_email and body.company_email.lower() != user.company_email:
        new_email = body.company_email.lower()
        if not is_allowed_domain(new_email):
            raise HTTPException(status_code=400, detail="Only @talakunchi.com and @talakunchi.in emails are permitted.")
        existing = db.query(User).filter(User.company_email == new_email).first()
        if existing:
            raise HTTPException(status_code=409, detail="Email is already in use by another account.")
        user.company_email = new_email

    if body.full_name is not None:
        user.full_name = body.full_name

    if body.role is not None:
        role_map = {"ADMIN": UserRole.ADMIN, "MANAGER": UserRole.MANAGER, "INTERN": UserRole.INTERN}
        r = role_map.get(body.role.upper())
        if not r:
            raise HTTPException(status_code=400, detail="Invalid role.")
        user.role = r

    if body.department_id is not None:
        user.department_id = body.department_id

    if body.is_active is not None:
        user.is_active = body.is_active

    log_action(db, str(current_user.id), AuditAction.UPDATE_USER,
               target_type="user", target_id=user_id,
               metadata={"email": user.company_email, "action": "update_user"})
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.delete("/users/{user_id}", status_code=status.HTTP_200_OK)
def delete_user(
    user_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin only: delete a Manager or Admin user account permanently."""
    from app.models import InternApprovalRequest
    user = db.query(User).filter(User.id == parse_uuid(user_id, "user_id")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if str(user.id) == str(current_user.id):
        raise HTTPException(status_code=400, detail="You cannot delete your own account.")

    # Unlink references to prevent FK constraint failures
    db.query(InternProfile).filter(InternProfile.reporting_manager_id == user.id).update({"reporting_manager_id": None})
    db.query(Task).filter(Task.assigned_by_id == user.id).update({"assigned_by_id": None})
    db.query(InternApprovalRequest).filter(
        (InternApprovalRequest.requested_by_id == user.id) | (InternApprovalRequest.assigned_manager_id == user.id)
    ).delete(synchronize_session=False)

    log_action(db, str(current_user.id), AuditAction.USER_DELETED,
               target_type="user", target_id=user_id,
               metadata={"email": user.company_email, "role": user.role.value if hasattr(user.role, 'value') else str(user.role)})

    db.delete(user)
    db.commit()
    return {"message": "User account deleted successfully."}


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
    return [{"id": str(m.id), "full_name": m.full_name, "company_email": m.company_email,
             "department_id": str(m.department_id) if m.department_id else None}
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


# ─── Bulk Import & Template ────────────────────────────────────────────────────
REQUIRED_BULK_COLUMNS = [
    "full_name", "company_email", "tk_id", "joining_date", "end_date",
    "duration", "department", "manager_email", "category", "internship_type",
    "location", "remarks", "personal_email", "personal_phone", "stipend_amount",
    "initial_password"
]

MAX_BULK_FILE_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_BULK_ROWS = 2000


@router.get("/export/bulk-template")
def download_bulk_template(current_user: User = Depends(require_admin)):
    """Download a pre-formatted CSV template with all 16 required column headers."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(REQUIRED_BULK_COLUMNS)
    writer.writerow([
        "Rahul Shah", "rahul.shah@talakunchi.in", "TK-2026-001", "2026-08-01", "2026-10-30",
        "3 Months", "Squad1 R&D", "sam.boston@talakunchi.in", "intern", "paid",
        "Mumbai", "Batch 2026 Onboarding", "rahul.personal@gmail.com", "+919876543210", "15000",
        "Welcome@123"
    ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=interns_bulk_template.csv"},
    )


@router.post("/interns/bulk-import")
async def bulk_import_interns(
    file: UploadFile = File(...),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Bulk import interns from a CSV or Excel file.
    ALL 16 COLUMNS ARE STRICTLY REQUIRED.
    """
    filename = file.filename.lower()
    contents = await file.read()

    if len(contents) > MAX_BULK_FILE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(contents) // 1024} KB). Maximum allowed size is {MAX_BULK_FILE_BYTES // (1024 * 1024)} MB.",
        )

    rows = []
    if filename.endswith(".csv"):
        text = contents.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        for r in reader:
            rows.append({(k or "").replace('\xa0', ' ').strip().lower(): (v or "").replace('\xa0', ' ').strip() for k, v in r.items()})
    elif filename.endswith(".xlsx") or filename.endswith(".xls"):
        try:
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
            sheet = wb.active
            data = list(sheet.iter_rows(values_only=True))
            if not data:
                raise HTTPException(status_code=400, detail="Excel file is empty.")
            headers = [str(h).strip().lower() if h is not None else "" for h in data[0]]
            for r in data[1:]:
                if any(r):
                    row_dict = {headers[i]: (str(r[i]).replace('\xa0', ' ').strip() if i < len(r) and r[i] is not None else "") for i in range(len(headers))}
                    rows.append(row_dict)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse Excel file: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail="Only .csv and .xlsx files are supported.")

    if not rows:
        raise HTTPException(status_code=400, detail="File contains no data rows.")

    if len(rows) > MAX_BULK_ROWS:
        raise HTTPException(
            status_code=400,
            detail=f"File contains {len(rows)} rows, exceeding the maximum of {MAX_BULK_ROWS} per import. Split into smaller batches.",
        )

    # 1. Validate all 16 column headers are present
    first_row_headers = [k.strip().lower() for k in rows[0].keys()]
    missing_headers = [col for col in REQUIRED_BULK_COLUMNS if col not in first_row_headers]
    if missing_headers:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required column headers: {', '.join(missing_headers)}. All 16 columns are strictly required."
        )

    # Pre-fetch departments & managers
    all_depts = db.query(Department).all()
    dept_map = {d.name.strip().lower(): d for d in all_depts}
    dept_id_map = {str(d.id): d for d in all_depts}

    all_managers = db.query(User).filter(User.role.in_([UserRole.MANAGER, UserRole.ADMIN])).all()
    manager_map = {m.company_email.strip().lower(): m for m in all_managers}

    existing_emails = {u.company_email.strip().lower() for u in db.query(User.company_email).all()}

    errors = []
    validated_data = []

    # 2. Row by Row Validation
    for idx, r in enumerate(rows, start=2):  # 1-indexed row number (header is row 1)
        row_errors = []

        full_name = r.get("full_name", "").strip()
        company_email = r.get("company_email", "").strip().lower()
        tk_id = r.get("tk_id", "").strip()
        joining_date_str = r.get("joining_date", "").strip()
        end_date_str = r.get("end_date", "").strip()
        duration = r.get("duration", "").strip()
        dept_name = r.get("department", "").strip()
        manager_email = r.get("manager_email", "").strip().lower()
        category = r.get("category", "").strip().lower()
        internship_type = r.get("internship_type", "").strip().lower()
        location = r.get("location", "").strip()
        remarks = r.get("remarks", "").strip()
        personal_email = r.get("personal_email", "").strip()
        personal_phone = r.get("personal_phone", "").strip()
        stipend_amount_str = r.get("stipend_amount", "").strip()
        initial_password = r.get("initial_password", "").strip()

        # Check required non-empty cells for all 16 columns
        empty_fields = []
        for col in REQUIRED_BULK_COLUMNS:
            if not r.get(col, "").strip():
                empty_fields.append(col)
        if empty_fields:
            row_errors.append(f"Missing values for column(s): {', '.join(empty_fields)}")

        if company_email:
            if not (company_email.endswith("@talakunchi.com") or company_email.endswith("@talakunchi.in")):
                row_errors.append(f"Invalid email domain for '{company_email}'. Must end in @talakunchi.com or @talakunchi.in")
            elif company_email in existing_emails:
                row_errors.append(f"Email '{company_email}' already exists in the system")

        # Resolve department
        dept_obj = None
        if dept_name:
            dept_obj = dept_map.get(dept_name.lower()) or dept_id_map.get(dept_name)
            if not dept_obj:
                row_errors.append(f"Department '{dept_name}' not found")

        # Resolve manager
        mgr_obj = None
        if manager_email:
            mgr_obj = manager_map.get(manager_email.lower())
            if not mgr_obj:
                row_errors.append(f"Manager with email '{manager_email}' not found")

        # Category validation
        if category and category not in ("trainee", "contract", "intern"):
            row_errors.append(f"Invalid category '{category}'. Must be one of: trainee, contract, intern")

        # Internship type validation
        if internship_type and internship_type not in ("paid", "unpaid"):
            row_errors.append(f"Invalid internship_type '{internship_type}'. Must be paid or unpaid")

        # Stipend conversion
        stipend_val = 0.0
        if internship_type == "unpaid":
            stipend_val = 0.0
        elif stipend_amount_str:
            try:
                stipend_val = float(stipend_amount_str)
            except ValueError:
                row_errors.append(f"Invalid stipend amount '{stipend_amount_str}'")

        # Dates validation
        j_date, e_date = None, None
        if joining_date_str:
            try:
                j_date = datetime.strptime(joining_date_str[:10], "%Y-%m-%d").date()
            except ValueError:
                try:
                    j_date = datetime.strptime(joining_date_str[:10], "%d/%m/%Y").date()
                except ValueError:
                    row_errors.append(f"Invalid joining_date '{joining_date_str}'. Use YYYY-MM-DD")
        if end_date_str:
            try:
                e_date = datetime.strptime(end_date_str[:10], "%Y-%m-%d").date()
            except ValueError:
                try:
                    e_date = datetime.strptime(end_date_str[:10], "%d/%m/%Y").date()
                except ValueError:
                    row_errors.append(f"Invalid end_date '{end_date_str}'. Use YYYY-MM-DD")

        if row_errors:
            errors.append({"row": idx, "email": company_email or "Line " + str(idx), "errors": row_errors})
        else:
            validated_data.append({
                "full_name": full_name,
                "company_email": company_email,
                "new_tk_id": tk_id,
                "joining_date": j_date,
                "end_date": e_date,
                "duration": duration,
                "department_id": dept_obj.id if dept_obj else None,
                "reporting_manager_id": mgr_obj.id if mgr_obj else None,
                "category": category,
                "internship_type": internship_type,
                "location": location,
                "remarks": remarks,
                "personal_email": personal_email,
                "personal_phone": personal_phone,
                "stipend_amount": stipend_val,
                "initial_password": initial_password,
            })
            existing_emails.add(company_email)

    if errors:
        return {
            "success": False,
            "total_rows": len(rows),
            "valid_rows": len(validated_data),
            "error_rows": len(errors),
            "errors": errors,
            "message": f"Validation failed for {len(errors)} row(s). Correct the errors and try again."
        }

    # 3. Batch Create Records
    from app.models.intern_approval_request import InternApprovalRequest
    from app.models.enums import InternStatus as IS
    from app.services.notification_service import notify

    created_count = 0
    for item in validated_data:
        u = User(
            company_email=item["company_email"],
            full_name=item["full_name"],
            role=UserRole.INTERN,
            is_active=True,
            password_hash=hash_password(item["initial_password"]) if item["initial_password"] else None,
        )
        db.add(u)
        db.flush()

        # Match single-intern logic: PENDING_APPROVAL if dept/manager given
        initial_status = IS.PENDING_APPROVAL if (item["department_id"] or item["reporting_manager_id"]) else IS.ACTIVE

        prof = InternProfile(
            user_id=u.id,
            new_tk_id=item["new_tk_id"],
            department_id=item["department_id"],
            reporting_manager_id=item["reporting_manager_id"],
            category=item["category"],
            location=item["location"],
            internship_type=item["internship_type"],
            duration=item["duration"],
            joining_date=item["joining_date"],
            end_date=item["end_date"],
            remarks=item["remarks"],
            personal_email=item["personal_email"],
            personal_phone=item["personal_phone"],
            stipend_amount=item["stipend_amount"],
            status=initial_status,
        )
        db.add(prof)
        db.flush()

        # Create approval request if dept/manager assigned
        if initial_status == IS.PENDING_APPROVAL:
            approval_req = InternApprovalRequest(
                intern_id=prof.id,
                request_type="ONBOARDING",
                target_department_id=item["department_id"],
                requested_by_id=current_user.id,
                assigned_manager_id=item["reporting_manager_id"],
                status="PENDING",
            )
            db.add(approval_req)
            # Notify the assigned manager
            if item["reporting_manager_id"]:
                notify(
                    db, item["reporting_manager_id"],
                    "New Intern Onboarding Request",
                    f"New intern '{u.full_name}' was bulk-imported. Please review and accept/decline.",
                    "APPROVAL_REQUEST", "/manager/dashboard"
                )

        created_count += 1

    log_action(db, str(current_user.id), AuditAction.USER_CREATED,
               metadata={"type": "bulk_import", "count": created_count})
    notify_admins(db, "Bulk Intern Import Completed",
                  f"{created_count} new intern accounts were imported by {current_user.full_name}.",
                  "ACCOUNT_CREATED", "/admin/interns")
    db.commit()

    return {
        "success": True,
        "created_count": created_count,
        "message": f"Successfully imported {created_count} interns!"
    }


# ─── Bulk Delete Interns ───────────────────────────────────────────────────────
@router.post("/interns/bulk-delete", status_code=status.HTTP_200_OK)
def bulk_delete_interns(
    payload: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin only: bulk delete multiple interns permanently."""
    from app.routers.interns import _delete_intern_cascading

    user_ids = payload.get("user_ids", [])
    if not user_ids:
        raise HTTPException(status_code=400, detail="No user IDs provided for bulk deletion.")

    deleted_count = 0
    for uid in user_ids:
        target_uid_str = str(uid)
        _delete_intern_cascading(db, target_uid_str)
        deleted_count += 1

    log_action(db, str(current_user.id), AuditAction.USER_DELETED,
               metadata={"type": "bulk_delete", "count": deleted_count})
    notify_admins(db, "Bulk Intern Deletion Completed",
                  f"{deleted_count} intern account(s) were permanently deleted by {current_user.full_name}.",
                  "ACCOUNT_DELETED", "/admin/interns")

    db.commit()
    return {
        "success": True,
        "deleted_count": deleted_count,
        "message": f"Successfully deleted {deleted_count} intern(s)."
    }
