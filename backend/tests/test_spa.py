from fastapi.testclient import TestClient

from app import main
from app.config import get_settings


def _spa_client(tmp_path, settings, session_factory=None):
    (tmp_path / "index.html").write_text("<!doctype html><title>Planit</title><div id=root></div>")
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "app-abc123.js").write_text("console.log(1)")
    settings.frontend_dir = str(tmp_path)
    settings.cookie_path = "/api/auth"
    app = main.create_app()
    if session_factory is not None:
        from app.db import get_db

        def override():
            db = session_factory()
            try:
                yield db
            finally:
                db.close()

        api = next(r.app for r in app.routes if getattr(r, "path", "") == "/api")
        api.dependency_overrides[get_db] = override
    return TestClient(app, base_url="https://planit.example")


def test_serves_spa_and_falls_back_for_client_routes(tmp_path, settings):
    c = _spa_client(tmp_path, settings)
    assert "Planit" in c.get("/").text
    deep = c.get("/goals/12")
    assert deep.status_code == 200 and "Planit" in deep.text  # React Router path -> index.html
    assert c.get("/missing.js").status_code == 404  # real asset misses stay 404


def test_spa_headers_and_caching(tmp_path, settings):
    c = _spa_client(tmp_path, settings)
    html = c.get("/")
    assert "default-src 'self'" in html.headers["content-security-policy"]
    assert html.headers["cache-control"] == "no-cache"
    asset = c.get("/assets/app-abc123.js")
    assert "immutable" in asset.headers["cache-control"]
    assert asset.headers["x-content-type-options"] == "nosniff"


def test_api_lives_under_api_prefix_with_strict_headers(tmp_path, settings):
    c = _spa_client(tmp_path, settings)
    r = c.get("/api/health")
    assert r.json() == {"status": "ok"}
    assert r.headers["cache-control"] == "no-store"
    assert r.headers["content-security-policy"].startswith("default-src 'none'")
    assert c.get("/api/goals/").status_code == 401


def test_same_origin_session_flow_with_scoped_cookie(tmp_path, settings, session_factory):
    c = _spa_client(tmp_path, settings, session_factory)
    r = c.post(
        "/api/auth/register",
        json={"email": "spa@example.com", "password": "correct-horse-9"},
        headers={"Origin": "https://planit.example"},
    )
    assert r.status_code == 201
    assert "path=/api/auth" in r.headers["set-cookie"].lower()
    ok = c.post("/api/auth/refresh", headers={"Origin": "https://planit.example"})
    assert ok.status_code == 200
    evil = c.post("/api/auth/refresh", headers={"Origin": "https://evil.example"})
    assert evil.status_code == 403


def test_missing_frontend_dir_is_a_startup_error(tmp_path, settings):
    import pytest

    settings.frontend_dir = str(tmp_path / "nope")
    with pytest.raises(RuntimeError):
        main.create_app()


def test_postgres_urls_are_normalised_to_psycopg3():
    from app.config import Settings

    assert Settings(database_url="postgres://u:p@h/db").database_url == "postgresql+psycopg://u:p@h/db"
    assert Settings(database_url="postgresql://u:p@h/db").database_url == "postgresql+psycopg://u:p@h/db"
    assert Settings(database_url="sqlite://").database_url == "sqlite://"
    assert get_settings().env == "test"
