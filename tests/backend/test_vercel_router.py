import json
import threading
from http.server import HTTPServer
from pathlib import Path
from urllib.request import urlopen

from api.index import handler
from backend.http_router import ROUTES, resolve_route


ROOT = Path(__file__).resolve().parents[2]


def test_deployment_uses_one_python_function():
    assert [path.name for path in (ROOT / "api").glob("*.py")] == ["index.py"]


def test_all_vercel_rewrites_target_the_consolidated_function():
    config = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))
    assert config["functions"].keys() == {"api/index.py"}
    for rewrite in config["rewrites"]:
        assert rewrite["destination"].startswith("/api/index?_route=")
        route = rewrite["destination"].split("_route=", 1)[1]
        assert route in ROUTES


def test_route_resolution_preserves_public_api_paths_and_query_parameters():
    assert resolve_route("/api/projects?limit=10") == "projects"
    assert resolve_route("/api/index?_route=documents/search&project_id=123&q=deadline") == "documents/search"


def test_consolidated_function_serves_health_route():
    server = HTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with urlopen(f"http://127.0.0.1:{server.server_port}/api/health", timeout=5) as response:
            payload = json.load(response)
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)

    assert payload["success"] is True
    assert payload["data"]["status"] == "ok"
