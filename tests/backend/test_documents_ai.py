import io
import json
import zipfile
from uuid import UUID

import pytest
from pydantic import ValidationError

from backend.document_service import sanitize_filename
from backend.mimo_client import parse_ai_envelope
from backend.parsers.text_parser import parse_text
from backend.parsers.zip_parser import inspect_zip, redact_secrets
from backend.proposal_service import proposal_fingerprint
from backend.retrieval_service import RetrievedChunk, build_context, chunk_text
from backend.config import Settings


def make_zip(entries):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name, content in entries.items(): archive.writestr(name, content)
    return buffer.getvalue()


def test_zip_rejects_path_traversal_and_redacts_secrets():
    with pytest.raises(ValueError, match="traversal"):
        inspect_zip(make_zip({"../escape.txt": "bad"}))
    output = inspect_zip(make_zip({"README.md": "Setup", "src/app.py": "API_KEY=super-secret-value-123"}))
    assert "[REDACTED POTENTIAL SECRET]" in output
    assert "super-secret-value" not in output
    assert "src/app.py" in output


def test_zip_limits_and_filename_safety():
    with pytest.raises(ValueError, match="too many"):
        inspect_zip(make_zip({f"{index}.txt": "x" for index in range(3)}), max_files=2)
    assert sanitize_filename("../../unsafe report?.pdf") == "unsafe-report-.pdf"
    assert parse_text(b'{"ok": true}', ".json") == '{\n  "ok": true\n}'


def test_chunking_context_budget_and_project_retrieval_shape():
    chunks = chunk_text("Sentence one. " * 200, chunk_size=200, overlap=20)
    assert len(chunks) > 2 and all(len(chunk) <= 200 for chunk in chunks)
    found = [RetrievedChunk("c1", "d1", "brief.pdf", "page 2", "Evidence " * 100, 0.8)]
    context, citations = build_context(found, Settings(mimo_max_context_chars=120))
    assert len(context) <= 120
    assert citations[0]["filename"] == "brief.pdf"


def test_ai_json_validation_and_advice_only_boundaries():
    envelope = parse_ai_envelope(json.dumps({"reply": "On track", "intent": "query_project", "proposal_required": False, "proposal": None, "citations": [], "warnings": []}))
    assert envelope.reply == "On track"
    with pytest.raises(ValidationError):
        parse_ai_envelope(json.dumps({"reply": "Applied dates", "intent": "reschedule", "proposal_required": False, "proposal": {"type": "reschedule", "project_id": "11111111-1111-4111-8111-111111111111", "summary": "Move", "changes": []}, "citations": [], "warnings": []}))


def test_proposal_fingerprint_is_stable_and_sensitive():
    first = proposal_fingerprint("p", "project_plan", {"b": 2, "a": 1})
    assert first == proposal_fingerprint("p", "project_plan", {"a": 1, "b": 2})
    assert first != proposal_fingerprint("p", "project_plan", {"a": 2, "b": 2})

