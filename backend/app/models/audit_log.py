import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.enums import AuditAction


class AuditLog(Base):
    """
    Immutable audit trail — accessible ONLY to Admin users.
    Logs are append-only; rows are never updated or deleted.
    """
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String, nullable=False)   # AuditAction enum value
    target_type = Column(String, nullable=True)  # 'intern', 'task', 'handover', etc.
    target_id = Column(UUID(as_uuid=True), nullable=True)
    extra_metadata = Column("metadata", JSONB, nullable=True)

    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    actor = relationship("User", back_populates="audit_logs", foreign_keys=[actor_id])

    def __repr__(self):
        return f"<AuditLog {self.action} by {self.actor_id}>"
