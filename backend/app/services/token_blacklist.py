"""
Token blacklist service for invalidating JWT tokens on logout.

DB-backed (see app/models/security.py::BlacklistedToken) so revocation holds
across multiple worker processes and app restarts — an in-memory set only
protects a single process.
"""
import hashlib
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.config import settings


def _hash_token(token: str) -> str:
    """We store a SHA-256 hash rather than the raw token, so a DB dump
    doesn't hand out live bearer credentials."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def blacklist_token(db: Session, token: str) -> None:
    """Add a token to the blacklist until its natural JWT expiry."""
    from app.models.security import BlacklistedToken
    from app.services.auth_service import decode_access_token

    if not token:
        return

    payload = decode_access_token(token, verify_exp=False)
    if payload and payload.get("exp"):
        expires_at = datetime.utcfromtimestamp(payload["exp"])
    else:
        expires_at = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    token_hash = _hash_token(token)
    existing = db.query(BlacklistedToken).filter(BlacklistedToken.token_hash == token_hash).first()
    if not existing:
        db.add(BlacklistedToken(token_hash=token_hash, expires_at=expires_at))
        db.commit()

    # Opportunistic cleanup of long-expired rows so the table doesn't grow unbounded.
    db.query(BlacklistedToken).filter(BlacklistedToken.expires_at < datetime.utcnow()).delete(synchronize_session=False)
    db.commit()


def is_token_blacklisted(db: Session, token: str) -> bool:
    """Check if token is blacklisted (and not yet past its own natural expiry)."""
    from app.models.security import BlacklistedToken

    if not token:
        return False
    token_hash = _hash_token(token)
    return db.query(BlacklistedToken).filter(
        BlacklistedToken.token_hash == token_hash,
        BlacklistedToken.expires_at > datetime.utcnow(),
    ).first() is not None
