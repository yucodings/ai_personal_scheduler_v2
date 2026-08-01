from __future__ import annotations

import requests

from backend.ai_provider import (
    AIProviderError,
    AIResult,
    OpenAICompatibleClient,
    SKYLER_SYSTEM_PROMPT,
    parse_ai_envelope,
)
from backend.config import Settings, get_settings

MimoError = AIProviderError
MimoResult = AIResult


class MimoClient(OpenAICompatibleClient):
    def __init__(
        self,
        settings: Settings | None = None,
        session: requests.Session | None = None,
    ):
        config = settings or get_settings()
        super().__init__(
            settings=config,
            session=session or requests.Session(),
            provider="MiMo",
            capability="mimo",
            api_key=config.mimo_api_key,
            base_url=config.mimo_base_url,
            model=config.mimo_model,
            timeout_seconds=config.mimo_timeout_seconds,
            max_context_chars=config.mimo_max_context_chars,
            extra_headers={"api-key": config.mimo_api_key},
        )


__all__ = [
    "MimoClient",
    "MimoError",
    "MimoResult",
    "SKYLER_SYSTEM_PROMPT",
    "parse_ai_envelope",
]
