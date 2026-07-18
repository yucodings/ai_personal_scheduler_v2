import base64
from http.server import BaseHTTPRequestHandler
from backend.api import dispatch, read_json, require_session
from backend.document_service import DocumentService

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        def action(_):
            require_session(self); body = read_json(self, max_bytes=40_000_000); content = base64.b64decode(body.get("content_base64", ""), validate=True)
            return 200, DocumentService().extract_and_index(body["document_id"], body["project_id"], content, body["filename"]), None
        dispatch(self, {"POST"}, action)

