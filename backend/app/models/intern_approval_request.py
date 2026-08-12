import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class InternApprovalRequest(Base):
    __tablename__ = "intern_approval_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    intern_id = Column(UUID(as_uuid=True), ForeignKey("intern_profiles.id", ondelete="CASCADE"), nullable=False)

    # ONBOARDING or DEPARTMENT_TRANSFER
    request_type = Column(String, nullable=False, default="ONBOARDING")

    current_department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    target_department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)

    requested_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_manager_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # PENDING, ACCEPTED, REJECTED
    status = Column(String, nullable=False, default="PENDING")
    rejection_reason = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    intern_profile = relationship("InternProfile", foreign_keys=[intern_id])
    current_department = relationship("Department", foreign_keys=[current_department_id])
    target_department = relationship("Department", foreign_keys=[target_department_id])
    requested_by = relationship("User", foreign_keys=[requested_by_id])
    assigned_manager = relationship("User", foreign_keys=[assigned_manager_id])

    def __repr__(self):
        return f"<InternApprovalRequest intern_id={self.intern_id} type={self.request_type} status={self.status}>"
