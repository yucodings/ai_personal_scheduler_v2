from __future__ import annotations

import json
from typing import Any
from urllib.parse import quote, urlparse

import requests

from backend.config import Settings, get_settings


class SupabaseError(RuntimeError):
    def __init__(self, message: str, status: int = 500, provider_code: str = ""):
        super().__init__(message)
        self.status = status
        self.provider_code = provider_code


class SupabaseClient:
    """Server-only PostgREST and Storage client using the service role."""
    def __init__(self, settings: Settings | None = None, session: requests.Session | None = None):
        self.settings = settings or get_settings()
        self.settings.require("supabase")
        self.session = session or requests.Session()
        self.base = self.settings.supabase_url
        parsed_url = urlparse(self.base)
        if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
            raise SupabaseError(
                "SUPABASE_URL is not an HTTP project URL",
                status=503,
                provider_code="INVALID_URL",
            )
        server_key = self.settings.supabase_service_role_key
        self.headers = {"apikey": server_key, "Content-Type": "application/json"}
        # New Supabase secret keys are API keys, not JWTs. Legacy service_role
        # keys still need the Bearer header for PostgREST and Storage.
        if not server_key.startswith("sb_secret_"):
            self.headers["Authorization"] = f"Bearer {server_key}"

    def table(self, table: str, *, method: str = "GET", params: dict[str, Any] | None = None, data: Any = None, prefer: str | None = None) -> Any:
        headers = dict(self.headers)
        if prefer:
            headers["Prefer"] = prefer
        response = self._request(method, f"{self.base}/rest/v1/{quote(table, safe='')}", params=params, json=data, headers=headers, timeout=20)
        return self._decode(response)

    def rpc(self, name: str, payload: dict[str, Any]) -> Any:
        response = self._request("POST", f"{self.base}/rest/v1/rpc/{quote(name, safe='')}", json=payload, headers=self.headers, timeout=30)
        return self._decode(response)

    def upload(self, path: str, content: bytes, content_type: str, upsert: bool = False) -> Any:
        headers = dict(self.headers); headers["Content-Type"] = content_type; headers["x-upsert"] = "true" if upsert else "false"
        response = self._request("POST", f"{self.base}/storage/v1/object/{quote(self.settings.storage_bucket, safe='')}/{quote(path, safe='/')}", data=content, headers=headers, timeout=45)
        return self._decode(response)

    def signed_url(self, path: str, expires_in: int = 300) -> str:
        response = self._request("POST", f"{self.base}/storage/v1/object/sign/{quote(self.settings.storage_bucket, safe='')}/{quote(path, safe='/')}", json={"expiresIn": expires_in}, headers=self.headers, timeout=20)
        data = self._decode(response)
        signed = data.get("signedURL") or data.get("signedUrl")
        if not signed:
            raise SupabaseError("Storage did not return a signed URL")
        return f"{self.base}/storage/v1{signed}" if signed.startswith("/") else signed

    def _request(self, method: str, url: str, **kwargs: Any) -> requests.Response:
        try:
            return self.session.request(method, url, **kwargs)
        except requests.RequestException as exc:
            provider_code = "NETWORK_ERROR"
            if isinstance(
                exc,
                (requests.exceptions.MissingSchema, requests.exceptions.InvalidSchema, requests.exceptions.InvalidURL),
            ):
                provider_code = "INVALID_URL"
            elif isinstance(exc, requests.exceptions.SSLError):
                provider_code = "TLS_ERROR"
            elif isinstance(exc, requests.exceptions.Timeout):
                provider_code = "TIMEOUT"
            raise SupabaseError(
                "Supabase could not be reached",
                status=503,
                provider_code=provider_code,
            ) from exc

    @staticmethod
    def _decode(response: requests.Response) -> Any:
        try:
            data = response.json()
        except (json.JSONDecodeError, ValueError):
            data = None
        if not response.ok:
            message = data.get("message") if isinstance(data, dict) else "Supabase request failed"
            provider_code = str(data.get("code", "")) if isinstance(data, dict) else ""
            raise SupabaseError(message, response.status_code, provider_code)
        return data
