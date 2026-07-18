from http.server import BaseHTTPRequestHandler
from backend.api import dispatch, require_session

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        def action(_):
            require_session(self)
            return 200, {"authenticated": False}, {"Set-Cookie": "skyler_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0", "Cache-Control": "no-store"}
        dispatch(self, {"POST"}, action)

