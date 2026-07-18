from http.server import BaseHTTPRequestHandler
from backend.api import dispatch, read_json, require_session
from backend.document_service import DocumentService

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        def action(_):
            require_session(self); body = read_json(self, max_bytes=40_000_000)
            for field in ("project_id", "filename", "mime_type", "content_base64"):
                if not body.get(field): raise ValueError(f"{field} is required")
            return 201, DocumentService().upload_base64(project_id=body["project_id"], filename=body["filename"], mime_type=body["mime_type"], content_base64=body["content_base64"]), None
        dispatch(self, {"POST"}, action)

