from __future__ import annotations

from typing import Any

from backend.config import ConfigurationError, Settings, get_settings
from backend.deepseek_client import DeepSeekClient
from backend.mimo_client import MimoClient


class AIClient:
    """Routes Skyler requests to the explicitly selected AI provider."""

    def __init__(self, settings: Settings | None = None, provider_client: Any | None = None):
        self.settings = settings or get_settings()
        self.provider_name = self.settings.ai_provider.lower().strip()
        if self.provider_name not in {"deepseek", "mimo"}:
            raise ConfigurationError("AI_PROVIDER must be deepseek or mimo")
        self.provider = provider_client or (
            DeepSeekClient(self.settings)
            if self.provider_name == "deepseek"
            else MimoClient(self.settings)
        )

    def structured_chat(self, **kwargs: Any):
        return self.provider.structured_chat(**kwargs)

    def test_connection(self) -> bool:
        return self.provider.test_connection()
