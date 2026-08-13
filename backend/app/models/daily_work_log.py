import uuid
from datetime import datetime, date
from sqlalchemy import Column, String, Text, Date, DateTime, Float, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class DailyWorkLog(Base):
    __tablename__ = "daily_work_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    intern_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)

    log_date = Column(Date, nullable=False, default=date.today)
    total_hours = Column(Float, nullable=False, default=8.0)
    summary_notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("intern_id", "log_date", name="uq_intern_daily_log_date"),
    )

    # Relationships
    intern = relationship("User", foreign_keys=[intern_id])
    department = relationship("Department", foreign_keys=[department_id])
    entries = relationship("DailyWorkLogEntry", back_populates="work_log", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<DailyWorkLog intern_id={self.intern_id} date={self.log_date} hours={self.total_hours}>"


class DailyWorkLogEntry(Base):
    __tablename__ = "daily_work_log_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    work_log_id = Column(UUID(as_uuid=True), ForeignKey("daily_work_logs.id", ondelete="CASCADE"), nullable=False)
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)

    hours_spent = Column(Float, nullable=False, default=0.0)
    description = Column(Text, nullable=True)
    evidence_link = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    work_log = relationship("DailyWorkLog", back_populates="entries")
    task = relationship("Task")
    project = relationship("Project")

    def __repr__(self):
        return f"<DailyWorkLogEntry task_id={self.task_id} hours={self.hours_spent}>"
