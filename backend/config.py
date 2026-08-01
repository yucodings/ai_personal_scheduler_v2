from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache


class ConfigurationError(RuntimeError):
    pass


@dataclass(frozen=True)
class Settings:
    app_timezone: str = "Asia/Kuala_Lumpur"
    app_login_password_hash: str = ""
    jwt_secret: str = ""
    session_expiry_hours: int = 168
    cron_secret: str = ""
    supabase_url: str = ""
    supabase_publishable_key: str = ""
    supabase_service_role_key: str = ""
    storage_bucket: str = "project-files"
    mimo_api_key: str = ""
    mimo_base_url: str = "https://token-plan-sgp.xiaomimimo.com/v1"
    mimo_model: str = "mimo-v2.5"
    mimo_timeout_seconds: int = 60
    mimo_max_context_chars: int = 40000
    telegram_bot_token: str = ""
    telegram_allowed_chat_id: str = ""
    telegram_webhook_secret: str = ""
    max_upload_size_mb: int = 25
    max_zip_files: int = 200
    max_zip_uncompressed_mb: int = 50
    chunk_size_chars: int = 3000
    chunk_overlap_chars: int = 300
    default_daily_work_hours: float = 6.0
    default_approval_mode: str = "full_plan"
    environment: str = "development"

    @property
    def production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key)

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            app_timezone=os.getenv("APP_TIMEZONE", "Asia/Kuala_Lumpur"),
            app_login_password_hash=os.getenv("APP_LOGIN_PASSWORD_HASH", ""),
            jwt_secret=os.getenv("JWT_SECRET", ""),
            session_expiry_hours=_integer("SESSION_EXPIRY_HOURS", 168),
            cron_secret=os.getenv("CRON_SECRET", ""),
            supabase_url=os.getenv("SUPABASE_URL", "").strip().rstrip("/"),
            supabase_publishable_key=os.getenv("SUPABASE_PUBLISHABLE_KEY", ""),
            supabase_service_role_key=(
                os.getenv("SUPABASE_SECRET_KEY", "").strip()
                or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
            ),
            storage_bucket=os.getenv("SUPABASE_STORAGE_BUCKET", "project-files"),
            mimo_api_key=os.getenv("MIMO_API_KEY", ""),
            mimo_base_url=os.getenv("MIMO_BASE_URL", "https://token-plan-sgp.xiaomimimo.com/v1").rstrip("/"),
            mimo_model=os.getenv("MIMO_MODEL", "mimo-v2.5"),
            mimo_timeout_seconds=_integer("MIMO_TIMEOUT_SECONDS", 60),
            mimo_max_context_chars=_integer("MIMO_MAX_CONTEXT_CHARS", 40000),
            telegram_bot_token=os.getenv("TELEGRAM_BOT_TOKEN", ""),
            telegram_allowed_chat_id=os.getenv("TELEGRAM_ALLOWED_CHAT_ID", ""),
            telegram_webhook_secret=os.getenv("TELEGRAM_WEBHOOK_SECRET", ""),
            max_upload_size_mb=_integer("MAX_UPLOAD_SIZE_MB", 25),
            max_zip_files=_integer("MAX_ZIP_FILES", 200),
            max_zip_uncompressed_mb=_integer("MAX_ZIP_UNCOMPRESSED_MB", 50),
            chunk_size_chars=_integer("DOCUMENT_CHUNK_SIZE_CHARS", 3000),
            chunk_overlap_chars=_integer("DOCUMENT_CHUNK_OVERLAP_CHARS", 300),
            default_daily_work_hours=_number("DEFAULT_DAILY_WORK_HOURS", 6),
            default_approval_mode=os.getenv("DEFAULT_APPROVAL_MODE", "full_plan"),
            environment=os.getenv("VERCEL_ENV", os.getenv("ENVIRONMENT", "development")),
        )

    def missing_for(self, capability: str) -> list[str]:
        requirements = {
            "auth": {"APP_LOGIN_PASSWORD_HASH": self.app_login_password_hash, "JWT_SECRET": self.jwt_secret},
            "supabase": {
                "SUPABASE_URL": self.supabase_url,
                "SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY": self.supabase_service_role_key,
            },
            "mimo": {"MIMO_API_KEY": self.mimo_api_key},
            "telegram": {"TELEGRAM_BOT_TOKEN": self.telegram_bot_token, "TELEGRAM_ALLOWED_CHAT_ID": self.telegram_allowed_chat_id},
            "cron": {"CRON_SECRET": self.cron_secret},
        }
        return [name for name, value in requirements.get(capability, {}).items() if not value]

    def require(self, capability: str) -> None:
        missing = self.missing_for(capability)
        if missing:
            raise ConfigurationError(f"Missing required environment values: {', '.join(missing)}")


def _integer(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError as exc:
        raise ConfigurationError(f"{name} must be an integer") from exc


def _number(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except ValueError as exc:
        raise ConfigurationError(f"{name} must be a number") from exc


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings.from_env()
