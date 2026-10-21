# Security

## Reporting a vulnerability
Please open a private security advisory on GitHub (Security → Advisories) instead of a public issue.

## What is implemented

| Area | Measure |
|---|---|
| Passwords | Argon2id (`argon2-cffi`), automatic rehash on login, 10–128 chars, must mix letters with digits/symbols, must not contain the e-mail name |
| Sessions | Short-lived (15 min) access JWT kept **in memory only**; 14-day refresh JWT in an **httpOnly, SameSite=Lax, Secure (prod), path-scoped** cookie |
| Token safety | HS256 pinned (`alg: none` and other algorithms rejected), required `exp/iat/sub/typ/ver` claims, access ≠ refresh (`typ`), per-user `token_version` so password change / "sign out everywhere" revokes all tokens |
| Brute force | Per-IP rate limits on login/register/refresh/change-password/delete; per-account lock-out after 5 failures; identical error for unknown e-mail vs wrong password; dummy hash verification equalises timing |
| Authorisation | Every goal query is filtered by the authenticated `user_id`; other users' resources return 404 (no existence leak). Covered by automated IDOR tests |
| Input | Pydantic v2 validation on every body/query (types, ranges, lengths, ≤ 60-year horizon, 2-decimal money); unknown fields ignored (no mass-assignment of `user_id`, balances…); ORM only – no raw SQL |
| Transport/headers | CORS allow-list with credentials, CSRF defence-in-depth (Origin check on cookie endpoints), `nosniff`, `X-Frame-Options: DENY`, strict CSP, `Cache-Control: no-store`, HSTS when secure, 1 MB body limit, docs disabled in prod |
| Errors | Unhandled exceptions return a generic 500; details stay in server logs |
| Frontend | No `dangerouslySetInnerHTML`; React escapes all user text; error messages are mapped to fixed strings (server text is never shown); token never in `localStorage`; nginx CSP `default-src 'self'` |
| Privacy | `GET /auth/export` (data portability) and `DELETE /auth/me` (erasure, with password confirmation) |
| Supply chain | Pinned backend deps, lockfiles for Node, `pip-audit` + `npm audit` in CI, Dependabot, containers run as non-root |
| Config safety | `PLANIT_ENV=prod` refuses to start without a 32+ char secret and secure cookies; `.env` is git-ignored |

## Known limitations
- Registration reveals whether an e-mail is already registered (409). Accepted for UX; mitigated by rate limiting.
- Rate limiting is per process (in-memory); use a gateway/Redis limiter with multiple replicas.
- Stateless refresh tokens: a stolen refresh cookie works until expiry, password change, or "sign out everywhere".
- No MFA, e-mail verification or password reset yet.
- Behind a reverse proxy, run uvicorn with `--proxy-headers` and trust only your proxy so client IPs are real (the Docker image does this).
- The MCP server stores a Planit password in your MCP client's config; treat that file as a secret.
