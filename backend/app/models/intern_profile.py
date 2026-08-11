import uuid
from datetime import datetime, date
from sqlalchemy import (
    Column, String, Boolean, DateTime, Date, Numeric, Text, ForeignKey,
    Enum as SAEnum, LargeBinary
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, foreign

from app.database import Base
from app.models.enums import InternStatus


class InternProfile(Base):
    """
    Intern profile table.

    IMPORTANT SECURITY NOTE:
    Fields marked as [ADMIN-ONLY] must NEVER be returned to Managers or Interns.
    The backend API enforces this via role-filtered Pydantic schemas.
    Bank data is AES-256 encrypted at rest via crypto_service.py.
    """
    __tablename__ = "intern_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)

    # ── Identity ──────────────────────────────────────────────────────────────
    new_tk_id = Column(String, nullable=True, index=True)
    old_tk_id = Column(String, nullable=True, index=True)

    # ── Organization ─────────────────────────────────────────────────────────
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    reporting_manager_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    title = Column(String, nullable=True)
    category = Column(String, nullable=True)
    location = Column(String, nullable=True)
    internship_type = Column(String, nullable=True)
    duration = Column(String, nullable=True)

    # ── Dates ────────────────────────────────────────────────────────────────
    joining_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    status = Column(SAEnum(InternStatus), default=InternStatus.ACTIVE, nullable=False)

    # ── Operational ──────────────────────────────────────────────────────────
    remarks = Column(Text, nullable=True)

    # ── [ADMIN-ONLY] Sensitive Personal Information ───────────────────────────
    # These fields are NEVER returned to Manager or Intern roles.
    personal_email = Column(String, nullable=True)         # [ADMIN-ONLY]
    personal_phone = Column(String, nullable=True)         # [ADMIN-ONLY]
    marital_status = Column(String, nullable=True)         # [ADMIN-ONLY]

    # ── [ADMIN-ONLY] Financial Information ────────────────────────────────────
    # Bank account number is AES-256 encrypted via crypto_service.
    stipend_amount = Column(Numeric(10, 2), nullable=True)  # [ADMIN-ONLY]
    stipend_type = Column(String, nullable=True)            # [ADMIN-ONLY] monthly/weekly/one-time
    is_paid = Column(Boolean, default=False, nullable=True) # [ADMIN-ONLY]
    bank_account_number_encrypted = Column(LargeBinary, nullable=True)  # [ADMIN-ONLY] AES-256
    bank_name = Column(String, nullable=True)               # [ADMIN-ONLY]
    bank_ifsc = Column(String, nullable=True)               # [ADMIN-ONLY]
    payment_info_extra = Column(JSONB, nullable=True)       # [ADMIN-ONLY] misc

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="intern_profile", foreign_keys=[user_id])
    department = relationship("Department", back_populates="interns")
    reporting_manager = relationship("User", back_populates="managed_interns", foreign_keys=[reporting_manager_id])
    tasks = relationship("Task", back_populates="intern_profile",
                         foreign_keys="Task.intern_id",
                         primaryjoin="InternProfile.user_id == Task.intern_id",
                         overlaps="assigned_tasks")
    outgoing_handovers = relationship("Handover", back_populates="outgoing_intern",
                                      foreign_keys="Handover.outgoing_intern_id",
                                      primaryjoin="InternProfile.user_id == Handover.outgoing_intern_id")




    def __repr__(self):
        return f"<InternProfile user_id={self.user_id}>"
