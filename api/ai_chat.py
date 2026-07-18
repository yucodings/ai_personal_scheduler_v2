from http.server import BaseHTTPRequestHandler
from backend.api import dispatch, read_json, require_session
from backend.chat_service import ChatService
from backend.schemas import ChatRequest

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        def action(_):
            require_session(self); data = ChatRequest.model_validate(read_json(self))
            return 200, ChatService().chat(message=data.message, channel="web", project_id=str(data.project_id) if data.project_id else None, conversation_id=str(data.conversation_id) if data.conversation_id else None), None
        dispatch(self, {"POST"}, action)

