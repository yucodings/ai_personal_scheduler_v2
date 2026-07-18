from __future__ import annotations

import hmac
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError

from backend.config import Settings

_hasher = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=4)


def hash_password(password: str) -> str:
    if len(password) < 10: raise ValueError("Password must contain at least 10 characters")
    return _hasher.hash(password)


def verify_password(password: str, encoded_hash: str) -> bool:
    if not encoded_hash: return False
    try: return _hasher.verify(encoded_hash, password)
    except (VerifyMismatchError, InvalidHashError): return False


def create_session(settings: Settings, now: datetime | None = None) -> tuple[str, datetime]:
    if not settings.jwt_secret: raise ValueError("JWT secret is not configured")
    issued = now or datetime.now(timezone.utc); expires = issued + timedelta(hours=settings.session_expiry_hours)
    token = jwt.encode({"sub": "single-user", "authenticated": True, "iat": issued, "exp": expires, "jti": __import__("uuid").uuid4().hex}, settings.jwt_secret, algorithm="HS256")
    return token, expires


def verify_session(token: str, settings: Settings) -> dict[str, Any]:
    if not settings.jwt_secret: raise ValueError("JWT secret is not configured")
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"], options={"require": ["exp", "iat", "sub"]})
    except jwt.PyJWTError as exc: raise ValueError("Invalid session") from exc
    if payload.get("sub") != "single-user" or payload.get("authenticated") is not True: raise ValueError("Invalid session")
    return payload


class LoginThrottle:
    """Small process-local first line; production also records attempts in PostgreSQL."""
    def __init__(self, max_attempts: int = 5, window_seconds: int = 900, cooldown_seconds: int = 60):
        self.max_attempts = max_attempts; self.window_seconds = window_seconds; self.cooldown_seconds = cooldown_seconds
        self._attempts: dict[str, deque[float]] = defaultdict(deque); self._lock = Lock()

    def allowed(self, fingerprint: str, now: float | None = None) -> tuple[bool, int]:
        current = now if now is not None else time.time()
        with self._lock:
            attempts = self._attempts[fingerprint]
            while attempts and attempts[0] <= current - self.window_seconds: attempts.popleft()
            if len(attempts) < self.max_attempts: return True, 0
            retry = max(1, int(self.cooldown_seconds - (current - attempts[-1])))
            return (retry <= 0), max(0, retry)

    def failure(self, fingerprint: str, now: float | None = None) -> None:
        with self._lock: self._attempts[fingerprint].append(now if now is not None else time.time())

    def success(self, fingerprint: str) -> None:
        with self._lock: self._attempts.pop(fingerprint, None)


login_throttle = LoginThrottle()


def secure_equal(left: str, right: str) -> bool:
    return bool(left and right and hmac.compare_digest(left, right))

