from __future__ import annotations

import requests

from backend.ai_provider import AIProviderError, AIResult, OpenAICompatibleClient
from backend.config import Settings, get_settings

DeepSeekError = AIProviderError
DeepSeekResult = AIResult


class DeepSeekClient(OpenAICompatibleClient):
    def __init__(
        self,
        settings: Settings | None = None,
        session: requests.Session | None = None,
    ):
        config = settings or get_settings()
        super().__init__(
            settings=config,
            session=session or requests.Session(),
            provider="DeepSeek",
            capability="deepseek",
            api_key=config.deepseek_api_key,
            base_url=config.deepseek_base_url,
            model=config.deepseek_model,
            timeout_seconds=config.deepseek_timeout_seconds,
            max_context_chars=config.deepseek_max_context_chars,
            max_tokens=config.deepseek_max_tokens,
        )
