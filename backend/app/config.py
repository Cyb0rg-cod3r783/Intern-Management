from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Optional
import os


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/intern_management"
    SECRET_KEY: str = "change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # Google OAuth
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_REDIRECT_URI: str = "http://localhost:3000/auth/callback"

    ALLOWED_EMAIL_DOMAINS: list[str] = ["talakunchi.com", "talakunchi.in"]

    def is_allowed_email(self, email: str) -> bool:
        if not email or "@" not in email:
            return False
        domain = email.split("@")[-1].lower()
        return domain in [d.lower() for d in self.ALLOWED_EMAIL_DOMAINS]


    # Encryption
    ENCRYPTION_KEY: Optional[str] = None

    # CORS
    FRONTEND_URL: str = "http://localhost:3000"

    ENVIRONMENT: str = "development"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

# ─── Startup safety checks ──────────────────────────────────────────────────────
# Refuse to boot in production with a default/placeholder secret — a known SECRET_KEY
# lets anyone forge valid JWTs (full account takeover for any user/role).
_WEAK_SECRET_KEYS = {"change-me", "change-me-to-a-long-random-secret-key-at-least-64-chars", ""}
if settings.ENVIRONMENT == "production":
    if settings.SECRET_KEY in _WEAK_SECRET_KEYS or len(settings.SECRET_KEY) < 32:
        raise RuntimeError(
            "SECRET_KEY is missing or using a default/weak placeholder value. "
            "Set a long, random SECRET_KEY (e.g. `openssl rand -hex 32`) before running in production."
        )
    if not settings.ENCRYPTION_KEY:
        raise RuntimeError(
            "ENCRYPTION_KEY is not set. Required in production to store sensitive intern data (bank details) encrypted."
        )
