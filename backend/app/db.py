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
    kwargs = {"connect_args": {"check_same_thread": False}} if url.startswith("sqlite") else {
        "pool_pre_ping": True
    }
    return create_engine(url, **kwargs)


engine = make_engine(get_settings().database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
