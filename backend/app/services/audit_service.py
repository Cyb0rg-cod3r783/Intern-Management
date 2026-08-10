"""
Audit logging service.
All sensitive actions are logged here.
Audit logs are append-only — NEVER updated or deleted.
"""
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog
from app.models.enums import AuditAction
import uuid


def log_action(
    db: Session,
    actor_id: Optional[str],
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    metadata: Optional[dict] = None,
    ip_address: Optional[str] = None,
) -> None:
    """
    Append an audit log entry.
    actor_id: UUID of the user performing the action (can be None for system events).
    action:   One of AuditAction enum values.
    """
    entry = AuditLog(
        actor_id=uuid.UUID(actor_id) if actor_id else None,
        action=action,
        target_type=target_type,
        target_id=uuid.UUID(target_id) if target_id else None,
        extra_metadata=metadata or {},

        ip_address=ip_address,
        created_at=datetime.utcnow(),
    )
    db.add(entry)
    # Use flush so the log is part of the same transaction but caller controls commit
    db.flush()
