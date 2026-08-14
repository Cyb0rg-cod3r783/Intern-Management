import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from datetime import date

from app.database import get_db
from app.models import User, UserRole, Task, TaskUpdate, InternProfile, AuditAction, project_interns
from app.models.enums import TaskStatus, TaskApprovalStatus
from app.schemas.task import TaskOut, TaskUpdateOut, TaskCreateRequest, TaskUpdateRequest, TaskProgressUpdateRequest, TaskRejectRequest
from app.middleware.rbac import (
    get_current_user, require_admin_or_manager,
    assert_can_manage_task,
)
from app.services.audit_service import log_action
from app.services.notification_service import notify, notify_admins
from app.utils import parse_uuid

router = APIRouter(prefix="/tasks", tags=["Tasks"])


def _build_task_out(task: Task) -> TaskOut:
    out = TaskOut.model_validate(task)
    out.intern_name = task.intern.full_name if task.intern else ""
    out.assigned_by_name = task.assigned_by.full_name if task.assigned_by else ""
    out.project_name = task.project.name if task.project else ""
    out.is_overdue = task.is_overdue
    out.updates = [
        TaskUpdateOut(
            id=u.id,
            task_id=u.task_id,
            author_id=u.author_id,
            author_name=u.author.full_name if u.author else "",
            note=u.note,
            created_at=u.created_at,
        )
        for u in task.updates
    ]
    return out


def _load_task(db: Session, task_id: str) -> Task:
    task = (
        db.query(Task)
        .options(
            joinedload(Task.intern),
            joinedload(Task.assigned_by),
            joinedload(Task.project),
            joinedload(Task.updates).joinedload(TaskUpdate.author),
        )
        .filter(Task.id == parse_uuid(task_id, "task_id"))
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    return task


def _get_intern_profile(db: Session, intern_id: str) -> InternProfile:
    profile = db.query(InternProfile).filter(
        InternProfile.user_id == parse_uuid(intern_id, "intern_id")
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Intern profile not found.")
    return profile


# ─── GET /tasks ────────────────────────────────────────────────────────────────
@router.get("/", response_model=List[TaskOut])
def list_tasks(
    intern_id: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    priority: Optional[str] = Query(None),
    overdue_only: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = (
        db.query(Task)
        .options(
            joinedload(Task.intern),
            joinedload(Task.assigned_by),
            joinedload(Task.updates).joinedload(TaskUpdate.author),
        )
    )

    if current_user.role == UserRole.INTERN:
        # Intern: own tasks only
        query = query.filter(Task.intern_id == current_user.id)
    elif current_user.role == UserRole.MANAGER:
        # Manager: only tasks for interns in their department or directly reporting to them
        query = query.join(InternProfile, Task.intern_id == InternProfile.user_id)
        if current_user.department_id:
            query = query.filter(
                or_(
                    InternProfile.department_id == current_user.department_id,
                    InternProfile.reporting_manager_id == current_user.id,
                )
            )
        else:
            query = query.filter(InternProfile.reporting_manager_id == current_user.id)
        if intern_id:
            query = query.filter(Task.intern_id == parse_uuid(intern_id, "intern_id"))
    elif intern_id:
        query = query.filter(Task.intern_id == parse_uuid(intern_id, "intern_id"))

    if status_filter:
        query = query.filter(Task.status == status_filter)
    if priority:
        query = query.filter(Task.priority == priority)

    tasks = query.all()

    if overdue_only:
        tasks = [t for t in tasks if t.is_overdue]

    return [_build_task_out(t) for t in tasks]


# ─── GET /tasks/{task_id} ──────────────────────────────────────────────────────
@router.get("/{task_id}", response_model=TaskOut)
def get_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = _load_task(db, task_id)

    if current_user.role == UserRole.INTERN:
        if str(task.intern_id) != str(current_user.id):
            raise HTTPException(status_code=403, detail="You can only view your own tasks.")
    elif current_user.role == UserRole.MANAGER:
        intern_profile = _get_intern_profile(db, str(task.intern_id))
        is_own_dept = bool(current_user.department_id) and intern_profile.department_id == current_user.department_id
        is_own_intern = str(intern_profile.reporting_manager_id) == str(current_user.id)
        if not (is_own_dept or is_own_intern):
            raise HTTPException(status_code=403, detail="You can only view tasks for interns in your department or assigned to you.")

    return _build_task_out(task)


# ─── POST /tasks ───────────────────────────────────────────────────────────────
@router.post("/", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(
    request: Request,
    body: TaskCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    is_self_assign = current_user.role == UserRole.INTERN

    if is_self_assign:
        # Intern can only self-assign, cannot set due_date, and must tie the
        # task to a project they're actually on — mirrors the real workflow:
        # interns divide up the work amongst themselves and send it to their
        # manager for approval before it's a "real" task.
        body.intern_id = current_user.id
        body.due_date = None
        if not body.project_id:
            raise HTTPException(status_code=400, detail="Select a project — self-assigned tasks must be tied to one of your projects.")
        is_member = db.query(project_interns).filter(
            project_interns.c.project_id == body.project_id,
            project_interns.c.user_id == current_user.id,
        ).first()
        if not is_member:
            raise HTTPException(status_code=403, detail="You can only self-assign tasks under projects you're a member of.")
    elif not body.intern_id:
        raise HTTPException(status_code=400, detail="intern_id is required when creating a task as Admin or Manager.")

    intern_profile = _get_intern_profile(db, str(body.intern_id))

    if current_user.role == UserRole.MANAGER:
        if str(intern_profile.reporting_manager_id) != str(current_user.id):
            raise HTTPException(status_code=403, detail="You can only assign tasks to your own interns.")

    task = Task(
        intern_id=body.intern_id,
        assigned_by_id=current_user.id,
        project_id=body.project_id,
        title=body.title,
        description=body.description,
        assigned_date=body.assigned_date or date.today(),
        due_date=body.due_date,
        priority=body.priority,
        status=body.status,
        evidence_link=body.evidence_link,
        approval_status=TaskApprovalStatus.PENDING if is_self_assign else TaskApprovalStatus.APPROVED,
    )
    db.add(task)
    log_action(db, str(current_user.id), AuditAction.CREATE_TASK,
               target_type="task", target_id=None,
               metadata={"intern_id": str(body.intern_id), "title": body.title, "self_assigned": is_self_assign})
    db.commit()
    db.refresh(task)

    # Trigger: Notify Intern about new task assigned by Manager/Admin
    if current_user.role in (UserRole.ADMIN, UserRole.MANAGER):
        notify(
            db, body.intern_id, "New Task Assigned",
            f"Assigned task: '{task.title}' by {current_user.full_name}",
            "NEW_TASK", f"/intern/tasks/{task.id}"
        )
        db.commit()
    elif is_self_assign and intern_profile.reporting_manager_id:
        # Trigger: Intern self-assigned task -> notify their Manager for approval
        notify(
            db, intern_profile.reporting_manager_id, "Task Approval Requested",
            f"{current_user.full_name} self-assigned task '{task.title}' and needs your approval.",
            "TASK_APPROVAL_REQUEST", "/manager/tasks"
        )
        db.commit()

    return _build_task_out(_load_task(db, str(task.id)))


# ─── POST /tasks/{task_id}/approve ─────────────────────────────────────────────
@router.post("/{task_id}/approve", response_model=TaskOut)
def approve_task(
    task_id: str,
    current_user: User = Depends(require_admin_or_manager),
    db: Session = Depends(get_db),
):
    """Manager/Admin approves an intern's self-assigned task."""
    task = _load_task(db, task_id)
    intern_profile = _get_intern_profile(db, str(task.intern_id))
    assert_can_manage_task(current_user, task, intern_profile)

    if task.approval_status != TaskApprovalStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Task is already {task.approval_status.value.lower()}.")

    task.approval_status = TaskApprovalStatus.APPROVED
    task.rejection_reason = None
    log_action(db, str(current_user.id), AuditAction.APPROVE_TASK,
               target_type="task", target_id=task_id)
    db.commit()

    notify(
        db, task.intern_id, "Task Approved",
        f"{current_user.full_name} approved your self-assigned task '{task.title}'.",
        "TASK_APPROVED", f"/intern/tasks/{task.id}"
    )
    db.commit()

    return _build_task_out(_load_task(db, task_id))


# ─── POST /tasks/{task_id}/reject ──────────────────────────────────────────────
@router.post("/{task_id}/reject", response_model=TaskOut)
def reject_task(
    task_id: str,
    body: TaskRejectRequest,
    current_user: User = Depends(require_admin_or_manager),
    db: Session = Depends(get_db),
):
    """Manager/Admin rejects an intern's self-assigned task."""
    task = _load_task(db, task_id)
    intern_profile = _get_intern_profile(db, str(task.intern_id))
    assert_can_manage_task(current_user, task, intern_profile)

    if task.approval_status != TaskApprovalStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Task is already {task.approval_status.value.lower()}.")

    task.approval_status = TaskApprovalStatus.REJECTED
    task.rejection_reason = body.rejection_reason
    log_action(db, str(current_user.id), AuditAction.REJECT_TASK,
               target_type="task", target_id=task_id,
               metadata={"reason": body.rejection_reason})
    db.commit()

    reason_text = f" Reason: {body.rejection_reason}" if body.rejection_reason else ""
    notify(
        db, task.intern_id, "Task Rejected",
        f"{current_user.full_name} rejected your self-assigned task '{task.title}'.{reason_text}",
        "TASK_REJECTED", f"/intern/tasks/{task.id}"
    )
    db.commit()

    return _build_task_out(_load_task(db, task_id))


# ─── PUT /tasks/{task_id} ──────────────────────────────────────────────────────
@router.put("/{task_id}", response_model=TaskOut)
def update_task(
    task_id: str,
    body: TaskUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = _load_task(db, task_id)
    intern_profile = _get_intern_profile(db, str(task.intern_id))
    assert_can_manage_task(current_user, task, intern_profile)

    old_status = task.status

    if current_user.role == UserRole.INTERN:
        # Interns cannot update due_date
        body.due_date = None
        if body.project_id is not None:
            is_member = db.query(project_interns).filter(
                project_interns.c.project_id == body.project_id,
                project_interns.c.user_id == current_user.id,
            ).first()
            if not is_member:
                raise HTTPException(status_code=403, detail="You can only tie tasks to projects you're a member of.")

    for field in ["title", "description", "project_id", "due_date", "status", "priority",
                  "evidence_link", "completed_date"]:
        val = getattr(body, field, None)
        if val is not None:
            setattr(task, field, val)

    log_action(db, str(current_user.id), AuditAction.UPDATE_TASK,
               target_type="task", target_id=task_id)
    db.commit()

    # Trigger: Task status change notifications
    if old_status != task.status:
        intern_name = task.intern.full_name if task.intern else "Intern"
        if task.status == TaskStatus.COMPLETED:
            # Trigger: Task completed -> notify Manager
            if intern_profile.reporting_manager_id:
                notify(
                    db, intern_profile.reporting_manager_id, "Task Completed",
                    f"{intern_name} completed task: '{task.title}'",
                    "TASK_COMPLETED", "/manager/tasks"
                )
        elif task.status == TaskStatus.BLOCKED:
            # Trigger: Task blocked -> notify Admins
            notify_admins(
                db, "Task Blocked Alert",
                f"{intern_name}'s task '{task.title}' was marked as BLOCKED.",
                "BLOCKED_TASK", "/admin/tasks"
            )
        db.commit()

    return _build_task_out(_load_task(db, task_id))


# ─── POST /tasks/{task_id}/updates ────────────────────────────────────────────
@router.post("/{task_id}/updates", status_code=status.HTTP_201_CREATED)
def add_progress_update(
    task_id: str,
    body: TaskProgressUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a progress/activity note to a task."""
    task = _load_task(db, task_id)
    intern_profile = _get_intern_profile(db, str(task.intern_id))

    if current_user.role == UserRole.INTERN:
        if str(task.intern_id) != str(current_user.id):
            raise HTTPException(status_code=403, detail="You can only update your own tasks.")

    update = TaskUpdate(
        task_id=task.id,
        author_id=current_user.id,
        note=body.note,
    )
    db.add(update)
    log_action(db, str(current_user.id), AuditAction.UPDATE_TASK,
               target_type="task", target_id=task_id,
               metadata={"type": "progress_update"})
    db.commit()
    db.refresh(update)

    # Trigger notifications based on update author
    if current_user.role == UserRole.INTERN:
        # Trigger: Intern update -> notify Manager
        if intern_profile.reporting_manager_id:
            notify(
                db, intern_profile.reporting_manager_id, "Intern Posted Update",
                f"{current_user.full_name} posted a note on '{task.title}'",
                "INTERN_UPDATE", "/manager/tasks"
            )
    else:
        # Trigger: Manager feedback -> notify Intern
        notify(
            db, task.intern_id, "New Manager Feedback",
            f"{current_user.full_name} commented on '{task.title}'",
            "MANAGER_FEEDBACK", f"/intern/tasks/{task.id}"
        )
    db.commit()

    return {"id": str(update.id), "message": "Progress update added."}
