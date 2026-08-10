import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, foreign
from app.database import Base
from app.models.enums import HandoverStatus



class Handover(Base):
    """
    Manual handover record — ALWAYS created and managed by a Manager.
    Tasks are NEVER automatically transferred.
    Sensitive credentials/secrets must NEVER be stored in any handover field.
    """
    __tablename__ = "handovers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    outgoing_intern_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    receiving_person_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    initiated_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    status = Column(SAEnum(HandoverStatus), default=HandoverStatus.DRAFT, nullable=False)

    summary = Column(Text, nullable=True)
    important_notes = Column(Text, nullable=True)
    doc_links = Column(Text, nullable=True)
    repo_pr_links = Column(Text, nullable=True)
    context = Column(Text, nullable=True)

    # JSON arrays of task IDs and summaries
    completed_tasks = Column(JSONB, default=list)
    pending_tasks = Column(JSONB, default=list)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships

    outgoing_intern = relationship("InternProfile", back_populates="outgoing_handovers",
                                   foreign_keys=[outgoing_intern_id],
                                   primaryjoin="Handover.outgoing_intern_id == InternProfile.user_id")


    receiving_person = relationship("User", foreign_keys=[receiving_person_id])
    initiated_by = relationship("User", foreign_keys=[initiated_by_id])

    def __repr__(self):
        return f"<Handover intern={self.outgoing_intern_id} status={self.status}>"
