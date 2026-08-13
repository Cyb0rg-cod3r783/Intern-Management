"""
DB-backed security bookkeeping tables.

These back the token blacklist (logout revocation) and the login rate limiter.
Both used to be in-process Python dicts, which only protect a single worker
process — with more than one uvicorn/gunicorn worker (or after a restart),
each process had independent state, so a revoked token could still work
against a different worker, and the rate limit could be bypassed by round-
robining across workers. Backing them with the DB fixes that.
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class BlacklistedToken(Base):
    __tablename__ = "blacklisted_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # SHA-256 hash of the JWT, not the raw token — avoids duplicating a live
    # bearer credential in the database.
    token_hash = Column(String, nullable=False, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class LoginAttempt(Base):
    __tablename__ = "login_attempts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ip_address = Column(String, nullable=False, index=True)
    attempted_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
