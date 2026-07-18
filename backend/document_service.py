from __future__ import annotations

import base64
import hashlib
import re
from pathlib import Path
from typing import Any
from uuid import uuid4

from backend.config import get_settings
from backend.parsers import SUPPORTED_EXTENSIONS, parse_document
from backend.retrieval_service import chunk_text
from backend.supabase_client import SupabaseClient

_SAFE = re.compile(r"[^A-Za-z0-9._-]+")


def sanitize_filename(filename: str) -> str:
    name = Path(filename.replace("\\", "/")).name.strip().replace("..", ".")
    safe = _SAFE.sub("-", name).strip(".-")
    return (safe or "document")[:180]


class DocumentService:
    def __init__(self, db: SupabaseClient | None = None): self.db = db or SupabaseClient(); self.settings = get_settings()
    def upload_base64(self, *, project_id: str, filename: str, mime_type: str, content_base64: str) -> dict[str, Any]:
        try: content = base64.b64decode(content_base64, validate=True)
        except Exception as exc: raise ValueError("Invalid base64 file content") from exc
        if len(content) > self.settings.max_upload_size_mb * 1024 * 1024: raise ValueError("File exceeds the configured upload limit")
        safe_name = sanitize_filename(filename); extension = Path(safe_name).suffix.lower()
        if extension not in SUPPORTED_EXTENSIONS: raise ValueError("Unsupported file type")
        digest = hashlib.sha256(content).hexdigest(); duplicates = self.db.table("project_documents", params={"select": "*", "project_id": f"eq.{project_id}", "sha256_hash": f"eq.{digest}", "limit": 1}) or []
        if duplicates: return {**duplicates[0], "duplicate": True}
        document_id = str(uuid4()); path = f"single-user/projects/{project_id}/documents/{document_id}/{safe_name}"
        self.db.upload(path, content, mime_type)
        rows = self.db.table("project_documents", method="POST", data={"id": document_id, "project_id": project_id, "original_filename": safe_name, "storage_path": path, "extension": extension, "mime_type": mime_type, "file_size": len(content), "sha256_hash": digest, "extraction_status": "pending"}, prefer="return=representation")
        return rows[0]
    def extract_and_index(self, document_id: str, project_id: str, content: bytes, filename: str) -> dict[str, Any]:
        text, method = parse_document(filename, content, max_files=self.settings.max_zip_files, max_uncompressed_mb=self.settings.max_zip_uncompressed_mb, max_compressed_mb=self.settings.max_upload_size_mb)
        return self.finalize(document_id=document_id, project_id=project_id, text=text, method=method)
    def finalize(self, *, document_id: str, project_id: str, text: str, method: str, ocr_confidence: float | None = None) -> dict[str, Any]:
        documents = self.db.table("project_documents", params={"select": "id,project_id,original_filename", "id": f"eq.{document_id}", "project_id": f"eq.{project_id}", "limit": 1}) or []
        if not documents: raise ValueError("Document does not belong to the project")
        chunks = chunk_text(text, self.settings.chunk_size_chars, self.settings.chunk_overlap_chars)
        self.db.table("document_chunks", method="DELETE", params={"document_id": f"eq.{document_id}"})
        if chunks: self.db.table("document_chunks", method="POST", data=[{"document_id": document_id, "project_id": project_id, "chunk_index": index, "content": chunk, "reference": f"chunk {index + 1}", "character_count": len(chunk)} for index, chunk in enumerate(chunks)])
        rows = self.db.table("project_documents", method="PATCH", params={"id": f"eq.{document_id}", "project_id": f"eq.{project_id}"}, data={"extraction_method": method, "extraction_status": "completed", "extracted_text": text, "ocr_confidence": ocr_confidence, "processed_at": "now()", "error_message": None}, prefer="return=representation")
        return {**rows[0], "chunk_count": len(chunks)}

