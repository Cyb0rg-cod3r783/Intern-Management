from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, UserRole
from app.services.auth_service import (
    authenticate_email_password,
    exchange_google_code,
    get_or_create_google_user,
    create_access_token,
    create_csrf_token,
    is_allowed_domain,
    hash_password,
    change_user_password,
)
from app.services.token_blacklist import blacklist_token
from app.services.audit_service import log_action
from app.models.enums import AuditAction
from app.middleware.rbac import get_current_user, SESSION_COOKIE, CSRF_COOKIE
from app.config import settings
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    email: str
    password: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class TokenResponse(BaseModel):
    # Not populated for browser logins — the session lives in an httpOnly
    # cookie instead (see _set_auth_cookies below), so it never sits in
    # localStorage/JS-readable state where an XSS bug could steal it.
    access_token: Optional[str] = None
    token_type: str = "bearer"
    user: dict


class GoogleCallbackRequest(BaseModel):
    code: str


def user_to_dict(user: User) -> dict:
    return {
        "id": str(user.id),
        "company_email": user.company_email,
        "full_name": user.full_name,
        "role": user.role.value,
    }


def _set_auth_cookies(response: Response, token: str, csrf_token: str) -> None:
    """Set the httpOnly session cookie + the JS-readable CSRF cookie used for
    the double-submit-cookie CSRF defense on state-changing requests."""
    secure = settings.ENVIRONMENT == "production"
    max_age = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    response.set_cookie(
        key=SESSION_COOKIE, value=token, httponly=True, secure=secure,
        samesite="lax", max_age=max_age, path="/",
    )
    response.set_cookie(
        key=CSRF_COOKIE, value=csrf_token, httponly=False, secure=secure,
        samesite="lax", max_age=max_age, path="/",
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/")
    response.delete_cookie(CSRF_COOKIE, path="/")


def _extract_token(request: Request) -> Optional[str]:
    """Read the session token from either the Authorization header (API
    clients) or the session cookie (browser flow) — mirrors get_current_user."""
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header.split(" ", 1)[1]
    return request.cookies.get(SESSION_COOKIE)


from app.middleware.rate_limiter import check_rate_limit


@router.post("/login", response_model=TokenResponse)
def email_password_login(request: Request, response: Response, body: LoginRequest, db: Session = Depends(get_db)):
    """Email/password login — company email only."""
    check_rate_limit(db, request)
    if not is_allowed_domain(body.email):
        raise HTTPException(status_code=400, detail="Only @talakunchi.com and @talakunchi.in emails are permitted.")


    user = authenticate_email_password(db, body.email, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    log_action(db, str(user.id), AuditAction.LOGIN,
               ip_address=request.client.host if request.client else None)
    db.commit()

    token = create_access_token(user)
    _set_auth_cookies(response, token, create_csrf_token())
    return TokenResponse(user=user_to_dict(user))


@router.post("/google/callback", response_model=TokenResponse)
async def google_callback(request: Request, response: Response, body: GoogleCallbackRequest, db: Session = Depends(get_db)):
    """Exchange Google OAuth code for a session token."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=501, detail="Google OAuth is not configured.")

    try:
        google_info = await exchange_google_code(body.code)
        user = get_or_create_google_user(db, google_info)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

    log_action(db, str(user.id), AuditAction.LOGIN,
               metadata={"method": "google_oauth"},
               ip_address=request.client.host if request.client else None)
    db.commit()

    token = create_access_token(user)
    _set_auth_cookies(response, token, create_csrf_token())
    return TokenResponse(user=user_to_dict(user))


@router.get("/google/url")
def get_google_oauth_url():
    """Return the Google OAuth authorization URL for the frontend."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=501, detail="Google OAuth is not configured.")
    base = "https://accounts.google.com/o/oauth2/v2/auth"
    params = (
        f"?client_id={settings.GOOGLE_CLIENT_ID}"
        f"&redirect_uri={settings.GOOGLE_REDIRECT_URI}"
        f"&response_type=code"
        f"&scope=openid%20email%20profile"
    )
    return {"url": base + params}



@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """Return the current user's identity."""
    return user_to_dict(current_user)


@router.put("/change-password")
def change_password(
    request: Request,
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change current user's password."""
    check_rate_limit(db, request)
    try:
        change_user_password(db, current_user, body.old_password, body.new_password)
        return {"message": "Password updated successfully."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/logout")
def logout(request: Request, response: Response, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Blacklist the current session token and clear auth cookies."""
    token = _extract_token(request)
    if token:
        blacklist_token(db, token)
    _clear_auth_cookies(response)
    log_action(db, str(current_user.id), AuditAction.LOGOUT, ip_address=request.client.host if request.client else None)
    db.commit()
    return {"message": "Successfully logged out."}
