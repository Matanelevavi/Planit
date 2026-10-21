from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app import ratelimit
from app.security import ALGORITHM, create_token, decode_token, InvalidToken
from tests.conftest import PASSWORD, auth, register


def test_register_login_me_flow(client):
    token = register(client)
    me = client.get("/auth/me", headers=auth(token))
    assert me.status_code == 200 and me.json()["email"] == "user@example.com"
    assert "password" not in me.text

    r = client.post("/auth/login", json={"email": "USER@example.com ", "password": PASSWORD})
    assert r.status_code == 200 and r.json()["token_type"] == "bearer"


def test_password_is_stored_as_argon2_hash(client, session_factory):
    register(client)
    from app.models import User

    with session_factory() as db:
        h = db.query(User).one().password_hash
    assert h.startswith("$argon2") and PASSWORD not in h


@pytest.mark.parametrize(
    "pw", ["short1", "1234567890123", "onlyletterslong", "a" * 200 + "1"]
)
def test_weak_passwords_rejected(client, pw):
    r = client.post("/auth/register", json={"email": "a@b.com", "password": pw})
    assert r.status_code == 422


def test_password_containing_email_name_rejected(client):
    r = client.post("/auth/register", json={"email": "matanel@b.com", "password": "matanel-12345"})
    assert r.status_code == 422


def test_duplicate_and_invalid_email(client):
    register(client)
    r = client.post("/auth/register", json={"email": "USER@example.com", "password": PASSWORD})
    assert r.status_code == 409
    r = client.post("/auth/register", json={"email": "not-an-email", "password": PASSWORD})
    assert r.status_code == 422


def test_login_errors_do_not_reveal_which_part_was_wrong(client):
    register(client)
    wrong_pw = client.post("/auth/login", json={"email": "user@example.com", "password": "nope-nope-1"})
    no_user = client.post("/auth/login", json={"email": "who@example.com", "password": "nope-nope-1"})
    assert wrong_pw.status_code == no_user.status_code == 401
    assert wrong_pw.json() == no_user.json()


def test_account_locks_after_repeated_failures(client, settings):
    settings.max_failed_logins = 3
    register(client)
    for _ in range(3):
        assert client.post("/auth/login", json={"email": "user@example.com", "password": "bad-bad-bad1"}).status_code == 401
    # even the correct password is refused while locked
    r = client.post("/auth/login", json={"email": "user@example.com", "password": PASSWORD})
    assert r.status_code == 429


def test_protected_routes_need_a_token(client):
    for method, path in [("get", "/goals/"), ("post", "/goals/"), ("get", "/auth/me"), ("get", "/goals/summary")]:
        r = getattr(client, method)(path)
        assert r.status_code == 401, path
        assert r.headers["www-authenticate"] == "Bearer"


@pytest.mark.parametrize("bad", ["garbage", "a.b.c", ""])
def test_malformed_tokens_rejected(client, bad):
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {bad}"}).status_code == 401


def test_tampered_signature_rejected(client, token):
    head, body, sig = token.split(".")
    forged = f"{head}.{body}.{sig[:-2]}xx"
    assert client.get("/auth/me", headers=auth(forged)).status_code == 401


def test_alg_none_token_rejected(client, settings):
    now = datetime.now(UTC)
    claims = {"sub": "1", "ver": 0, "typ": "access", "iat": now, "exp": now + timedelta(minutes=5)}
    forged = jwt.encode(claims, key=None, algorithm="none")
    assert client.get("/auth/me", headers=auth(forged)).status_code == 401


def test_token_signed_with_other_key_rejected(client, token):
    now = datetime.now(UTC)
    claims = {"sub": "1", "ver": 0, "typ": "access", "iat": now, "exp": now + timedelta(minutes=5)}
    forged = jwt.encode(claims, "some-other-secret-some-other-secret", algorithm=ALGORITHM)
    assert client.get("/auth/me", headers=auth(forged)).status_code == 401


def test_expired_token_rejected(client, token, settings):
    now = datetime.now(UTC)
    claims = {"sub": "1", "ver": 0, "typ": "access", "iat": now - timedelta(hours=2), "exp": now - timedelta(hours=1)}
    expired = jwt.encode(claims, settings.secret_key, algorithm=ALGORITHM)
    assert client.get("/auth/me", headers=auth(expired)).status_code == 401


def test_refresh_token_cannot_be_used_as_access_token(client):
    register(client)
    refresh_cookie = client.cookies.get("planit_refresh")
    assert refresh_cookie
    assert client.get("/auth/me", headers=auth(refresh_cookie)).status_code == 401


def test_access_token_cannot_be_used_as_refresh(client, token):
    client.cookies.clear()
    client.cookies.set("planit_refresh", token, path="/auth")
    assert client.post("/auth/refresh").status_code == 401


def test_decode_token_kind_mismatch_raises():
    t = create_token(1, 0, "access")
    with pytest.raises(InvalidToken):
        decode_token(t, "refresh")


def test_refresh_cookie_flags_and_refresh_flow(client):
    r = client.post("/auth/register", json={"email": "c@example.com", "password": PASSWORD})
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie and "path=/auth" in cookie

    r2 = client.post("/auth/refresh")
    assert r2.status_code == 200
    assert client.get("/auth/me", headers=auth(r2.json()["access_token"])).status_code == 200


def test_refresh_without_cookie_is_401(client):
    assert client.post("/auth/refresh").status_code == 401


def test_refresh_rejects_foreign_origin(client):
    register(client)
    r = client.post("/auth/refresh", headers={"Origin": "https://evil.example"})
    assert r.status_code == 403
    ok = client.post("/auth/refresh", headers={"Origin": "http://localhost:5173"})
    assert ok.status_code == 200


def test_logout_clears_cookie(client):
    register(client)
    assert client.post("/auth/logout").status_code == 204
    assert client.post("/auth/refresh").status_code == 401


def test_logout_all_revokes_existing_tokens(client, token):
    assert client.post("/auth/logout-all", headers=auth(token)).status_code == 204
    assert client.get("/auth/me", headers=auth(token)).status_code == 401


def test_change_password_revokes_old_tokens_and_requires_current(client, token):
    bad = client.post("/auth/change-password", headers=auth(token), json={"current_password": "wrong-wrong-1", "new_password": "brand-new-pass-1"})
    assert bad.status_code == 400
    ok = client.post("/auth/change-password", headers=auth(token), json={"current_password": PASSWORD, "new_password": "brand-new-pass-1"})
    assert ok.status_code == 200
    assert client.get("/auth/me", headers=auth(token)).status_code == 401  # old token dead
    assert client.get("/auth/me", headers=auth(ok.json()["access_token"])).status_code == 200
    assert client.post("/auth/login", json={"email": "user@example.com", "password": PASSWORD}).status_code == 401
    assert client.post("/auth/login", json={"email": "user@example.com", "password": "brand-new-pass-1"}).status_code == 200


def test_delete_account_removes_everything(client, headers, session_factory):
    from tests.conftest import goal_payload
    from app.models import Contribution, Goal, User

    gid = client.post("/goals/", json=goal_payload(), headers=headers).json()["id"]
    client.post(f"/goals/{gid}/contributions", json={"amount": "100"}, headers=headers)

    assert client.request("DELETE", "/auth/me", headers=headers, json={"password": "wrong-wrong-1"}).status_code == 400
    assert client.request("DELETE", "/auth/me", headers=headers, json={"password": PASSWORD}).status_code == 204

    with session_factory() as db:
        assert db.query(User).count() == db.query(Goal).count() == db.query(Contribution).count() == 0
    assert client.post("/auth/login", json={"email": "user@example.com", "password": PASSWORD}).status_code == 401


def test_export_contains_only_own_data(client, headers):
    from tests.conftest import goal_payload

    client.post("/goals/", json=goal_payload(title="Mine"), headers=headers)
    other = register(client, "other@example.com")
    client.post("/goals/", json=goal_payload(title="Theirs"), headers=auth(other))
    data = client.get("/auth/export", headers=headers).json()
    assert [g["title"] for g in data["goals"]] == ["Mine"]
    assert "password" not in str(data)


def test_login_rate_limit(client, settings):
    settings.rate_limit_enabled = True
    ratelimit.reset()
    codes = [
        client.post("/auth/login", json={"email": "x@example.com", "password": "nope-nope-1"}).status_code
        for _ in range(12)
    ]
    assert codes[:10] == [401] * 10
    assert 429 in codes[10:]
    r = client.post("/auth/login", json={"email": "x@example.com", "password": "nope-nope-1"})
    assert r.headers.get("retry-after")
