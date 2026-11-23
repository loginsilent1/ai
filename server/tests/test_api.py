from __future__ import annotations

from argon_api import main
from argon_api.config import get_settings, validate_settings
from argon_api.usage import UsageStore
from fastapi.testclient import TestClient

CLIENT_ID = "dev-device-1234567890"


def _client(tmp_path, monkeypatch) -> TestClient:
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("AUTH_MODE", "dev")
    monkeypatch.setenv("USAGE_DATABASE", str(tmp_path / "usage.sqlite3"))
    main.app.dependency_overrides[main.get_usage_store] = lambda: UsageStore(
        tmp_path / "request-usage.sqlite3"
    )
    return TestClient(main.app)


def teardown_function() -> None:
    main.app.dependency_overrides.clear()


def test_health_does_not_disclose_provider_secrets(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "super-secret-test-key")
    response = TestClient(main.app).get("/api/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["providers"]["groq"] is True
    assert "super-secret-test-key" not in response.text


def test_account_status_uses_server_owned_quota(tmp_path, monkeypatch):
    with _client(tmp_path, monkeypatch) as client:
        response = client.get("/api/account", headers={"X-Client-ID": CLIENT_ID})
    assert response.status_code == 200
    assert response.json() == {
        "plan": "free",
        "daily_limit": 30,
        "remaining_today": 30,
    }


def test_dev_api_requires_a_device_id(tmp_path, monkeypatch):
    with _client(tmp_path, monkeypatch) as client:
        response = client.post(
            "/api/generate",
            data={"prompt": "Hello", "mode": "chat", "history_json": "[]"},
        )
    assert response.status_code == 401


def test_client_cannot_claim_paid_plan(tmp_path, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    monkeypatch.setattr(main, "has_available_provider", lambda *_: True)

    async def fake_complete(*, settings, plan, messages):
        assert plan == "free"
        assert messages[-1]["content"] == "Hello"
        return "Namaste!", "Groq"

    monkeypatch.setattr(main, "complete", fake_complete)
    with _client(tmp_path, monkeypatch) as client:
        response = client.post(
            "/api/generate",
            headers={"X-Client-ID": CLIENT_ID},
            data={
                "prompt": "Hello",
                "mode": "chat",
                "history_json": "[]",
                "is_paid_user": "true",
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["plan"] == "free"
    assert payload["provider_used"] == "Groq"
    assert payload["reply"] == "Namaste!"


def test_agent_uses_search_results_and_safe_calculation(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "has_available_provider", lambda *_: True)
    monkeypatch.setattr(
        main,
        "search_web",
        lambda _: [
            {"title": "Example", "url": "https://example.com", "snippet": "A source."}
        ],
    )

    async def fake_complete(*, settings, plan, messages):
        assert plan == "free"
        assert "Verified local arithmetic result" in messages[-1]["content"]
        assert "https://example.com" in messages[-1]["content"]
        return "15% of 80 is 12.", "Groq"

    monkeypatch.setattr(main, "complete", fake_complete)
    with _client(tmp_path, monkeypatch) as client:
        response = client.post(
            "/api/generate",
            headers={"X-Client-ID": CLIENT_ID},
            data={
                "prompt": "What is 15% of 80?",
                "mode": "agent",
                "history_json": "[]",
            },
        )

    assert response.status_code == 200
    assert response.json()["reply"] == "15% of 80 is 12."
    assert response.json()["sources"][0]["url"] == "https://example.com"


def test_invalid_history_is_rejected_without_spending_quota(tmp_path, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    monkeypatch.setattr(main, "has_available_provider", lambda *_: True)
    usage = UsageStore(tmp_path / "quota.sqlite3")
    main.app.dependency_overrides[main.get_usage_store] = lambda: usage
    with TestClient(main.app) as client:
        response = client.post(
            "/api/generate",
            headers={"X-Client-ID": CLIENT_ID},
            data={
                "prompt": "Hello",
                "mode": "chat",
                "history_json": "not-json",
            },
        )

    assert response.status_code == 422
    assert usage.remaining(f"dev:{CLIENT_ID}", 30) == 30


def test_usage_reservation_enforces_daily_cap(tmp_path):
    store = UsageStore(tmp_path / "quota.sqlite3")
    assert store.reserve("user-1", 2, usage_day="2026-11-23") == 1
    assert store.reserve("user-1", 2, usage_day="2026-11-23") == 0
    assert store.reserve("user-1", 2, usage_day="2026-11-23") is None
    assert store.remaining("user-1", 2, usage_day="2026-11-23") == 0


def test_production_rejects_development_auth(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("AUTH_MODE", "dev")
    try:
        validate_settings(get_settings())
    except RuntimeError as error:
        assert "not allowed" in str(error)
    else:
        raise AssertionError("Production must reject the development auth mode")
