import hashlib
import uuid
from datetime import UTC, datetime, timedelta
from typing import Literal

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.config import get_settings

TokenKind = Literal["access", "refresh", "reset"]
RESET_TOKEN_MINUTES = 30
ALGORITHM = "HS256"

_hasher = PasswordHasher()
# Verified against when the e-mail is unknown, so response time doesn't reveal which e-mails exist.
DUMMY_HASH = _hasher.hash("planit-timing-equaliser")


class InvalidToken(Exception):
    pass


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def password_needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)


def password_fingerprint(password_hash: str) -> str:
    """Short digest of the current password hash. A reset token embeds it, so the token stops
    working as soon as the password changes (single use) without storing anything server-side."""
    return hashlib.sha256(password_hash.encode()).hexdigest()[:16]


def create_token(
    user_id: int, token_version: int, kind: TokenKind, extra: dict | None = None
) -> str:
    s = get_settings()
    now = datetime.now(UTC)
    if kind == "access":
        ttl = timedelta(minutes=s.access_token_minutes)
    elif kind == "reset":
        ttl = timedelta(minutes=RESET_TOKEN_MINUTES)
    else:
        ttl = timedelta(days=s.refresh_token_days)
    claims = {
        "sub": str(user_id),
        "ver": token_version,
        "typ": kind,
        "iat": now,
        "exp": now + ttl,
        "jti": uuid.uuid4().hex,
        **(extra or {}),
    }
    return jwt.encode(claims, s.secret_key, algorithm=ALGORITHM)


def decode_token(token: str, kind: TokenKind) -> dict:
    try:
        claims = jwt.decode(
            token,
            get_settings().secret_key,
            algorithms=[ALGORITHM],  # never trust the header's alg
            options={"require": ["exp", "iat", "sub", "typ", "ver"]},
        )
    except jwt.PyJWTError as exc:
        raise InvalidToken from exc
    if claims.get("typ") != kind:  # an access token must not work as a refresh token, and vice versa
        raise InvalidToken
    return claims
