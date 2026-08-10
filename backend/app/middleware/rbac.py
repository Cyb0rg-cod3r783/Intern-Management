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
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, UserRole
from app.services.auth_service import decode_access_token
import uuid

bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Extract and validate the JWT bearer token → return the authenticated User."""
    token = credentials.credentials
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
