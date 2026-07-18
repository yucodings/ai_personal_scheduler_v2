from http.server import BaseHTTPRequestHandler
from backend.api import ApiError, dispatch, read_json
from backend.auth_service import create_session, login_throttle, verify_password
from backend.config import get_settings
from backend.schemas import LoginRequest

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        def action(_):
            settings = get_settings(); settings.require("auth")
            fingerprint = self.headers.get("X-Forwarded-For", self.client_address[0] if self.client_address else "unknown").split(",")[0].strip()
            allowed, retry_after = login_throttle.allowed(fingerprint)
            if not allowed: raise ApiError(429, "LOGIN_COOLDOWN", f"Too many attempts. Try again in {retry_after} seconds.")
            request = LoginRequest.model_validate(read_json(self))
            if not verify_password(request.password, settings.app_login_password_hash):
                login_throttle.failure(fingerprint); raise ApiError(401, "INVALID_CREDENTIALS", "Password is incorrect")
            login_throttle.success(fingerprint); token, expires = create_session(settings)
            cookie = f"skyler_session={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={settings.session_expiry_hours * 3600}"
            if settings.production: cookie += "; Secure"
            return 200, {"authenticated": True, "expires_at": expires.isoformat()}, {"Set-Cookie": cookie, "Cache-Control": "no-store"}
        dispatch(self, {"POST"}, action)

