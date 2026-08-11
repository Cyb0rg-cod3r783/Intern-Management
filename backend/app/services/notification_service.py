"""
Notification service for creating and retrieving role-based notifications.
"""
from typing import Optional, List
import uuid
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.notification import Notification
from app.models.user import User
from app.models.enums import UserRole
from app.models.task import Task


def notify(
    db: Session,
    recipient_id: str | uuid.UUID,
    title: str,
    message: str,
    notification_type: str,
    link: Optional[str] = None,
) -> Notification:
    """Create a new notification row for a recipient."""
    rec_uuid = uuid.UUID(str(recipient_id))
    notif = Notification(
        recipient_id=rec_uuid,
        title=title,
        message=message,
        notification_type=notification_type,
        link=link,
    )
    db.add(notif)
    db.flush()
    return notif


def notify_admins(
    db: Session,
    title: str,
    message: str,
    notification_type: str,
    link: Optional[str] = None,
) -> None:
    """Broadcast a notification to all active Admin users."""
    admins = db.query(User).filter(User.role == UserRole.ADMIN, User.is_active == True).all()
    for admin in admins:
        notify(db, admin.id, title, message, notification_type, link)


def check_and_notify_due_tasks(db: Session, user: User) -> None:
    """Auto-scan tasks for due soon (<24 hours) or overdue status and notify."""
    now = datetime.utcnow().date()
    tomorrow = now + timedelta(days=1)

    if user.role == UserRole.INTERN:
        tasks = db.query(Task).filter(Task.intern_id == user.id, Task.status != "COMPLETED").all()
        for t in tasks:
            if t.due_date:
                if t.due_date < now:
                    _ensure_single_notification(
                        db, user.id, f"🔴 Task Overdue: {t.title}",
                        f"Task '{t.title}' passed its due date ({t.due_date}).",
                        "OVERDUE", f"/intern/tasks/{t.id}"
                    )
                elif t.due_date == tomorrow or t.due_date == now:
                    _ensure_single_notification(
                        db, user.id, f"⏳ Task Due Soon: {t.title}",
                        f"Task '{t.title}' is due on {t.due_date}.",
                        "DUE_SOON", f"/intern/tasks/{t.id}"
                    )


def _ensure_single_notification(
    db: Session, recipient_id: uuid.UUID, title: str, message: str, notification_type: str, link: str
) -> None:
    """Avoid creating duplicate unread notifications for the same event."""
    existing = db.query(Notification).filter(
        Notification.recipient_id == recipient_id,
        Notification.notification_type == notification_type,
        Notification.link == link,
        Notification.is_read == False,
    ).first()
    if not existing:
        notify(db, recipient_id, title, message, notification_type, link)
