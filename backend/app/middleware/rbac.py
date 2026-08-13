"""
RBAC Dependencies — FastAPI dependency injection for role-based access control.

Usage in routers:
    @router.get("/interns")
    def get_interns(current_user: User = Depends(get_current_user)):
        ...

    @router.post("/interns")
    def create_intern(current_user: User = Depends(require_admin)):
        ...

    @router.put("/interns/{intern_id}")
    def update_intern(intern_id, current_user: User = Depends(require_admin_or_manager)):
        # Further check ownership in handler for managers
        ...
"""
from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, UserRole
from app.services.auth_service import decode_access_token
from app.services.token_blacklist import is_token_blacklisted
import uuid

# auto_error=False: a request may instead be authenticated via the httpOnly
# session cookie (browser flow) rather than an Authorization header.
bearer_scheme = HTTPBearer(auto_error=False)

SESSION_COOKIE = "tk_session"
CSRF_COOKIE = "tk_csrf"
CSRF_HEADER = "X-CSRF-Token"
_UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Extract and validate the session → return the authenticated User.

    Accepts either an `Authorization: Bearer <jwt>` header (API/non-browser
    clients) or the `tk_session` httpOnly cookie (the web frontend). Cookie-
    authenticated requests must also carry a matching `X-CSRF-Token` header
    on state-changing methods (double-submit-cookie CSRF defense) — the
    Bearer-header path is not vulnerable to CSRF, since a third-party page
    cannot read or set that header on a forged cross-site request.
    """
    via_cookie = False
    if credentials:
        token = credentials.credentials
    else:
        token = request.cookies.get(SESSION_COOKIE)
        via_cookie = bool(token)

    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")

    if via_cookie and request.method in _UNSAFE_METHODS:
        csrf_cookie = request.cookies.get(CSRF_COOKIE)
        csrf_header = request.headers.get(CSRF_HEADER)
        if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF token missing or invalid.")

    if is_token_blacklisted(db, token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been logged out or revoked.",
        )

    payload = decode_access_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload.")

    user = db.query(User).filter(User.id == uuid.UUID(user_id), User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or deactivated.")

    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return current_user


def require_manager(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (UserRole.ADMIN, UserRole.MANAGER):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager or Admin access required.",
        )
    return current_user


def require_admin_or_manager(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (UserRole.ADMIN, UserRole.MANAGER):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager or Admin access required.",
        )
    return current_user


def require_intern(current_user: User = Depends(get_current_user)) -> User:
    """Require that the user is an intern (all roles still have access to basic auth)."""
    return current_user


def assert_can_edit_intern(current_user: User, intern_profile) -> None:
    """
    Server-side enforcement: a Manager can only EDIT interns they manage.
    Raises HTTP 403 if not permitted.
    """
    if current_user.role == UserRole.ADMIN:
        return  # Admin can edit any intern

    if current_user.role == UserRole.MANAGER:
        if str(intern_profile.reporting_manager_id) != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only edit interns assigned to you as their reporting manager.",
            )
        return

    # Intern or other role: deny
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have permission to edit intern records.",
    )


def assert_can_manage_task(current_user: User, task, intern_profile) -> None:
    """
    Server-side enforcement for task management.
    - Admin: always allowed
    - Manager: only for their own interns
    - Intern: only for their own tasks (limited operations)
    """
    if current_user.role == UserRole.ADMIN:
        return

    if current_user.role == UserRole.MANAGER:
        if str(intern_profile.reporting_manager_id) != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only manage tasks for interns assigned to you.",
            )
        return

    if current_user.role == UserRole.INTERN:
        if str(task.intern_id) != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only manage your own tasks.",
            )
        return

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")


def assert_can_manage_handover(current_user: User, intern_profile) -> None:
    """
    Only Managers who directly manage the intern, or Admins, can create/manage handovers.
    """
    if current_user.role == UserRole.ADMIN:
        return

    if current_user.role == UserRole.MANAGER:
        if str(intern_profile.reporting_manager_id) != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only initiate handovers for interns assigned to you.",
            )
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Only managers can initiate handovers.",
    )
