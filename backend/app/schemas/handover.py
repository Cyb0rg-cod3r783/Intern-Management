from __future__ import annotations
from datetime import datetime
from typing import Optional, List, Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict
from app.models.enums import HandoverStatus


class HandoverOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    outgoing_intern_id: UUID
    outgoing_intern_name: str = ""
    receiving_person_id: Optional[UUID] = None
    receiving_person_name: str = ""
    initiated_by_id: UUID
    initiated_by_name: str = ""
    status: HandoverStatus
    summary: Optional[str] = None
    important_notes: Optional[str] = None
    doc_links: Optional[str] = None
    repo_pr_links: Optional[str] = None
    context: Optional[str] = None
    completed_tasks: Optional[Any] = None
    pending_tasks: Optional[Any] = None
    created_at: datetime
    updated_at: datetime


class HandoverCreateRequest(BaseModel):
    outgoing_intern_id: UUID
    receiving_person_id: Optional[UUID] = None
    summary: Optional[str] = None
    important_notes: Optional[str] = None
    doc_links: Optional[str] = None
    repo_pr_links: Optional[str] = None
    context: Optional[str] = None
    completed_tasks: Optional[Any] = None
    pending_tasks: Optional[Any] = None


class HandoverUpdateRequest(BaseModel):
    receiving_person_id: Optional[UUID] = None
    status: Optional[HandoverStatus] = None
    summary: Optional[str] = None
    important_notes: Optional[str] = None
    doc_links: Optional[str] = None
    repo_pr_links: Optional[str] = None
    context: Optional[str] = None
    completed_tasks: Optional[Any] = None
    pending_tasks: Optional[Any] = None
