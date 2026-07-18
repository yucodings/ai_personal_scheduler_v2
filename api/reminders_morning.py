from http.server import BaseHTTPRequestHandler
from backend.api import dispatch, require_bearer
from backend.config import get_settings
from backend.reminder_service import ReminderService

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        def action(_): require_bearer(self, get_settings().cron_secret, "INVALID_CRON_SECRET"); return 200, ReminderService().morning(), None
        dispatch(self, {"POST"}, action)

