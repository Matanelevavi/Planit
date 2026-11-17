import urllib.error
from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app import mail
from app.security import ALGORITHM, create_token, password_fingerprint
from tests.conftest import PASSWORD, auth, register

NEW_PASSWORD = "brand-new-Secret-42"


@pytest.fixture
def outbox(monkeypatch, settings):
    """Enable password reset and capture e-mails instead of sending them."""
    settings.resend_api_key = "re_test_key"
    settings.public_url = "https://planit.test"
    sent: list[tuple[str, str, str]] = []
    monkeypatch.setattr("app.routers.auth.send_email", lambda to, subj, text: sent.append((to, subj, text)))
    return sent


def _token_from(sent):
    text = sent[-1][2]
    return text.split("reset-password?token=")[1].split()[0]


def test_config_reports_whether_reset_is_available(client, settings):
    assert client.get("/auth/config").json() == {"password_reset_enabled": False}
    settings.resend_api_key = "k"
    settings.public_url = "https://x.test"
    assert client.get("/auth/config").json() == {"password_reset_enabled": True}


def test_forgot_password_is_501_when_not_configured(client):
    r = client.post("/auth/forgot-password", json={"email": "a@b.co"})
    assert r.status_code == 501


def test_full_reset_flow(client, outbox):
    register(client)
    r = client.post("/auth/forgot-password", json={"email": "USER@example.com"})
    assert r.status_code == 202
    assert len(outbox) == 1 and outbox[0][0] == "user@example.com"
    assert "https://planit.test/reset-password?token=" in outbox[0][2]

    token = _token_from(outbox)
    done = client.post("/auth/reset-password", json={"token": token, "new_password": NEW_PASSWORD})
    assert done.status_code == 204
    assert client.post("/auth/login", json={"email": "user@example.com", "password": PASSWORD}).status_code == 401
    assert client.post("/auth/login", json={"email": "user@example.com", "password": NEW_PASSWORD}).status_code == 200


def test_same_answer_for_unknown_and_known_emails_and_no_mail_for_unknown(client, outbox):
    register(client)
    known = client.post("/auth/forgot-password", json={"email": "user@example.com"})
    unknown = client.post("/auth/forgot-password", json={"email": "nobody@example.com"})
    assert known.status_code == unknown.status_code == 202
    assert known.json() == unknown.json()
    assert len(outbox) == 1  # only the real account got an e-mail


def test_reset_link_works_only_once(client, outbox):
    register(client)
    client.post("/auth/forgot-password", json={"email": "user@example.com"})
    token = _token_from(outbox)
    assert client.post("/auth/reset-password", json={"token": token, "new_password": NEW_PASSWORD}).status_code == 204
    again = client.post("/auth/reset-password", json={"token": token, "new_password": "another-Secret-77"})
    assert again.status_code == 400


def test_reset_signs_out_existing_sessions_and_clears_lockout(client, outbox, settings):
    settings.max_failed_logins = 2
    tok = register(client)
    for _ in range(2):
        client.post("/auth/login", json={"email": "user@example.com", "password": "wrong-wrong-1"})
    assert client.post("/auth/login", json={"email": "user@example.com", "password": PASSWORD}).status_code == 429
    client.post("/auth/forgot-password", json={"email": "user@example.com"})
    client.post("/auth/reset-password", json={"token": _token_from(outbox), "new_password": NEW_PASSWORD})
    assert client.get("/auth/me", headers=auth(tok)).status_code == 401  # old access token revoked
    assert client.post("/auth/login", json={"email": "user@example.com", "password": NEW_PASSWORD}).status_code == 200


@pytest.mark.parametrize("bad", ["x" * 20, "a.b.c" * 5])
def test_garbage_tokens_rejected(client, bad):
    r = client.post("/auth/reset-password", json={"token": bad, "new_password": NEW_PASSWORD})
    assert r.status_code == 400


def test_other_token_kinds_cannot_reset_a_password(client, settings):
    register(client)
    for kind in ("access", "refresh"):
        t = create_token(1, 0, kind, {"pw": "x"})
        assert client.post("/auth/reset-password", json={"token": t, "new_password": NEW_PASSWORD}).status_code == 400


def test_expired_and_forged_reset_tokens_rejected(client, settings, session_factory):
    register(client)
    from app.models import User

    with session_factory() as db:
        fp = password_fingerprint(db.query(User).one().password_hash)
    now = datetime.now(UTC)
    claims = {"sub": "1", "ver": 0, "typ": "reset", "pw": fp, "iat": now - timedelta(hours=2), "exp": now - timedelta(hours=1)}
    expired = jwt.encode(claims, settings.secret_key, algorithm=ALGORITHM)
    assert client.post("/auth/reset-password", json={"token": expired, "new_password": NEW_PASSWORD}).status_code == 400
    claims.update(exp=now + timedelta(hours=1))
    forged = jwt.encode(claims, "some-other-key-some-other-key-0000", algorithm=ALGORITHM)
    assert client.post("/auth/reset-password", json={"token": forged, "new_password": NEW_PASSWORD}).status_code == 400


def test_new_password_must_meet_the_policy(client, outbox):
    register(client)
    client.post("/auth/forgot-password", json={"email": "user@example.com"})
    r = client.post("/auth/reset-password", json={"token": _token_from(outbox), "new_password": "short"})
    assert r.status_code == 422


def test_password_change_invalidates_outstanding_reset_links(client, outbox):
    tok = register(client)
    client.post("/auth/forgot-password", json={"email": "user@example.com"})
    token = _token_from(outbox)
    client.post("/auth/change-password", headers=auth(tok), json={"current_password": PASSWORD, "new_password": NEW_PASSWORD})
    assert client.post("/auth/reset-password", json={"token": token, "new_password": "yet-another-Pass-9"}).status_code == 400


def test_forgot_password_is_rate_limited(client, outbox, settings):
    from app import ratelimit

    settings.rate_limit_enabled = True
    ratelimit.reset()
    codes = [client.post("/auth/forgot-password", json={"email": "x@example.com"}).status_code for _ in range(7)]
    assert codes[:5] == [202] * 5 and 429 in codes[5:]


class _Resp:
    def __init__(self, status):
        self.status = status

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def test_mail_sends_to_resend_with_bearer_key(monkeypatch, settings):
    settings.resend_api_key = "re_secret"
    seen = {}

    def fake_urlopen(req, timeout):
        seen.update(url=req.full_url, auth=req.headers["Authorization"], body=req.data, timeout=timeout)
        return _Resp(200)

    monkeypatch.setattr(mail.urllib.request, "urlopen", fake_urlopen)
    assert mail.send_email("a@b.co", "Subject", "Body") is True
    assert seen["url"] == "https://api.resend.com/emails" and seen["auth"] == "Bearer re_secret"
    assert b'"a@b.co"' in seen["body"] and seen["timeout"] == 10


def test_mail_failures_are_swallowed_and_never_log_the_key(monkeypatch, settings, caplog):
    settings.resend_api_key = "re_secret"

    def boom(req, timeout):
        raise urllib.error.URLError("down")

    monkeypatch.setattr(mail.urllib.request, "urlopen", boom)
    assert mail.send_email("a@b.co", "S", "B") is False
    assert "re_secret" not in caplog.text and "a@b.co" not in caplog.text


def test_mail_without_key_does_nothing(settings):
    settings.resend_api_key = ""
    assert mail.send_email("a@b.co", "S", "B") is False
