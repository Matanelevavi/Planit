import pytest
from pydantic import ValidationError

from app.config import Settings


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_security_headers_present(client, headers):
    r = client.get("/goals/", headers=headers)
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"
    assert r.headers["referrer-policy"] == "no-referrer"
    assert r.headers["cache-control"] == "no-store"
    assert "frame-ancestors 'none'" in r.headers["content-security-policy"]


def test_cors_only_allows_configured_origins(client):
    ok = client.options(
        "/goals/",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"},
    )
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert ok.headers.get("access-control-allow-credentials") == "true"
    bad = client.options(
        "/goals/",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"},
    )
    assert "access-control-allow-origin" not in bad.headers


def test_oversized_body_rejected(client):
    r = client.post("/auth/login", content=b"x" * 10, headers={"content-length": "5000000"})
    assert r.status_code == 413


def test_unhandled_errors_do_not_leak_details(client, monkeypatch, headers):
    from fastapi.testclient import TestClient

    from app.main import app
    from app.routers import goals

    def boom(*a, **k):
        raise RuntimeError("secret internal detail")

    from tests.conftest import goal_payload

    client.post("/goals/", json=goal_payload(), headers=headers)
    monkeypatch.setattr(goals, "to_out", boom)
    with TestClient(app, base_url="http://localhost", raise_server_exceptions=False) as c:
        r = c.get("/goals/", headers=headers)
    assert r.status_code == 500 and "secret" not in r.text


def test_prod_requires_strong_secret_and_secure_cookies():
    with pytest.raises(ValidationError):
        Settings(env="prod", secret_key="short", cookie_secure=True)
    with pytest.raises(ValidationError):
        Settings(env="prod", secret_key="x" * 40, cookie_secure=False)
    assert Settings(env="prod", secret_key="x" * 40, cookie_secure=True).env == "prod"


def test_docs_hidden_in_prod(monkeypatch):
    from fastapi.testclient import TestClient

    from app import main
    from app.config import get_settings

    s = get_settings()
    old = (s.env, s.cookie_secure)
    s.env, s.cookie_secure = "prod", True
    try:
        app = main.create_app()
        assert TestClient(app).get("/docs").status_code == 404
        assert TestClient(app).get("/openapi.json").status_code == 404
    finally:
        s.env, s.cookie_secure = old
