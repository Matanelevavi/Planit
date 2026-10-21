import os

os.environ["PLANIT_ENV"] = "test"
os.environ["PLANIT_RATE_LIMIT_ENABLED"] = "false"
os.environ["PLANIT_SECRET_KEY"] = "test-secret-key-test-secret-key-0123456789"
os.environ["PLANIT_DATABASE_URL"] = "sqlite://"

from datetime import date, timedelta  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app import ratelimit  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.db import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402

PASSWORD = "correct-horse-9"


@pytest.fixture
def session_factory():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@pytest.fixture
def client(session_factory):
    def override():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override
    ratelimit.reset()
    with TestClient(app, base_url="http://localhost") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def settings():
    s = get_settings()
    saved = s.model_copy()
    yield s
    for k in saved.model_fields:
        setattr(s, k, getattr(saved, k))


def register(client, email="user@example.com", password=PASSWORD):
    r = client.post("/auth/register", json={"email": email, "password": password})
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def token(client):
    return register(client)


@pytest.fixture
def headers(token):
    return auth(token)


def goal_payload(**over):
    p = {
        "title": "Apartment",
        "target_amount": "120000",
        "current_amount": "0",
        "target_date": (date.today() + timedelta(days=365 * 5)).isoformat(),
        "annual_return_pct": 5,
    }
    p.update(over)
    return p
