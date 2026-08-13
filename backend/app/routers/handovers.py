import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, UserRole, Handover, InternProfile, AuditAction
from app.models.enums import HandoverStatus
from app.schemas.handover import HandoverOut, HandoverCreateRequest, HandoverUpdateRequest
from app.middleware.rbac import (
    get_current_user, require_admin_or_manager,
    assert_can_manage_handover,
)
from app.services.audit_service import log_action
from app.services.notification_service import notify
from app.utils import parse_uuid

router = APIRouter(prefix="/handovers", tags=["Handovers"])


def _build_handover_out(h: Handover) -> HandoverOut:
    out = HandoverOut.model_validate(h)
    if h.outgoing_intern and hasattr(h.outgoing_intern, 'user') and h.outgoing_intern.user:
        out.outgoing_intern_name = h.outgoing_intern.user.full_name
    if h.receiving_person:
        out.receiving_person_name = h.receiving_person.full_name
    if h.initiated_by:
        out.initiated_by_name = h.initiated_by.full_name
    return out


def _get_intern_profile(db: Session, intern_id: str) -> InternProfile:
    profile = db.query(InternProfile).filter(
        InternProfile.user_id == parse_uuid(intern_id, "intern_id")
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Intern not found.")
    return profile


# ─── GET /handovers ────────────────────────────────────────────────────────────
@router.get("/", response_model=List[HandoverOut])
def list_handovers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == UserRole.INTERN:
        raise HTTPException(status_code=403, detail="Interns cannot list handovers.")

    query = db.query(Handover)

    if current_user.role == UserRole.MANAGER:
        # Managers see handovers they initiated or are receiving
        query = query.filter(
            (Handover.initiated_by_id == current_user.id) |
            (Handover.receiving_person_id == current_user.id)
        )

    handovers = query.order_by(Handover.created_at.desc()).all()
    return [_build_handover_out(h) for h in handovers]


# ─── GET /handovers/{handover_id} ─────────────────────────────────────────────
@router.get("/{handover_id}", response_model=HandoverOut)
def get_handover(
    handover_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == UserRole.INTERN:
        raise HTTPException(status_code=403, detail="Access denied.")

    h = db.query(Handover).filter(Handover.id == parse_uuid(handover_id, "handover_id")).first()
    if not h:
        raise HTTPException(status_code=404, detail="Handover not found.")

    if current_user.role == UserRole.MANAGER:
        if str(h.initiated_by_id) != str(current_user.id) and \
           str(h.receiving_person_id) != str(current_user.id):
            raise HTTPException(status_code=403, detail="Access denied.")

    return _build_handover_out(h)


# ─── POST /handovers ───────────────────────────────────────────────────────────
@router.post("/", response_model=HandoverOut, status_code=status.HTTP_201_CREATED)
def create_handover(
    body: HandoverCreateRequest,
    current_user: User = Depends(require_admin_or_manager),
    db: Session = Depends(get_db),
):
    """Manager manually initiates a handover for one of their interns."""
    intern_profile = _get_intern_profile(db, str(body.outgoing_intern_id))
    assert_can_manage_handover(current_user, intern_profile)

    h = Handover(
        outgoing_intern_id=body.outgoing_intern_id,
        receiving_person_id=body.receiving_person_id,
        initiated_by_id=current_user.id,
        status=HandoverStatus.DRAFT,
        summary=body.summary,
        important_notes=body.important_notes,
        doc_links=body.doc_links,
        repo_pr_links=body.repo_pr_links,
        context=body.context,
        completed_tasks=body.completed_tasks or [],
        pending_tasks=body.pending_tasks or [],
    )
    db.add(h)
    log_action(db, str(current_user.id), AuditAction.CREATE_HANDOVER,
               target_type="handover", target_id=None,
               metadata={"intern_id": str(body.outgoing_intern_id)})
    db.commit()
    db.refresh(h)
    return _build_handover_out(h)


# ─── PUT /handovers/{handover_id} ─────────────────────────────────────────────
@router.put("/{handover_id}", response_model=HandoverOut)
def update_handover(
    handover_id: str,
    body: HandoverUpdateRequest,
    current_user: User = Depends(require_admin_or_manager),
    db: Session = Depends(get_db),
):
    h = db.query(Handover).filter(Handover.id == parse_uuid(handover_id, "handover_id")).first()
    if not h:
        raise HTTPException(status_code=404, detail="Handover not found.")

    if current_user.role == UserRole.MANAGER:
        if str(h.initiated_by_id) != str(current_user.id):
            raise HTTPException(status_code=403, detail="You can only update your own handovers.")

    for field in ["receiving_person_id", "status", "summary", "important_notes",
                  "doc_links", "repo_pr_links", "context", "completed_tasks", "pending_tasks"]:
        val = getattr(body, field, None)
        if val is not None:
            setattr(h, field, val)

    action = AuditAction.ACKNOWLEDGE_HANDOVER if body.status == HandoverStatus.ACKNOWLEDGED \
        else AuditAction.UPDATE_HANDOVER
    log_action(db, str(current_user.id), action,
               target_type="handover", target_id=handover_id)
    db.commit()

    if body.status and h.receiving_person_id:
        notify(
            db, h.receiving_person_id, "🔄 Handover Status Updated",
            f"Handover status updated to {h.status.value}",
            "HANDOVER_STATUS", "/manager/handovers"
        )
        db.commit()

    return _build_handover_out(h)
