from http.server import BaseHTTPRequestHandler
from backend.api import dispatch
from backend.config import get_settings

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        def action(_):
            settings = get_settings()
            return 200, {"status": "ok", "services": {"supabase": not bool(settings.missing_for("supabase")), "mimo": not bool(settings.missing_for("mimo")), "telegram": not bool(settings.missing_for("telegram"))}}, None
        dispatch(self, {"GET"}, action)

