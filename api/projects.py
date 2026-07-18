from http.server import BaseHTTPRequestHandler
from backend.api import dispatch, parse_pagination, read_json, require_session
from backend.project_service import ProjectService
from backend.schemas import ProjectInput

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        def action(_):
            require_session(self); limit, offset = parse_pagination(self)
            return 200, ProjectService().list(limit=limit, offset=offset), None
        dispatch(self, {"GET"}, action)
    def do_POST(self):
        def action(_):
            require_session(self); data = ProjectInput.model_validate(read_json(self))
            return 201, ProjectService().create(data), None
        dispatch(self, {"POST"}, action)

