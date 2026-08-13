"""Small shared helpers."""
import uuid
from fastapi import HTTPException


def parse_uuid(value: str, label: str = "ID") -> uuid.UUID:
    """Parse a UUID path/query param, raising a clean 400 instead of an
    unhandled ValueError (which would otherwise surface as a raw 500)."""
    try:
        return uuid.UUID(str(value))
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(status_code=400, detail=f"Invalid {label} format.")
