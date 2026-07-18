from http.server import BaseHTTPRequestHandler
from backend.api import dispatch, read_json, require_session
from backend.proposal_service import ProposalService
from backend.schemas import ProposalReviewRequest

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        def action(_):
            require_session(self); request = ProposalReviewRequest.model_validate(read_json(self))
            return 200, ProposalService().review(request), None
        dispatch(self, {"POST"}, action)

