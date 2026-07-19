from __future__ import annotations

import base64
from datetime import datetime, timezone
from typing import Any, Callable
from urllib.parse import parse_qs, urlparse

from backend.api import (
    ApiError,
    dispatch,
    parse_pagination,
    read_json,
    require_bearer,
    require_session,
    require_telegram_secret,
)
from backend.auth_service import create_session, login_throttle, verify_password
from backend.chat_service import ChatService
from backend.config import get_settings
from backend.document_service import DocumentService
from backend.project_service import ProjectService
from backend.proposal_service import ProposalService
from backend.reminder_service import ReminderService
from backend.retrieval_service import search_project
from backend.schemas import (
    ChatRequest,
    DependencyInput,
    DocumentFinalizeRequest,
    LoginRequest,
    MilestoneInput,
    ProjectInput,
    ProposalReviewRequest,
    TaskInput,
    TaskProgressInput,
)
from backend.supabase_client import SupabaseClient
from backend.task_service import TaskService
from backend.telegram_client import TelegramClient
from backend.telegram_service import TelegramService

Response = tuple[int, Any, dict[str, str] | None]
RouteAction = Callable[[Any], Response]

ANALYSIS_REQUEST = """Analyse the project evidence. Identify project type, final and internal deadlines, deliverables, marking/judging criteria, constraints, submission method, dependencies, effort, unclear requirements, milestones, tasks and subtasks. Build backwards from the final deadline, include testing/submission buffer, and return a structured project_plan proposal. Do not apply it."""


def _health(_handler) -> Response:
    settings = get_settings()
    return 200, {
        "status": "ok",
        "services": {
            "supabase": not bool(settings.missing_for("supabase")),
            "mimo": not bool(settings.missing_for("mimo")),
            "telegram": not bool(settings.missing_for("telegram")),
        },
    }, None


def _auth_login(handler) -> Response:
    settings = get_settings()
    settings.require("auth")
    fingerprint = handler.headers.get(
        "X-Forwarded-For",
        handler.client_address[0] if handler.client_address else "unknown",
    ).split(",")[0].strip()
    allowed, retry_after = login_throttle.allowed(fingerprint)
    if not allowed:
        raise ApiError(429, "LOGIN_COOLDOWN", f"Too many attempts. Try again in {retry_after} seconds.")
    request = LoginRequest.model_validate(read_json(handler))
    if not verify_password(request.password, settings.app_login_password_hash):
        login_throttle.failure(fingerprint)
        raise ApiError(401, "INVALID_CREDENTIALS", "Password is incorrect")
    login_throttle.success(fingerprint)
    token, expires = create_session(settings)
    cookie = f"skyler_session={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={settings.session_expiry_hours * 3600}"
    if settings.production:
        cookie += "; Secure"
    return 200, {"authenticated": True, "expires_at": expires.isoformat()}, {
        "Set-Cookie": cookie,
        "Cache-Control": "no-store",
    }


def _auth_logout(handler) -> Response:
    require_session(handler)
    return 200, {"authenticated": False}, {
        "Set-Cookie": "skyler_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0",
        "Cache-Control": "no-store",
    }


def _auth_session(handler) -> Response:
    payload = require_session(handler)
    expires = datetime.fromtimestamp(payload["exp"], timezone.utc).isoformat()
    return 200, {"authenticated": True, "expires_at": expires}, {"Cache-Control": "no-store"}


def _projects_get(handler) -> Response:
    require_session(handler)
    limit, offset = parse_pagination(handler)
    return 200, ProjectService().list(limit=limit, offset=offset), None


def _projects_post(handler) -> Response:
    require_session(handler)
    data = ProjectInput.model_validate(read_json(handler))
    return 201, ProjectService().create(data), None


def _project_id(handler) -> str:
    project_id = parse_qs(urlparse(handler.path).query).get("id", [""])[0]
    if not project_id:
        raise ApiError(400, "MISSING_PROJECT_ID", "Project id is required")
    return project_id


def _project_get(handler) -> Response:
    require_session(handler)
    project = ProjectService().get(_project_id(handler))
    if not project:
        raise ApiError(404, "NOT_FOUND", "Project not found")
    return 200, project, None


def _project_patch(handler) -> Response:
    require_session(handler)
    return 200, ProjectService().update(_project_id(handler), read_json(handler)), None


def _milestones_get(handler) -> Response:
    require_session(handler)
    project_id = parse_qs(urlparse(handler.path).query).get("project_id", [""])[0]
    if not project_id:
        raise ApiError(400, "MISSING_PROJECT_ID", "Project id is required")
    data = SupabaseClient().table(
        "milestones",
        params={"select": "*", "project_id": f"eq.{project_id}", "order": "sequence.asc"},
    ) or []
    return 200, data, None


def _milestones_post(handler) -> Response:
    require_session(handler)
    data = MilestoneInput.model_validate(read_json(handler))
    created = SupabaseClient().table(
        "milestones",
        method="POST",
        data=data.model_dump(mode="json"),
        prefer="return=representation",
    )[0]
    return 201, created, None


def _tasks_get(handler) -> Response:
    require_session(handler)
    project_id = parse_qs(urlparse(handler.path).query).get("project_id", [""])[0]
    if not project_id:
        raise ApiError(400, "MISSING_PROJECT_ID", "Project id is required")
    limit, offset = parse_pagination(handler, 50)
    return 200, TaskService().list(project_id, limit, offset), None


def _tasks_post(handler) -> Response:
    require_session(handler)
    data = TaskInput.model_validate(read_json(handler))
    return 201, TaskService().create(data), None


def _task_dependency_post(handler) -> Response:
    require_session(handler)
    data = DependencyInput.model_validate(read_json(handler))
    return 201, TaskService().add_dependency(data), None


def _progress_post(handler) -> Response:
    require_session(handler)
    data = TaskProgressInput.model_validate(read_json(handler))
    return 200, TaskService().update_progress(data), None


def _documents_upload(handler) -> Response:
    require_session(handler)
    body = read_json(handler, max_bytes=40_000_000)
    for field in ("project_id", "filename", "mime_type", "content_base64"):
        if not body.get(field):
            raise ApiError(400, "MISSING_FIELD", f"{field} is required")
    result = DocumentService().upload_base64(
        project_id=body["project_id"],
        filename=body["filename"],
        mime_type=body["mime_type"],
        content_base64=body["content_base64"],
    )
    return 201, result, None


def _documents_finalize(handler) -> Response:
    require_session(handler)
    data = DocumentFinalizeRequest.model_validate(read_json(handler, max_bytes=6_000_000))
    result = DocumentService().finalize(
        document_id=str(data.document_id),
        project_id=str(data.project_id),
        text=data.extracted_text,
        method=data.extraction_method,
        ocr_confidence=data.ocr_confidence,
    )
    return 200, result, None


def _documents_extract(handler) -> Response:
    require_session(handler)
    body = read_json(handler, max_bytes=40_000_000)
    content = base64.b64decode(body.get("content_base64", ""), validate=True)
    result = DocumentService().extract_and_index(
        body["document_id"], body["project_id"], content, body["filename"]
    )
    return 200, result, None


def _documents_search(handler) -> Response:
    require_session(handler)
    query = parse_qs(urlparse(handler.path).query)
    project_id = query.get("project_id", [""])[0]
    term = query.get("q", [""])[0]
    if not project_id or not term:
        raise ApiError(400, "MISSING_QUERY", "project_id and q are required")
    return 200, [chunk.__dict__ for chunk in search_project(project_id, term)], None


def _ai_chat(handler) -> Response:
    require_session(handler)
    data = ChatRequest.model_validate(read_json(handler))
    result = ChatService().chat(
        message=data.message,
        channel="web",
        project_id=str(data.project_id) if data.project_id else None,
        conversation_id=str(data.conversation_id) if data.conversation_id else None,
    )
    return 200, result, None


def _ai_analyze_project(handler) -> Response:
    require_session(handler)
    body = read_json(handler)
    project_id = body.get("project_id")
    if not project_id:
        raise ApiError(400, "MISSING_PROJECT_ID", "Project id is required")
    result = ChatService().chat(message=ANALYSIS_REQUEST, channel="web", project_id=project_id)
    return 200, result, None


def _ai_proposal(handler) -> Response:
    require_session(handler)
    request = ProposalReviewRequest.model_validate(read_json(handler))
    return 200, ProposalService().review(request), None


def _telegram_webhook(handler) -> Response:
    require_telegram_secret(handler)
    result = TelegramService().process_update(read_json(handler, max_bytes=2_000_000))
    return 200, result, None


def _telegram_webhook_info(handler) -> Response:
    require_session(handler)
    return 200, TelegramClient().webhook_info(), None


def _telegram_set_webhook(handler) -> Response:
    require_session(handler)
    return 200, TelegramClient().set_webhook(read_json(handler)["url"]), None


def _reminders_morning(handler) -> Response:
    require_bearer(handler, get_settings().cron_secret, "INVALID_CRON_SECRET")
    return 200, ReminderService().morning(), None


def _reminders_evening(handler) -> Response:
    require_bearer(handler, get_settings().cron_secret, "INVALID_CRON_SECRET")
    return 200, ReminderService().evening(), None


ROUTES: dict[str, dict[str, RouteAction]] = {
    "health": {"GET": _health},
    "auth/login": {"POST": _auth_login},
    "auth/logout": {"POST": _auth_logout},
    "auth/session": {"GET": _auth_session},
    "projects": {"GET": _projects_get, "POST": _projects_post},
    "project": {"GET": _project_get, "PATCH": _project_patch},
    "milestones": {"GET": _milestones_get, "POST": _milestones_post},
    "tasks": {"GET": _tasks_get, "POST": _tasks_post},
    "task-dependencies": {"POST": _task_dependency_post},
    "task_dependencies": {"POST": _task_dependency_post},
    "progress": {"POST": _progress_post},
    "documents/upload": {"POST": _documents_upload},
    "documents/finalize": {"POST": _documents_finalize},
    "documents/extract": {"POST": _documents_extract},
    "documents/search": {"GET": _documents_search},
    "ai/chat": {"POST": _ai_chat},
    "ai/analyze-project": {"POST": _ai_analyze_project},
    "ai/proposal": {"POST": _ai_proposal},
    "telegram/webhook": {"POST": _telegram_webhook},
    "telegram/set-webhook": {"GET": _telegram_webhook_info, "POST": _telegram_set_webhook},
    "reminders/morning": {"POST": _reminders_morning},
    "reminders/evening": {"POST": _reminders_evening},
}


def resolve_route(path: str) -> str:
    parsed = urlparse(path)
    query_route = parse_qs(parsed.query).get("_route", [""])[0]
    if query_route:
        return query_route.strip("/")
    clean_path = parsed.path.strip("/")
    if clean_path.startswith("api/"):
        return clean_path[4:]
    return clean_path


def route_request(handler) -> None:
    route = resolve_route(handler.path)
    route_methods = ROUTES.get(route)
    allowed_methods = set(route_methods) if route_methods else {handler.command.upper()}

    def action(_request_id: str) -> Response:
        if not route_methods:
            raise ApiError(404, "NOT_FOUND", "API route not found")
        route_action = route_methods.get(handler.command.upper())
        if not route_action:
            raise ApiError(
                405,
                "METHOD_NOT_ALLOWED",
                f"Allowed methods: {', '.join(sorted(route_methods))}",
            )
        return route_action(handler)

    dispatch(handler, allowed_methods, action)
