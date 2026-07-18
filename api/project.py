from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
from backend.api import ApiError, dispatch, read_json, require_session
from backend.project_service import ProjectService

class handler(BaseHTTPRequestHandler):
    def _id(self):
        project_id = parse_qs(urlparse(self.path).query).get("id", [""])[0]
        if not project_id: raise ApiError(400, "MISSING_PROJECT_ID", "Project id is required")
        return project_id
    def do_GET(self):
        def action(_):
            require_session(self); project = ProjectService().get(self._id())
            if not project: raise ApiError(404, "NOT_FOUND", "Project not found")
            return 200, project, None
        dispatch(self, {"GET"}, action)
    def do_PATCH(self):
        def action(_):
            require_session(self)
            return 200, ProjectService().update(self._id(), read_json(self)), None
        dispatch(self, {"PATCH"}, action)

