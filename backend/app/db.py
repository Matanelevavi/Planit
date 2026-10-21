import warnings
from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

# SQLite stores Numeric as float; the Decimal values we exchange are quantized to cents,
# so this is safe. PostgreSQL (production) uses true NUMERIC.
warnings.filterwarnings("ignore", message="Dialect sqlite.*does \\*not\\* support Decimal")


class Base(DeclarativeBase):
    pass


def make_engine(url: str) -> Engine:
    if url.startswith("sqlite"):
        return create_engine(url, connect_args={"check_same_thread": False})
    # prepare_threshold=None: no server-side prepared statements, so connection poolers in
    # transaction mode (Neon/Supabase "-pooler" hosts, PgBouncer) work correctly.
    return create_engine(url, pool_pre_ping=True, connect_args={"prepare_threshold": None})


engine = make_engine(get_settings().database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
