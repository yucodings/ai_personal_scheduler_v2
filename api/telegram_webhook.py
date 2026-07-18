from http.server import BaseHTTPRequestHandler
from backend.api import dispatch, read_json, require_telegram_secret
from backend.telegram_service import TelegramService

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        def action(_):
            require_telegram_secret(self); return 200, TelegramService().process_update(read_json(self, max_bytes=2_000_000)), None
        dispatch(self, {"POST"}, action)

