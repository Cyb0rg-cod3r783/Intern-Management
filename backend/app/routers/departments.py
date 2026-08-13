import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Department, User, UserRole
from app.middleware.rbac import get_current_user, require_admin
from app.schemas.misc import DepartmentCreateRequest, DepartmentUpdateRequest
from app.utils import parse_uuid

router = APIRouter(prefix="/departments", tags=["Departments"])


@router.get("/")
def list_departments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """All roles can view active departments (needed for forms)."""
    depts = db.query(Department).filter(Department.is_active == True).all()
    return [{"id": str(d.id), "name": d.name, "description": d.description, "is_active": d.is_active}
            for d in depts]


@router.get("/all")
def list_all_departments(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin: list all departments including inactive."""
    depts = db.query(Department).all()
    return [{"id": str(d.id), "name": d.name, "description": d.description, "is_active": d.is_active}
            for d in depts]


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_department(
    body: DepartmentCreateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    existing = db.query(Department).filter(Department.name == body.name).first()
    if existing:
        raise HTTPException(status_code=409, detail="Department already exists.")

    dept = Department(name=body.name, description=body.description)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return {"id": str(dept.id), "name": dept.name, "is_active": dept.is_active}


@router.put("/{dept_id}")
def update_department(
    dept_id: str,
    body: DepartmentUpdateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    dept = db.query(Department).filter(Department.id == parse_uuid(dept_id, "dept_id")).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found.")

    if body.name is not None:
        dept.name = body.name
    if body.description is not None:
        dept.description = body.description
    if body.is_active is not None:
        dept.is_active = body.is_active

    db.commit()
    return {"id": str(dept.id), "name": dept.name, "is_active": dept.is_active}
