import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base


class InternHistoryLog(Base):
    """
    Audit & Career History Log for Interns.
    Tracks all major lifecycle events:
    - INTERNSHIP_EXTENSION: End date / duration extensions
    - STIPEND_REVISION: Financial stipend revisions (Admin-only sensitive)
    - DEPARTMENT_TRANSFER: Department transfers
    - MANAGER_CHANGE: Reporting manager reassignments
    - PROJECT_ASSIGNED / PROJECT_REMOVED: Project history
    - STATUS_CHANGE: Onboarding approval, active, alumni, inactive
    - TASK_COMPLETED / MILESTONE: Major task accomplishments
    """
    __tablename__ = "intern_history_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    intern_profile_id = Column(UUID(as_uuid=True), ForeignKey("intern_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    event_type = Column(String, nullable=False, index=True)  # INTERNSHIP_EXTENSION, STIPEND_REVISION, DEPARTMENT_TRANSFER, etc.
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)

    old_value = Column(String, nullable=True)
    new_value = Column(String, nullable=True)
    extra_metadata = Column("metadata", JSONB, nullable=True)

    performed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    is_sensitive = Column(Boolean, default=False, nullable=False, index=True)  # True for stipend/financial logs

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    intern_profile = relationship("InternProfile", foreign_keys=[intern_profile_id])
    user = relationship("User", foreign_keys=[user_id])
    performed_by = relationship("User", foreign_keys=[performed_by_id])

    def __repr__(self):
        return f"<InternHistoryLog {self.event_type} for user_id={self.user_id}>"
