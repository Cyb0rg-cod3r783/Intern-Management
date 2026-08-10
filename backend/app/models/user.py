import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.enums import UserRole


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_email = Column(String, unique=True, nullable=False, index=True)
    role = Column(SAEnum(UserRole), nullable=False, default=UserRole.INTERN)
    full_name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    # Authentication fields
    google_sub = Column(String, unique=True, nullable=True)   # Google OAuth subject ID
    password_hash = Column(String, nullable=True)             # Fallback email/password

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    intern_profile = relationship(
        "InternProfile", back_populates="user",
        foreign_keys="InternProfile.user_id", uselist=False
    )
    managed_interns = relationship(
        "InternProfile", back_populates="reporting_manager",
        foreign_keys="InternProfile.reporting_manager_id"
    )
    assigned_tasks = relationship(
        "Task", back_populates="intern",
        foreign_keys="Task.intern_id"
    )
    audit_logs = relationship("AuditLog", back_populates="actor", foreign_keys="AuditLog.actor_id")

    def __repr__(self):
        return f"<User {self.company_email} ({self.role})>"
