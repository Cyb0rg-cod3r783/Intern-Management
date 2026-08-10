import uuid
from datetime import datetime, date
from sqlalchemy import Column, String, Text, Date, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, foreign
from app.database import Base
from app.models.enums import TaskStatus, TaskPriority


class Task(Base):
    __tablename__ = "tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    intern_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    assigned_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)

    assigned_date = Column(Date, nullable=True)
    due_date = Column(Date, nullable=True)
    completed_date = Column(Date, nullable=True)

    # OVERDUE is NOT stored — computed at query time:
    # status != COMPLETED AND due_date < today
    status = Column(SAEnum(TaskStatus), default=TaskStatus.NOT_STARTED, nullable=False)
    priority = Column(SAEnum(TaskPriority), default=TaskPriority.MEDIUM, nullable=False)

    evidence_link = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


    # Relationships
    intern = relationship("User", back_populates="assigned_tasks", foreign_keys=[intern_id], overlaps="intern_profile,tasks")
    assigned_by = relationship("User", foreign_keys=[assigned_by_id])
    intern_profile = relationship("InternProfile", back_populates="tasks",
                                  foreign_keys=[intern_id],
                                  primaryjoin="Task.intern_id == InternProfile.user_id",
                                  overlaps="assigned_tasks,intern")



    updates = relationship("TaskUpdate", back_populates="task", order_by="TaskUpdate.created_at")

    @property
    def is_overdue(self) -> bool:
        """Computed: true if past due date and not completed."""
        if self.due_date and self.status not in (TaskStatus.COMPLETED,):
            return date.today() > self.due_date
        return False

    def __repr__(self):
        return f"<Task {self.title} ({self.status})>"


class TaskUpdate(Base):
    __tablename__ = "task_updates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id"), nullable=False)
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    note = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    task = relationship("Task", back_populates="updates")
    author = relationship("User", foreign_keys=[author_id])

    def __repr__(self):
        return f"<TaskUpdate task_id={self.task_id}>"
