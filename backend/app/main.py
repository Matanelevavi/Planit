import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.staticfiles import StaticFiles

from app import db as database
from app.config import get_settings
from app.routers import auth, goals

log = logging.getLogger("planit")
MAX_BODY_BYTES = 1_000_000

API_CSP = "default-src 'none'; frame-ancestors 'none'"
# The SPA is same-origin only. Recharts/React set inline styles, hence 'unsafe-inline' for styles.
SPA_CSP = (
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; "
    "connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # Dev convenience. Production schema changes should move to Alembic migrations.
    database.Base.metadata.create_all(database.engine)
    yield


class SPAFiles(StaticFiles):
    """Static files with client-side-routing fallback to index.html (but not for missing assets)."""

    async def get_response(self, path: str, scope) -> Response:
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code == 404 and "." not in Path(path).name:
                return FileResponse(Path(self.directory) / "index.html")
            raise


def _build_api(docs: bool) -> FastAPI:
    api = FastAPI(
        title="Planit API",
        version="1.0.0",
        docs_url="/docs" if docs else None,
        redoc_url=None,
        openapi_url="/openapi.json" if docs else None,
    )

    @api.exception_handler(Exception)
    async def unhandled(_: Request, exc: Exception) -> JSONResponse:
        log.exception("Unhandled error", exc_info=exc)  # details stay in the log, not the response
        return JSONResponse({"detail": "Internal server error"}, status_code=500)

    @api.get("/health", tags=["meta"])
    def health() -> dict:
        return {"status": "ok"}

    api.include_router(auth.router)
    api.include_router(goals.router)
    return api


def create_app() -> FastAPI:
    s = get_settings()
    docs = s.env != "prod"
    api = _build_api(docs)

    frontend = Path(s.frontend_dir) if s.frontend_dir else None
    if frontend and not (frontend / "index.html").is_file():
        raise RuntimeError(f"PLANIT_FRONTEND_DIR has no index.html: {frontend}")

    if frontend:
        app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
        app.mount("/api", api)
        app.mount("/", SPAFiles(directory=frontend, html=True), name="spa")
        api_prefix = "/api"
    else:
        api.router.lifespan_context = lifespan
        app, api_prefix = api, ""

    app.add_middleware(
        CORSMiddleware,
        allow_origins=s.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @app.middleware("http")
    async def hardening(request: Request, call_next) -> Response:
        length = request.headers.get("content-length")
        if length and length.isdigit() and int(length) > MAX_BODY_BYTES:
            return JSONResponse({"detail": "Request too large"}, status_code=413)
        response = await call_next(request)
        path = request.url.path
        is_api = path == api_prefix or path.startswith(api_prefix + "/") if api_prefix else True
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
        if is_api:
            if not (docs and path.removeprefix(api_prefix).startswith(("/docs", "/openapi"))):
                response.headers["Content-Security-Policy"] = API_CSP
            response.headers["Cache-Control"] = "no-store"  # financial data: never cached
            response.headers["Cross-Origin-Resource-Policy"] = "same-site"
        else:
            response.headers["Content-Security-Policy"] = SPA_CSP
            # hashed assets are immutable; the HTML shell must always be revalidated
            hashed = path.startswith("/assets/")
            response.headers["Cache-Control"] = (
                "public, max-age=31536000, immutable" if hashed else "no-cache"
            )
        if s.cookie_secure:
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        return response

    return app


app = create_app()
