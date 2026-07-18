from http.server import BaseHTTPRequestHandler
from backend.api import ApiError, dispatch, read_json, require_session
from backend.chat_service import ChatService

ANALYSIS_REQUEST = """Analyse the project evidence. Identify project type, final and internal deadlines, deliverables, marking/judging criteria, constraints, submission method, dependencies, effort, unclear requirements, milestones, tasks and subtasks. Build backwards from the final deadline, include testing/submission buffer, and return a structured project_plan proposal. Do not apply it."""

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        def action(_):
            require_session(self); body = read_json(self); project_id = body.get("project_id")
            if not project_id: raise ApiError(400, "MISSING_PROJECT_ID", "Project id is required")
            return 200, ChatService().chat(message=ANALYSIS_REQUEST, channel="web", project_id=project_id), None
        dispatch(self, {"POST"}, action)

