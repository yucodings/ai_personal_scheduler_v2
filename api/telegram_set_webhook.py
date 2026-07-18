from http.server import BaseHTTPRequestHandler
from backend.api import dispatch, read_json, require_session
from backend.telegram_client import TelegramClient

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        def action(_): require_session(self); return 200, TelegramClient().webhook_info(), None
        dispatch(self, {"GET"}, action)
    def do_POST(self):
        def action(_): require_session(self); return 200, TelegramClient().set_webhook(read_json(self)["url"]), None
        dispatch(self, {"POST"}, action)

