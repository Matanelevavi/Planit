"""Outgoing e-mail through the Resend HTTP API (no extra dependency)."""

import json
import logging
import urllib.error
import urllib.request

from app.config import get_settings

log = logging.getLogger("planit.mail")
RESEND_URL = "https://api.resend.com/emails"


def send_email(to: str, subject: str, text: str) -> bool:
    """Send a plain-text e-mail. Never raises: failures are logged (without the recipient's data
    or the API key) and reported as False, so callers can't be used to probe for accounts."""
    s = get_settings()
    if not s.resend_api_key:
        log.warning("E-mail not sent: PLANIT_RESEND_API_KEY is not configured")
        return False
    body = json.dumps({"from": s.mail_from, "to": [to], "subject": subject, "text": text}).encode()
    req = urllib.request.Request(  # noqa: S310 - fixed https URL
        RESEND_URL,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {s.resend_api_key}",
            "Content-Type": "application/json",
            "User-Agent": "planit/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:  # noqa: S310
            return 200 <= resp.status < 300
    except (urllib.error.URLError, TimeoutError) as exc:
        log.error("E-mail delivery failed: %s", type(exc).__name__)
        return False
