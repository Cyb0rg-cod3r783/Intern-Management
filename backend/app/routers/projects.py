import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.database import get_db
from app.models import User, UserRole, Project, project_interns, Task, TaskUpdate, AuditAction, InternProfile
from app.models.enums import TaskStatus
from app.schemas.project import ProjectOut, ProjectCreateRequest, ProjectUpdateRequest, ProjectAssignInternsRequest, ProjectPhaseUpdate
from app.schemas.intern import DepartmentOut, UserRef
from app.schemas.task import TaskOut, TaskUpdateOut
from app.middleware.rbac import get_current_user, require_admin_or_manager
from app.services.audit_service import log_action
from app.services.notification_service import notify
from app.services.history_service import record_history_log
from app.utils import parse_uuid

router = APIRouter(prefix="/projects", tags=["Projects"])


def _build_project_out(db: Session, project: Project) -> ProjectOut:
    """
    Manually construct ProjectOut to avoid Pydantic trying to coerce
    SQLAlchemy UUID / relationship objects through model_validate.
    """
    dept_out = DepartmentOut.model_validate(project.department) if project.department else None

    intern_refs = [
        UserRef(
            id=str(u.id),
            full_name=u.full_name,
            company_email=u.company_email,
            role=u.role.value,
        )
        for u in project.interns
    ]

    total_tasks: int = (
        db.query(func.count(Task.id))
        .filter(Task.project_id == project.id)
        .scalar() or 0
    )
    completed_tasks: int = (
        db.query(func.count(Task.id))
        .filter(Task.project_id == project.id, Task.status == TaskStatus.COMPLETED)
        .scalar() or 0
    )

    return ProjectOut(
        id=project.id,
        name=project.name,
        description=project.description,
        status=project.status,
        phase=project.phase or "DEVELOPMENT",
        start_date=project.start_date,
        target_end_date=project.target_end_date,
        department_id=project.department_id,
        department=dept_out,
        interns=intern_refs,
        task_count=total_tasks,
        completed_task_count=completed_tasks,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


def _load_project(db: Session, project_id: str) -> Project:
    p = (
        db.query(Project)
        .options(
            joinedload(Project.department),
            joinedload(Project.interns),
        )
        .filter(Project.id == parse_uuid(project_id, "project_id"))
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Project not found.")
    return p


def _build_task_out(t: Task) -> TaskOut:
    """Manually construct TaskOut from a Task ORM object."""
    return TaskOut(
        id=t.id,
        intern_id=t.intern_id,
        intern_name=t.intern.full_name if t.intern else "",
        assigned_by_id=t.assigned_by_id,
        assigned_by_name=t.assigned_by.full_name if t.assigned_by else "",
        project_id=t.project_id,
        project_name=t.project.name if t.project else "",
        title=t.title,
        description=t.description,
        assigned_date=t.assigned_date,
        due_date=t.due_date,
        completed_date=t.completed_date,
        status=t.status,
        priority=t.priority,
        evidence_link=t.evidence_link,
        is_overdue=t.is_overdue,
        created_at=t.created_at,
        updated_at=t.updated_at,
        updates=[
            TaskUpdateOut(
                id=u.id,
                task_id=u.task_id,
                author_id=u.author_id,
                author_name=u.author.full_name if u.author else "",
                note=u.note,
                created_at=u.created_at,
            )
            for u in t.updates
        ],
    )


# ─── GET /projects/ ────────────────────────────────────────────────────────────
@router.get("/", response_model=List[ProjectOut])
def list_projects(
    status_filter: Optional[str] = Query(None, alias="status"),
    department_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List projects based on user role and filters."""
    query = db.query(Project).options(
        joinedload(Project.department),
        joinedload(Project.interns),
    )

    if status_filter:
        query = query.filter(Project.status == status_filter)
    if department_id:
        query = query.filter(Project.department_id == parse_uuid(department_id, "department_id"))

    if current_user.role == UserRole.INTERN:
        query = query.join(project_interns).filter(project_interns.c.user_id == current_user.id)
    elif current_user.role == UserRole.MANAGER and current_user.department_id:
        query = query.filter(
            (Project.department_id == current_user.department_id) | (Project.id.in_(
                db.query(project_interns.c.project_id).filter(project_interns.c.user_id == current_user.id)
            ))
        )

    projects = query.order_by(Project.created_at.desc()).all()
    return [_build_project_out(db, p) for p in projects]


# ─── POST /projects/ ───────────────────────────────────────────────────────────
@router.post("/", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    body: ProjectCreateRequest,
    current_user: User = Depends(require_admin_or_manager),
    db: Session = Depends(get_db),
):
    """Create a new project (Admin or Manager)."""
    p = Project(
        name=body.name,
        description=body.description,
        status=body.status or "ACTIVE",
        start_date=body.start_date,
        target_end_date=body.target_end_date,
        department_id=parse_uuid(body.department_id, "department_id") if body.department_id else None,
    )
    db.add(p)
    log_action(db, str(current_user.id), AuditAction.CREATE_PROJECT,
               target_type="project", metadata={"name": body.name})
    db.commit()
    db.refresh(p)
    return _build_project_out(db, _load_project(db, str(p.id)))


# ─── GET /projects/{project_id} ────────────────────────────────────────────────
@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get project details."""
    p = _load_project(db, project_id)
    return _build_project_out(db, p)


# ─── GET /projects/{project_id}/tasks ─────────────────────────────────────────
@router.get("/{project_id}/tasks", response_model=List[TaskOut])
def get_project_tasks(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all tasks under a specific project."""
    _load_project(db, project_id)
    tasks = (
        db.query(Task)
        .options(
            joinedload(Task.intern),
            joinedload(Task.assigned_by),
            joinedload(Task.project),
            joinedload(Task.updates).joinedload(TaskUpdate.author),
        )
        .filter(Task.project_id == parse_uuid(project_id, "project_id"))
        .order_by(Task.created_at.desc())
        .all()
    )
    return [_build_task_out(t) for t in tasks]


# ─── PATCH /projects/{project_id}/phase ────────────────────────────────────────
@router.patch("/{project_id}/phase", response_model=ProjectOut)
def update_project_phase(
    project_id: str,
    body: ProjectPhaseUpdate,
    current_user: User = Depends(require_admin_or_manager),
    db: Session = Depends(get_db),
):
    """Update project lifecycle phase (PLANNING, DEVELOPMENT, TESTING, COMPLETED)."""
    p = _load_project(db, project_id)
    p.phase = body.phase.upper()
    db.commit()
    db.refresh(p)
    return _build_project_out(db, p)


# ─── PUT /projects/{project_id} ────────────────────────────────────────────────
@router.put("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: str,
    body: ProjectUpdateRequest,
    current_user: User = Depends(require_admin_or_manager),
    db: Session = Depends(get_db),
):
    """Update project details."""
    p = _load_project(db, project_id)

    if body.name is not None:
        p.name = body.name
    if body.description is not None:
        p.description = body.description
    if body.status is not None:
        p.status = body.status
    if body.start_date is not None:
        p.start_date = body.start_date
    if body.target_end_date is not None:
        p.target_end_date = body.target_end_date
    if body.department_id is not None:
        p.department_id = parse_uuid(body.department_id, "department_id") if body.department_id else None

    db.commit()
    return _build_project_out(db, _load_project(db, project_id))


# ─── POST /projects/{project_id}/assign-interns ────────────────────────────────
@router.post("/{project_id}/assign-interns", response_model=ProjectOut)
def assign_interns_to_project(
    project_id: str,
    body: ProjectAssignInternsRequest,
    current_user: User = Depends(require_admin_or_manager),
    db: Session = Depends(get_db),
):
    """Assign or update interns for a project."""
    p = _load_project(db, project_id)

    if current_user.role == UserRole.MANAGER and current_user.department_id:
        # Manager scoping: only their own department's project, only their own interns.
        if p.department_id and p.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="You can only assign interns to projects in your own department.")

    target_users = (
        db.query(User)
        .filter(User.id.in_([parse_uuid(uid, "user_id") for uid in body.user_ids]))
        .all()
    ) if body.user_ids else []

    if current_user.role == UserRole.MANAGER and current_user.department_id:
        out_of_scope = [
            u.full_name for u in target_users
            if u.department_id != current_user.department_id
            and not db.query(InternProfile).filter(
                InternProfile.user_id == u.id,
                InternProfile.reporting_manager_id == current_user.id,
            ).first()
        ]
        if out_of_scope:
            raise HTTPException(
                status_code=403,
                detail=f"You can only assign interns from your own department or directly reporting to you. Out of scope: {', '.join(out_of_scope)}",
            )

    p.interns = target_users
    db.commit()

    # Notify & record history for assigned interns
    for user_obj in target_users:
        profile = db.query(InternProfile).filter(InternProfile.user_id == user_obj.id).first()
        if profile:
            record_history_log(
                db,
                intern_profile_id=profile.id,
                user_id=user_obj.id,
                event_type="PROJECT_ASSIGNED",
                title=f"Assigned to Project '{p.name}'",
                description=f"Assigned to project '{p.name}' by {current_user.full_name}.",
                new_value=p.name,
                metadata={"project_id": str(p.id), "project_name": p.name},
                performed_by_id=current_user.id,
            )

        notify(
            db, str(user_obj.id), "Assigned to Project",
            f"You were assigned to project '{p.name}' by {current_user.full_name}.",
            "PROJECT_ASSIGNED", f"/intern/projects/{p.id}"
        )
    db.commit()

    return _build_project_out(db, _load_project(db, project_id))


# ─── DELETE /projects/{project_id} ─────────────────────────────────────────────
@router.delete("/{project_id}", status_code=status.HTTP_200_OK)
def delete_project(
    project_id: str,
    current_user: User = Depends(require_admin_or_manager),
    db: Session = Depends(get_db),
):
    """Delete a project."""
    p = _load_project(db, project_id)
    log_action(db, str(current_user.id), AuditAction.DELETE_PROJECT,
               target_type="project", target_id=project_id,
               metadata={"name": p.name})
    db.delete(p)
    db.commit()
    return {"message": "Project deleted successfully."}
