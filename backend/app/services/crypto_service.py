"""
AES-256 encryption service for sensitive data at rest.
Uses Fernet symmetric encryption (AES-128-CBC under the hood with HMAC-SHA256).
The ENCRYPTION_KEY must be a Fernet key (44 bytes base64url).

Generate a key:
    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
"""
from cryptography.fernet import Fernet, InvalidToken
from app.config import settings
import base64


def _get_cipher() -> Fernet:
    if not settings.ENCRYPTION_KEY:
        raise RuntimeError(
            "ENCRYPTION_KEY is not set. Cannot encrypt/decrypt sensitive data."
        )
    return Fernet(settings.ENCRYPTION_KEY.encode())


def encrypt_field(plaintext: str) -> bytes:
    """Encrypt a plaintext string → encrypted bytes for storage."""
    if not plaintext:
        return None
    cipher = _get_cipher()
    return cipher.encrypt(plaintext.encode("utf-8"))


def decrypt_field(ciphertext: bytes) -> str:
    """Decrypt stored bytes → plaintext string."""
    if not ciphertext:
        return None
    cipher = _get_cipher()
    try:
        return cipher.decrypt(ciphertext).decode("utf-8")
    except InvalidToken:
        raise ValueError("Failed to decrypt field: invalid or corrupted ciphertext.")


def encrypt_optional(value: str | None) -> bytes | None:
    if value is None:
        return None
    return encrypt_field(value)


def decrypt_optional(value: bytes | None) -> str | None:
    if value is None:
        return None
    return decrypt_field(value)
