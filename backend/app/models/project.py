import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Date, DateTime, ForeignKey, Table
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base

project_interns = Table(
    "project_interns",
    Base.metadata,
    Column("project_id", UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("assigned_at", DateTime, default=datetime.utcnow, nullable=False),
)


class Project(Base):
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, default="ACTIVE", nullable=False)  # PLANNING, ACTIVE, COMPLETED, ON_HOLD
    
    start_date = Column(Date, nullable=True)
    target_end_date = Column(Date, nullable=True)
    
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    department = relationship("Department", foreign_keys=[department_id])
    interns = relationship("User", secondary=project_interns, backref="projects")
    tasks = relationship("Task", back_populates="project")

    def __repr__(self):
        return f"<Project {self.name} ({self.status})>"
