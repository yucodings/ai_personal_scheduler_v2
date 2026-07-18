from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
from backend.api import ApiError, dispatch, read_json, require_session
from backend.schemas import MilestoneInput
from backend.supabase_client import SupabaseClient

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        def action(_):
            require_session(self); project_id = parse_qs(urlparse(self.path).query).get("project_id", [""])[0]
            if not project_id: raise ApiError(400, "MISSING_PROJECT_ID", "Project id is required")
            return 200, SupabaseClient().table("milestones", params={"select": "*", "project_id": f"eq.{project_id}", "order": "sequence.asc"}) or [], None
        dispatch(self, {"GET"}, action)
    def do_POST(self):
        def action(_):
            require_session(self); data = MilestoneInput.model_validate(read_json(self))
            return 201, SupabaseClient().table("milestones", method="POST", data=data.model_dump(mode="json"), prefer="return=representation")[0], None
        dispatch(self, {"POST"}, action)

