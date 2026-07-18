from __future__ import annotations

import hmac
import json
import uuid
from dataclasses import asdict, is_dataclass
from datetime import date, datetime
from http.cookies import SimpleCookie
from typing import Any, Callable

from pydantic import ValidationError

from backend.auth_service import verify_session
from backend.config import ConfigurationError, get_settings
from backend.logging_utils import safe_log


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def envelope(data: Any = None, *, error: dict[str, str] | None = None, request_id: str | None = None) -> dict[str, Any]:
    return {"success": error is None, "data": data if error is None else None, "error": error, "request_id": request_id or str(uuid.uuid4())}


def json_default(value: Any) -> Any:
    if isinstance(value, (datetime, date)): return value.isoformat()
    if is_dataclass(value): return asdict(value)
    if hasattr(value, "model_dump"): return value.model_dump(mode="json")
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def read_json(handler, max_bytes: int = 1_000_000) -> dict[str, Any]:
    try:
        length = int(handler.headers.get("Content-Length", "0"))
    except ValueError as exc:
        raise ApiError(400, "INVALID_CONTENT_LENGTH", "Invalid Content-Length header") from exc
    if length <= 0: return {}
    if length > max_bytes: raise ApiError(413, "PAYLOAD_TOO_LARGE", "Request body is too large")
    try:
        value = json.loads(handler.rfile.read(length))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise ApiError(400, "INVALID_JSON", "Request body must be valid JSON") from exc
    if not isinstance(value, dict): raise ApiError(400, "INVALID_JSON", "Request body must be a JSON object")
    return value


def get_cookie(handler, name: str) -> str | None:
    raw = handler.headers.get("Cookie", "")
    cookie = SimpleCookie(); cookie.load(raw)
    return cookie[name].value if name in cookie else None


def require_session(handler) -> dict[str, Any]:
    token = get_cookie(handler, "skyler_session")
    if not token: raise ApiError(401, "AUTH_REQUIRED", "Authentication is required")
    try:
        return verify_session(token, get_settings())
    except ValueError as exc:
        raise ApiError(401, "INVALID_SESSION", "Session is invalid or expired") from exc


def require_bearer(handler, expected: str, code: str = "UNAUTHORIZED") -> None:
    supplied = handler.headers.get("Authorization", "")
    if not expected or not hmac.compare_digest(supplied, f"Bearer {expected}"):
        raise ApiError(401, code, "Request authentication failed")


def require_telegram_secret(handler) -> None:
    supplied = handler.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
    expected = get_settings().telegram_webhook_secret
    if not expected or not hmac.compare_digest(supplied, expected):
        raise ApiError(401, "INVALID_WEBHOOK", "Request authentication failed")


def parse_pagination(handler, default_limit: int = 25, max_limit: int = 100) -> tuple[int, int]:
    from urllib.parse import parse_qs, urlparse
    query = parse_qs(urlparse(handler.path).query)
    try:
        limit = min(max(1, int(query.get("limit", [default_limit])[0])), max_limit)
        offset = max(0, int(query.get("offset", [0])[0]))
    except ValueError as exc:
        raise ApiError(400, "INVALID_PAGINATION", "Pagination values must be integers") from exc
    return limit, offset


def dispatch(handler, allowed_methods: set[str], action: Callable[[str], tuple[int, Any, dict[str, str] | None]]) -> None:
    request_id = str(uuid.uuid4())
    method = handler.command.upper()
    try:
        if method not in allowed_methods:
            raise ApiError(405, "METHOD_NOT_ALLOWED", f"Allowed methods: {', '.join(sorted(allowed_methods))}")
        status, data, headers = action(request_id)
        handler.send_response(status)
        handler.send_header("Content-Type", "application/json; charset=utf-8")
        handler.send_header("X-Request-ID", request_id)
        for key, value in (headers or {}).items(): handler.send_header(key, value)
        body = json.dumps(envelope(data, request_id=request_id), default=json_default).encode("utf-8")
    except ValidationError as exc:
        status = 422; body = json.dumps(envelope(error={"code": "VALIDATION_ERROR", "message": exc.errors(include_url=False)[0]["msg"]}, request_id=request_id)).encode()
    except ConfigurationError as exc:
        status = 503; body = json.dumps(envelope(error={"code": "NOT_CONFIGURED", "message": str(exc)}, request_id=request_id)).encode()
    except ApiError as exc:
        status = exc.status; body = json.dumps(envelope(error={"code": exc.code, "message": exc.message}, request_id=request_id)).encode()
    except Exception as exc:
        safe_log("unhandled_api_error", request_id=request_id, error_type=type(exc).__name__)
        status = 500; body = json.dumps(envelope(error={"code": "INTERNAL_ERROR", "message": "The request could not be completed"}, request_id=request_id)).encode()
    if not getattr(handler, "_headers_buffer", None):
        handler.send_response(status); handler.send_header("Content-Type", "application/json; charset=utf-8"); handler.send_header("X-Request-ID", request_id)
    handler.send_header("Content-Length", str(len(body))); handler.end_headers(); handler.wfile.write(body)

