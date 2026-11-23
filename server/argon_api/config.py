from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    app_env: str
    auth_mode: str
    allowed_origins: tuple[str, ...]
    database_path: Path
    free_daily_limit: int
    pro_daily_limit: int
    groq_api_key: str
    groq_model: str
    groq_base_url: str
    gemini_api_key: str
    gemini_model: str
    premium_api_key: str
    premium_api_base_url: str
    premium_model: str
    free_provider_order: tuple[str, ...]
    firebase_project_id: str
    firebase_credentials_file: str
    max_pdf_bytes: int
    max_pdf_pages: int
    max_document_chars: int


def _positive_int(name: str, default: int) -> int:
    try:
        return max(1, int(os.getenv(name, str(default))))
    except ValueError:
        return default


def get_settings() -> Settings:
    origins_raw = os.getenv(
        "APP_ALLOWED_ORIGINS",
        "capacitor://localhost,http://localhost,https://localhost",
    )
    order_raw = os.getenv("FREE_PROVIDER_ORDER", "groq,gemini")
    return Settings(
        app_env=os.getenv("APP_ENV", "development").strip().lower(),
        auth_mode=os.getenv("AUTH_MODE", "dev").strip().lower(),
        allowed_origins=tuple(
            item.strip() for item in origins_raw.split(",") if item.strip()
        ),
        database_path=Path(os.getenv("USAGE_DATABASE", "server/.data/usage.sqlite3")),
        free_daily_limit=_positive_int("FREE_DAILY_LIMIT", 30),
        pro_daily_limit=_positive_int("PRO_DAILY_LIMIT", 300),
        groq_api_key=os.getenv("GROQ_API_KEY", "").strip(),
        groq_model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip(),
        groq_base_url=os.getenv(
            "GROQ_BASE_URL", "https://api.groq.com/openai/v1"
        ).strip(),
        gemini_api_key=os.getenv("GEMINI_API_KEY", "").strip(),
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.0-flash").strip(),
        premium_api_key=os.getenv("PREMIUM_API_KEY", "").strip(),
        premium_api_base_url=os.getenv("PREMIUM_API_BASE_URL", "").strip(),
        premium_model=os.getenv("PREMIUM_MODEL", "").strip(),
        free_provider_order=tuple(
            item.strip().lower() for item in order_raw.split(",") if item.strip()
        ),
        firebase_project_id=os.getenv("FIREBASE_PROJECT_ID", "").strip(),
        firebase_credentials_file=os.getenv("FIREBASE_CREDENTIALS_FILE", "").strip(),
        max_pdf_bytes=_positive_int("MAX_PDF_BYTES", 8 * 1024 * 1024),
        max_pdf_pages=_positive_int("MAX_PDF_PAGES", 40),
        max_document_chars=_positive_int("MAX_DOCUMENT_CHARS", 40_000),
    )


def validate_settings(settings: Settings) -> None:
    if settings.auth_mode not in {"dev", "firebase"}:
        raise RuntimeError("AUTH_MODE must be either 'dev' or 'firebase'.")
    if settings.app_env == "production" and settings.auth_mode == "dev":
        raise RuntimeError("AUTH_MODE=dev is not allowed when APP_ENV=production.")
    if settings.auth_mode == "firebase" and not settings.firebase_project_id:
        raise RuntimeError("FIREBASE_PROJECT_ID is required when AUTH_MODE=firebase.")
    invalid_providers = set(settings.free_provider_order) - {"groq", "gemini"}
    if invalid_providers:
        raise RuntimeError(
            "FREE_PROVIDER_ORDER may only contain 'groq' and/or 'gemini'."
        )
