"""
In-memory IP rate limiter for authentication endpoints.
Limits attempts per IP address per time window.
"""
from datetime import datetime, timedelta
import threading
from fastapi import HTTPException, status, Request

_ip_attempts: dict[str, list[datetime]] = {}
_lock = threading.Lock()

MAX_ATTEMPTS = 5
WINDOW_SECONDS = 60


def check_rate_limit(request: Request) -> None:
    """Enforce rate limit of MAX_ATTEMPTS per WINDOW_SECONDS per IP."""
    client_ip = request.client.host if request.client else "unknown"
    now = datetime.utcnow()
    cutoff = now - timedelta(seconds=WINDOW_SECONDS)

    with _lock:
        timestamps = _ip_attempts.get(client_ip, [])
        # Filter out expired attempts
        timestamps = [t for t in timestamps if t > cutoff]

        if len(timestamps) >= MAX_ATTEMPTS:
            _ip_attempts[client_ip] = timestamps
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many login attempts. Please wait 1 minute before trying again.",
            )

        timestamps.append(now)
        _ip_attempts[client_ip] = timestamps
