from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
from backend.api import ApiError, dispatch, require_session
from backend.retrieval_service import search_project

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        def action(_):
            require_session(self); query = parse_qs(urlparse(self.path).query); project_id = query.get("project_id", [""])[0]; term = query.get("q", [""])[0]
            if not project_id or not term: raise ApiError(400, "MISSING_QUERY", "project_id and q are required")
            return 200, [chunk.__dict__ for chunk in search_project(project_id, term)], None
        dispatch(self, {"GET"}, action)

