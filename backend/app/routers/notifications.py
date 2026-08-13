"""
Notifications router — get list, mark read, mark all read.
"""
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Notification
from app.middleware.rbac import get_current_user
from app.schemas.notification import NotificationOut, NotificationListResponse
from app.services.notification_service import check_and_notify_due_tasks
from app.utils import parse_uuid

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/", response_model=NotificationListResponse)
def list_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve notifications for the current user."""
    check_and_notify_due_tasks(db, current_user)
    db.commit()

    notifs = (
        db.query(Notification)
        .filter(Notification.recipient_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )

    unread_count = (
        db.query(Notification)
        .filter(Notification.recipient_id == current_user.id, Notification.is_read == False)
        .count()
    )

    return NotificationListResponse(
        unread_count=unread_count,
        notifications=[NotificationOut.model_validate(n) for n in notifs],
    )


@router.put("/read-all")
def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark all notifications as read for current user."""
    db.query(Notification).filter(
        Notification.recipient_id == current_user.id,
        Notification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read."}


@router.put("/{notification_id}/read")
def mark_single_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a single notification as read."""
    notif = db.query(Notification).filter(
        Notification.id == parse_uuid(notification_id, "notification_id"),
        Notification.recipient_id == current_user.id
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found.")

    notif.is_read = True
    db.commit()
    return {"message": "Notification marked as read."}
