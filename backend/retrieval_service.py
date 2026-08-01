from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from backend.config import Settings, get_settings
from backend.supabase_client import SupabaseClient


@dataclass(frozen=True)
class RetrievedChunk:
    chunk_id: str
    document_id: str
    filename: str
    reference: str
    content: str
    rank: float


def chunk_text(text: str, chunk_size: int = 3000, overlap: int = 300) -> list[str]:
    normalized = "\n".join(line.rstrip() for line in text.replace("\x00", "").splitlines()).strip()
    if not normalized:
        return []
    if chunk_size <= 0 or overlap < 0 or overlap >= chunk_size:
        raise ValueError("Invalid chunk configuration")
    result: list[str] = []
    start = 0
    while start < len(normalized):
        end = min(len(normalized), start + chunk_size)
        if end < len(normalized):
            boundary = max(normalized.rfind("\n", start, end), normalized.rfind(". ", start, end))
            if boundary > start + chunk_size // 2:
                end = boundary + 1
        result.append(normalized[start:end].strip())
        if end >= len(normalized):
            break
        start = end - overlap
    return result


def search_project(project_id: str, query: str, *, limit: int = 8, client: SupabaseClient | None = None) -> list[RetrievedChunk]:
    db = client or SupabaseClient()
    rows = db.rpc("search_project_documents", {"p_project_id": project_id, "p_query": query, "p_limit": min(limit, 20)}) or []
    return [RetrievedChunk(str(row["chunk_id"]), str(row["document_id"]), row["original_filename"], row.get("reference") or f"chunk {row.get('chunk_index', 0) + 1}", row["content"], float(row.get("rank", 0))) for row in rows]


def build_context(chunks: list[RetrievedChunk], settings: Settings | None = None) -> tuple[str, list[dict[str, Any]]]:
    config = settings or get_settings(); pieces: list[str] = []; citations: list[dict[str, Any]] = []; used = 0
    for chunk in chunks:
        heading = f"[Source: {chunk.filename} — {chunk.reference}]\n"
        available = config.ai_max_context_chars - used - len(heading)
        if available <= 0:
            break
        content = chunk.content[:available]; pieces.append(heading + content); used += len(heading) + len(content)
        citations.append({"document_id": chunk.document_id, "filename": chunk.filename, "reference": chunk.reference, "chunk_id": chunk.chunk_id})
    return "\n\n".join(pieces), citations
