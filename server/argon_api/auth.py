from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass

from fastapi import HTTPException, Request, status

from .config import get_settings

_CLIENT_ID_RE = re.compile(r"^[A-Za-z0-9_-]{16,80}$")


@dataclass(frozen=True)
class Principal:
    user_id: str
    plan: str = "free"


def _verify_firebase_token(token: str) -> dict:
    import firebase_admin
    from firebase_admin import auth as firebase_auth

    try:
        firebase_admin.get_app()
    except ValueError:
        from firebase_admin import credentials

        settings = get_settings()
        credential = (
            credentials.Certificate(settings.firebase_credentials_file)
            if settings.firebase_credentials_file
            else credentials.ApplicationDefault()
        )
        firebase_admin.initialize_app(
            credential,
            options={"projectId": settings.firebase_project_id},
        )

    return firebase_auth.verify_id_token(token, check_revoked=True)


async def get_current_principal(request: Request) -> Principal:
    settings = get_settings()

    if settings.auth_mode == "dev":
        if settings.app_env == "production":
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Development authentication is disabled in production.",
            )
        client_id = request.headers.get("X-Client-ID", "")
        if not _CLIENT_ID_RE.fullmatch(client_id):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="A valid X-Client-ID is required in local development.",
            )
        # A development device ID is never trusted as a paid entitlement.
        return Principal(user_id=f"dev:{client_id}", plan="free")

    authorization = request.headers.get("Authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign in to continue.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        decoded = await asyncio.to_thread(_verify_firebase_token, token.strip())
    except Exception:  # noqa: BLE001 — fail closed for any token-verification error.
        # Do not return provider/JWT diagnostics to the caller.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session is invalid or expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None

    # `plan` is accepted only from a verified Firebase token. Never use a request-body flag.
    plan = "pro" if decoded.get("plan") == "pro" else "free"
    user_id = decoded.get("uid")
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(
            status_code=401, detail="The account token is missing a user ID."
        )
    return Principal(user_id=user_id, plan=plan)
