"""
Authentication service.
Supports:
  - Google OAuth (preferred) restricted to ALLOWED_EMAIL_DOMAIN
  - Email/password fallback (company email only)

JWT tokens carry: sub (user_id), email, role.
"""
from datetime import datetime, timedelta
from typing import Optional
import httpx
from jose import JWTError, jwt
import bcrypt
from sqlalchemy.orm import Session
from app.config import settings
from app.models import User, UserRole, AuditAction
from app.services.audit_service import log_action


def hash_password(password: str) -> str:
    pwd_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not plain_password or not hashed_password:
        return False
    pwd_bytes = plain_password.encode("utf-8")[:72]
    hash_bytes = hashed_password.encode("utf-8")
    return bcrypt.checkpw(pwd_bytes, hash_bytes)


def change_user_password(db: Session, user: User, old_password: str, new_password: str) -> None:
    """Change an authenticated user's password."""
    if user.password_hash:
        if not verify_password(old_password, user.password_hash):
            raise ValueError("Current password is incorrect.")

    if not new_password or len(new_password) < 6:
        raise ValueError("New password must be at least 6 characters long.")

    user.password_hash = hash_password(new_password)
    log_action(db, str(user.id), AuditAction.PASSWORD_CHANGED, metadata={"email": user.company_email})
    db.commit()



# ─── JWT helpers ───────────────────────────────────────────────────────────────

def create_access_token(user: User) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user.id),
        "email": user.company_email,
        "role": user.role.value,
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None


# ─── Domain validation ─────────────────────────────────────────────────────────

def is_allowed_domain(email: str) -> bool:
    """Only @talakunchi.com and @talakunchi.in emails are allowed."""
    return settings.is_allowed_email(email)



# ─── Google OAuth ──────────────────────────────────────────────────────────────

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


async def exchange_google_code(code: str) -> dict:
    """Exchange authorization code for Google user info."""
    async with httpx.AsyncClient() as client:
        token_response = await client.post(GOOGLE_TOKEN_URL, data={
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        })
        token_response.raise_for_status()
        tokens = token_response.json()

        userinfo_response = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {tokens['access_token']}"}
        )
        userinfo_response.raise_for_status()
        return userinfo_response.json()


def get_or_create_google_user(db: Session, google_info: dict) -> User:
    """
    Get existing user by google_sub, or match by company email.
    NEVER creates a user automatically via OAuth — users must be pre-created by Admin.
    """
    google_email = google_info.get("email", "").lower()
    google_sub = google_info.get("id") or google_info.get("sub")

    if not is_allowed_domain(google_email):
        raise ValueError(f"Email domain not allowed: {google_email}")

    # Look up by google_sub first
    user = db.query(User).filter(User.google_sub == google_sub).first()
    if user:
        if not user.is_active:
            raise ValueError("Account is deactivated.")
        return user

    # Fall back to email match
    user = db.query(User).filter(User.company_email == google_email).first()
    if not user:
        raise ValueError(
            "No account found for this email. Contact your Admin to create your account."
        )
    if not user.is_active:
        raise ValueError("Account is deactivated.")

    # Link google_sub for future logins
    user.google_sub = google_sub
    db.commit()
    return user


# ─── Email/Password login ──────────────────────────────────────────────────────

def authenticate_email_password(db: Session, email: str, password: str) -> Optional[User]:
    """Authenticate via email + password (fallback if Google Workspace unavailable)."""
    email = email.lower()
    if not is_allowed_domain(email):
        return None

    user = db.query(User).filter(
        User.company_email == email,
        User.is_active == True
    ).first()

    if not user or not user.password_hash:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user
