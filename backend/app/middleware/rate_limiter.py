"""
DB-backed IP rate limiter for authentication endpoints.
Limits attempts per IP address per time window.

DB-backed (see app/models/security.py::LoginAttempt) so the limit holds
across multiple worker processes and app restarts — an in-memory dict only
protects a single process, meaning an attacker could round-robin across
workers to bypass it entirely.
"""
from datetime import datetime, timedelta
from fastapi import HTTPException, status, Request
from sqlalchemy.orm import Session

MAX_ATTEMPTS = 5
WINDOW_SECONDS = 60
_CLEANUP_AGE = timedelta(hours=1)


def check_rate_limit(db: Session, request: Request) -> None:
    """Enforce rate limit of MAX_ATTEMPTS per WINDOW_SECONDS per IP."""
    from app.models.security import LoginAttempt

    client_ip = request.client.host if request.client else "unknown"
    now = datetime.utcnow()
    cutoff = now - timedelta(seconds=WINDOW_SECONDS)

    # Opportunistic cleanup so the table doesn't grow unbounded.
    db.query(LoginAttempt).filter(LoginAttempt.attempted_at < now - _CLEANUP_AGE).delete(synchronize_session=False)

    recent_count = db.query(LoginAttempt).filter(
        LoginAttempt.ip_address == client_ip,
        LoginAttempt.attempted_at > cutoff,
    ).count()

    if recent_count >= MAX_ATTEMPTS:
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please wait 1 minute before trying again.",
        )

    db.add(LoginAttempt(ip_address=client_ip, attempted_at=now))
    db.commit()
