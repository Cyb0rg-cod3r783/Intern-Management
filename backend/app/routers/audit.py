from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, UserRole, AuditLog, AuditAction
from app.middleware.rbac import require_admin
from app.schemas.misc import AuditLogOut
from app.utils import parse_uuid

router = APIRouter(prefix="/audit", tags=["Audit Logs"])


@router.get("/", response_model=List[AuditLogOut])
def get_audit_logs(
    action: Optional[str] = Query(None),
    actor_id: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin only: retrieve paginated audit logs."""
    query = db.query(AuditLog).order_by(AuditLog.created_at.desc())

    if action:
        query = query.filter(AuditLog.action == action)
    if actor_id:
        query = query.filter(AuditLog.actor_id == parse_uuid(actor_id, "actor_id"))

    logs = query.offset(offset).limit(limit).all()

    result = []
    for log in logs:
        out = AuditLogOut.model_validate(log)
        if log.actor:
            out.actor_name = log.actor.full_name
            out.actor_email = log.actor.company_email
        result.append(out)

    return result
