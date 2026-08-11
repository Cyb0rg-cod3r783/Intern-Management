from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict

class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    recipient_id: UUID
    title: str
    message: str
    notification_type: str
    link: Optional[str] = None
    is_read: bool
    created_at: datetime

class NotificationListResponse(BaseModel):
    unread_count: int
    notifications: List[NotificationOut]
