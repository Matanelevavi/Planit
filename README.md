# Planit – Financial Goal Planner

<img src="frontend/src/assets/logo.png" alt="Planit Logo" width="80" />

![Stack](https://img.shields.io/badge/Stack-FastAPI%20%2B%20React%20%2B%20TypeScript-blue)
![Auth](https://img.shields.io/badge/Auth-Argon2%20%2B%20JWT%20(httpOnly%20refresh)-red)
![Status](https://img.shields.io/badge/Status-Beta-yellow)

**Planit** helps you reach life goals (housing, emergency fund, retirement, education) by turning each goal into
a concrete monthly number and telling you honestly whether you are on track. It focuses on *behavioural
consistency* – log your deposits, see the gap to your plan, adjust – rather than market speculation.

Hebrew (RTL) is the default UI language; English is one click away.

## Features

- **Goals with a real planning engine** – required monthly deposit from an annuity (PMT) formula with
  compound return, in exact `Decimal` arithmetic.
- **On track / At risk / Off track** – your balance is compared with where *your own plan* says you should be today.
- **Tunnel chart** – expected path with a cautious/optimistic band around it (Recharts).
- **What-if** – try another monthly deposit and see the balance on the target date and when you would reach the goal.
- **Deposit & withdrawal log** per goal; editing a balance is recorded as an adjustment, never silently overwritten.
- **Accounts** – register, sign in, change password, sign out everywhere, export all your data (JSON), delete your account.
- **MCP server** – let an AI assistant read your goals, run what-ifs and (on request) log deposits. See [`mcp-server/`](mcp-server/README.md).

## Architecture

```
frontend/    React 19 + TypeScript + Vite + Tailwind 4 + TanStack Query   (served by nginx in Docker)
backend/     FastAPI + SQLAlchemy 2 (SQLite in dev, PostgreSQL in production)
mcp-server/  Node MCP server – a thin client over the backend's REST API
```

The browser only talks to `/api/*` (same origin). In dev Vite proxies it to FastAPI; in Docker nginx does.

## Quick start (development)

Prerequisites: Python 3.11+, Node 20+.

```bash
# 1. Backend  -> http://127.0.0.1:8000  (interactive docs at /docs)
cd backend
python -m venv .venv
. .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload

# 2. Frontend -> http://localhost:5173   (new terminal)
cd frontend
npm install
npm run dev
```

In development a random signing key is generated per run (sessions end when the server restarts).
SQLite data is stored in `backend/planit.db` (git-ignored).

## Run with Docker (PostgreSQL + nginx)

```bash
cp .env.example .env            # then set POSTGRES_PASSWORD and PLANIT_SECRET_KEY
docker compose up --build       # -> http://localhost:8080
```

Production mode (`PLANIT_ENV=prod`) refuses to start without a strong secret and `PLANIT_COOKIE_SECURE=true`,
so put it behind HTTPS (a reverse proxy or your host's TLS). Interactive API docs are disabled in production.

## Tests & quality

```bash
cd backend      && pytest --cov=app && ruff check .     # 108 tests, ~98 % coverage
cd frontend     && npm test && npm run lint && npm run build   # 57 tests
cd mcp-server   && npm test                              # 10 tests
```

CI (GitHub Actions) runs all of the above plus dependency audits (`pip-audit`, `npm audit`) on every push and PR.

## Configuration (backend, `PLANIT_*` environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `PLANIT_ENV` | `dev` | `dev`, `test` or `prod` |
| `PLANIT_DATABASE_URL` | `sqlite:///./planit.db` | e.g. `postgresql+psycopg://user:pass@host/db` |
| `PLANIT_SECRET_KEY` | random in dev | **required (32+ chars) in prod** |
| `PLANIT_COOKIE_SECURE` | `false` | **must be `true` in prod** (HTTPS) |
| `PLANIT_CORS_ORIGINS` | localhost:5173 | JSON list of allowed web origins |
| `PLANIT_ACCESS_TOKEN_MINUTES` / `PLANIT_REFRESH_TOKEN_DAYS` | 15 / 14 | token lifetimes |
| `PLANIT_MAX_FAILED_LOGINS` / `PLANIT_LOCKOUT_MINUTES` | 5 / 15 | brute-force lock-out |

## Security

See [SECURITY.md](SECURITY.md) for the threat model, what is implemented, and known limitations.

## Known limitations / roadmap

- Database schema is created automatically; add **Alembic** migrations before changing models in production.
- Rate limiting is in-memory (per process). Behind several replicas, add a gateway or Redis-backed limiter.
- No e-mail verification or password-reset flow yet (needs an e-mail provider).
- Planit is a *planning tool*. Projections are estimates from the return you enter; it gives no investment, tax or legal advice.
  Before a public launch have the privacy policy / terms reviewed (Israeli Privacy Protection Law, Amendment 13).
- Ideas: recurring-deposit reminders, goal templates, shared goals, an in-app AI assistant built on the MCP tools.

---
*Developed by Matanel Levavi – Full Stack, Data & Cyber Security Developer*
