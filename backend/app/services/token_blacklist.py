"""
Token blacklist service for invalidating JWT tokens on logout.
Uses an in-memory token registry.
"""
import threading

_blacklisted_tokens: set[str] = set()
_lock = threading.Lock()


def blacklist_token(token: str) -> None:
    """Add a token to the blacklist."""
    if not token:
        return
    with _lock:
        _blacklisted_tokens.add(token)


def is_token_blacklisted(token: str) -> bool:
    """Check if token is blacklisted."""
    if not token:
        return False
    with _lock:
        return token in _blacklisted_tokens
