from http.server import BaseHTTPRequestHandler
from backend.api import dispatch, read_json, require_session
from backend.schemas import DependencyInput
from backend.task_service import TaskService

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        def action(_):
            require_session(self); return 201, TaskService().add_dependency(DependencyInput.model_validate(read_json(self))), None
        dispatch(self, {"POST"}, action)

