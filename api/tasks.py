from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
from backend.api import ApiError, dispatch, parse_pagination, read_json, require_session
from backend.schemas import TaskInput
from backend.task_service import TaskService

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        def action(_):
            require_session(self); project_id = parse_qs(urlparse(self.path).query).get("project_id", [""])[0]
            if not project_id: raise ApiError(400, "MISSING_PROJECT_ID", "Project id is required")
            limit, offset = parse_pagination(self, 50); return 200, TaskService().list(project_id, limit, offset), None
        dispatch(self, {"GET"}, action)
    def do_POST(self):
        def action(_):
            require_session(self); return 201, TaskService().create(TaskInput.model_validate(read_json(self))), None
        dispatch(self, {"POST"}, action)

