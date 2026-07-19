from http.server import BaseHTTPRequestHandler

from backend.http_router import route_request


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        route_request(self)

    def do_POST(self):
        route_request(self)

    def do_PATCH(self):
        route_request(self)
