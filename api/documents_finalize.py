from http.server import BaseHTTPRequestHandler
from backend.api import dispatch, read_json, require_session
from backend.document_service import DocumentService
from backend.schemas import DocumentFinalizeRequest

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        def action(_):
            require_session(self); data = DocumentFinalizeRequest.model_validate(read_json(self, max_bytes=6_000_000))
            return 200, DocumentService().finalize(document_id=str(data.document_id), project_id=str(data.project_id), text=data.extracted_text, method=data.extraction_method, ocr_confidence=data.ocr_confidence), None
        dispatch(self, {"POST"}, action)

