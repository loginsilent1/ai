from __future__ import annotations

import logging
from typing import Any
from urllib.parse import quote, urlparse

import httpx

from .config import Settings

logger = logging.getLogger(__name__)


class ProviderUnavailable(RuntimeError):
    pass


def has_available_provider(settings: Settings, plan: str) -> bool:
    if plan == "pro":
        return bool(
            settings.premium_api_key
            and settings.premium_api_base_url
            and settings.premium_model
        )
    return any(
        (provider == "groq" and settings.groq_api_key)
        or (provider == "gemini" and settings.gemini_api_key)
        for provider in settings.free_provider_order
    )


def _check_base_url(base_url: str, *, allow_local_http: bool) -> str:
    parsed = urlparse(base_url)
    local_http = parsed.scheme == "http" and parsed.hostname in {
        "localhost",
        "127.0.0.1",
    }
    if parsed.scheme != "https" and not (allow_local_http and local_http):
        raise ProviderUnavailable("Configured model provider must use HTTPS.")
    if not parsed.netloc:
        raise ProviderUnavailable("Configured model provider URL is invalid.")
    return base_url.rstrip("/")


async def _openai_compatible(
    *,
    base_url: str,
    api_key: str,
    model: str,
    messages: list[dict[str, str]],
    allow_local_http: bool,
) -> str:
    root = _check_base_url(base_url, allow_local_http=allow_local_http)
    timeout = httpx.Timeout(50.0, connect=8.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            f"{root}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": model,
                "messages": messages,
                "temperature": 0.65,
                "max_tokens": 2048,
                "stream": False,
            },
        )
    response.raise_for_status()
    payload = response.json()
    try:
        text = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ProviderUnavailable(
            "Model provider returned an invalid response."
        ) from exc
    if not isinstance(text, str) or not text.strip():
        raise ProviderUnavailable("Model provider returned an empty response.")
    return text.strip()


async def _gemini(
    *,
    api_key: str,
    model: str,
    messages: list[dict[str, str]],
) -> str:
    if not model or "/" in model:
        raise ProviderUnavailable("Configured Gemini model ID is invalid.")
    system_instruction = (
        messages[0]["content"] if messages and messages[0]["role"] == "system" else ""
    )
    turns = messages[1:] if system_instruction else messages
    contents = [
        {
            "role": "model" if item["role"] == "assistant" else "user",
            "parts": [{"text": item["content"]}],
        }
        for item in turns
        if item["role"] in {"user", "assistant"}
    ]
    timeout = httpx.Timeout(50.0, connect=8.0)
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{quote(model, safe='')}:generateContent"
    )
    body: dict[str, Any] = {
        "contents": contents,
        "generationConfig": {"temperature": 0.65, "maxOutputTokens": 2048},
    }
    if system_instruction:
        body["systemInstruction"] = {"parts": [{"text": system_instruction}]}
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            url,
            headers={"x-goog-api-key": api_key},
            json=body,
        )
    response.raise_for_status()
    payload = response.json()
    try:
        text = "".join(
            part.get("text", "")
            for part in payload["candidates"][0]["content"]["parts"]
            if isinstance(part, dict)
        )
    except (KeyError, IndexError, TypeError) as exc:
        raise ProviderUnavailable(
            "Model provider returned an invalid response."
        ) from exc
    if not text.strip():
        raise ProviderUnavailable("Model provider returned an empty response.")
    return text.strip()


async def complete(
    *,
    settings: Settings,
    plan: str,
    messages: list[dict[str, str]],
) -> tuple[str, str]:
    """Route to the verified user's tier; free users can fail over between configured APIs."""
    if plan == "pro":
        candidates = [
            (
                "premium",
                settings.premium_api_key,
                settings.premium_model,
                settings.premium_api_base_url,
            )
        ]
    else:
        candidates = []
        for provider in settings.free_provider_order:
            if provider == "groq" and settings.groq_api_key:
                candidates.append(
                    (
                        "groq",
                        settings.groq_api_key,
                        settings.groq_model,
                        settings.groq_base_url,
                    )
                )
            elif provider == "gemini" and settings.gemini_api_key:
                candidates.append(
                    ("gemini", settings.gemini_api_key, settings.gemini_model, "")
                )

    if not candidates:
        raise ProviderUnavailable(
            "No model provider is configured for this account tier."
        )

    for provider, api_key, model, base_url in candidates:
        try:
            if provider == "gemini":
                reply = await _gemini(api_key=api_key, model=model, messages=messages)
                label = "Gemini"
            else:
                reply = await _openai_compatible(
                    base_url=base_url,
                    api_key=api_key,
                    model=model,
                    messages=messages,
                    allow_local_http=settings.app_env != "production",
                )
                label = "Premium API" if provider == "premium" else "Groq"
            return reply, label
        except Exception as exc:  # noqa: BLE001 — try the next configured provider on any failure.
            status_code = (
                exc.response.status_code
                if isinstance(exc, httpx.HTTPStatusError)
                else None
            )
            # Deliberately exclude exception text, request URLs and credentials from logs.
            logger.warning(
                "Model provider %s failed (status=%s).", provider, status_code
            )

    raise ProviderUnavailable(
        "All configured model providers are temporarily unavailable."
    )
