import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session, joinedload
from datetime import date

from app.database import get_db
from app.models import User, UserRole, Task, TaskUpdate, InternProfile, AuditAction
from app.models.enums import TaskStatus
from app.schemas.task import TaskOut, TaskUpdateOut, TaskCreateRequest, TaskUpdateRequest, TaskProgressUpdateRequest
from app.middleware.rbac import (
    get_current_user, require_admin_or_manager,
    assert_can_manage_task,
)
from app.services.audit_service import log_action
from app.services.notification_service import notify, notify_admins

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
        .filter(Task.id == uuid.UUID(task_id))
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    return task


def _get_intern_profile(db: Session, intern_id: str) -> InternProfile:
    profile = db.query(InternProfile).filter(
        InternProfile.user_id == uuid.UUID(intern_id)
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
    elif intern_id:
        query = query.filter(Task.intern_id == uuid.UUID(intern_id))

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

    return _build_task_out(task)


# ─── POST /tasks ───────────────────────────────────────────────────────────────
@router.post("/", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(
    request: Request,
    body: TaskCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == UserRole.INTERN:
        # Intern can only self-assign and cannot set due_date
        body.intern_id = current_user.id
        body.due_date = None
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
    )
    db.add(task)
    log_action(db, str(current_user.id), AuditAction.CREATE_TASK,
               target_type="task", target_id=None,
               metadata={"intern_id": str(body.intern_id), "title": body.title})
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

    return _build_task_out(_load_task(db, str(task.id)))


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
