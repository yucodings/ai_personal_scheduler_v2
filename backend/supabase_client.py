from __future__ import annotations

import json
from typing import Any
from urllib.parse import quote

import requests

from backend.config import Settings, get_settings


class SupabaseError(RuntimeError):
    def __init__(self, message: str, status: int = 500):
        super().__init__(message)
        self.status = status


class SupabaseClient:
    """Server-only PostgREST and Storage client using the service role."""
    def __init__(self, settings: Settings | None = None, session: requests.Session | None = None):
        self.settings = settings or get_settings()
        self.settings.require("supabase")
        self.session = session or requests.Session()
        self.base = self.settings.supabase_url
        self.headers = {"apikey": self.settings.supabase_service_role_key, "Authorization": f"Bearer {self.settings.supabase_service_role_key}", "Content-Type": "application/json"}

    def table(self, table: str, *, method: str = "GET", params: dict[str, Any] | None = None, data: Any = None, prefer: str | None = None) -> Any:
        headers = dict(self.headers)
        if prefer:
            headers["Prefer"] = prefer
        response = self.session.request(method, f"{self.base}/rest/v1/{quote(table, safe='')}", params=params, json=data, headers=headers, timeout=20)
        return self._decode(response)

    def rpc(self, name: str, payload: dict[str, Any]) -> Any:
        response = self.session.post(f"{self.base}/rest/v1/rpc/{quote(name, safe='')}", json=payload, headers=self.headers, timeout=30)
        return self._decode(response)

    def upload(self, path: str, content: bytes, content_type: str, upsert: bool = False) -> Any:
        headers = dict(self.headers); headers["Content-Type"] = content_type; headers["x-upsert"] = "true" if upsert else "false"
        response = self.session.post(f"{self.base}/storage/v1/object/{quote(self.settings.storage_bucket, safe='')}/{quote(path, safe='/')}", data=content, headers=headers, timeout=45)
        return self._decode(response)

    def signed_url(self, path: str, expires_in: int = 300) -> str:
        response = self.session.post(f"{self.base}/storage/v1/object/sign/{quote(self.settings.storage_bucket, safe='')}/{quote(path, safe='/')}", json={"expiresIn": expires_in}, headers=self.headers, timeout=20)
        data = self._decode(response)
        signed = data.get("signedURL") or data.get("signedUrl")
        if not signed:
            raise SupabaseError("Storage did not return a signed URL")
        return f"{self.base}/storage/v1{signed}" if signed.startswith("/") else signed

    @staticmethod
    def _decode(response: requests.Response) -> Any:
        try:
            data = response.json()
        except json.JSONDecodeError:
            data = None
        if not response.ok:
            message = data.get("message") if isinstance(data, dict) else "Supabase request failed"
            raise SupabaseError(message, response.status_code)
        return data

