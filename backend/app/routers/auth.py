from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, UserRole
from app.services.auth_service import (
    authenticate_email_password,
    exchange_google_code,
    get_or_create_google_user,
    create_access_token,
    is_allowed_domain,
    hash_password,
)
from app.services.audit_service import log_action
from app.models.enums import AuditAction
from app.middleware.rbac import get_current_user
from app.config import settings
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
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


@router.post("/login", response_model=TokenResponse)
def email_password_login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    """Email/password login — company email only."""
    if not is_allowed_domain(body.email):
        raise HTTPException(status_code=400, detail="Only @talakunchi.com and @talakunchi.in emails are permitted.")


    user = authenticate_email_password(db, body.email, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    log_action(db, str(user.id), AuditAction.LOGIN,
               ip_address=request.client.host if request.client else None)
    db.commit()

    token = create_access_token(user)
    return TokenResponse(access_token=token, user=user_to_dict(user))


@router.post("/google/callback", response_model=TokenResponse)
async def google_callback(request: Request, body: GoogleCallbackRequest, db: Session = Depends(get_db)):
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
    return TokenResponse(access_token=token, user=user_to_dict(user))


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
