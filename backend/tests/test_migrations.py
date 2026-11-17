from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.pool import StaticPool

from app.db import Base
from app.migrate import BASELINE, run_migrations


def _engine():
    return create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)


def test_migrations_create_the_full_schema():
    engine = _engine()
    run_migrations(engine)
    tables = set(inspect(engine).get_table_names())
    assert {"users", "goals", "contributions", "alembic_version"} <= tables
    with engine.connect() as c:
        assert c.execute(text("select version_num from alembic_version")).scalar() == BASELINE


def test_running_twice_is_a_no_op():
    engine = _engine()
    run_migrations(engine)
    run_migrations(engine)  # must not raise or duplicate anything
    assert inspect(engine).get_table_names().count("users") == 1


def test_adopts_a_legacy_database_created_without_alembic():
    engine = _engine()
    Base.metadata.create_all(engine)  # how the live database was created before migrations
    with engine.begin() as c:
        c.execute(
            text(
                "insert into users (email, password_hash, token_version, failed_logins, created_at) "
                "values ('keep@example.com', 'x', 0, 0, '2026-01-01')"
            )
        )
    run_migrations(engine)  # stamps instead of trying to re-create tables
    with engine.connect() as c:
        assert c.execute(text("select version_num from alembic_version")).scalar() == BASELINE
        assert c.execute(text("select count(*) from users")).scalar() == 1  # data untouched


def test_migrations_match_the_models_no_drift():
    """Fails when someone changes app/models.py without adding a migration."""
    engine = _engine()
    run_migrations(engine)
    with engine.connect() as conn:
        diff = compare_metadata(MigrationContext.configure(conn, opts={"compare_type": True}), Base.metadata)
    assert diff == [], f"models and migrations differ: {diff}"
