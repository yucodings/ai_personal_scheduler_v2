from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler
from backend.api import dispatch, require_session

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        def action(_):
            payload = require_session(self)
            return 200, {"authenticated": True, "expires_at": datetime.fromtimestamp(payload["exp"], timezone.utc).isoformat()}, {"Cache-Control": "no-store"}
        dispatch(self, {"GET"}, action)

