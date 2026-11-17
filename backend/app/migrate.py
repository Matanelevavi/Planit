"""Schema management with Alembic.

`run_migrations(engine)` is called on startup. It also adopts databases that were created before
migrations existed (tables present, no `alembic_version`) by stamping them at the baseline revision.
"""

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect
from sqlalchemy.engine import Engine

BASELINE = "0001"
_SCRIPT_LOCATION = Path(__file__).parent / "migrations"


def _config(connection) -> Config:
    cfg = Config()
    cfg.set_main_option("script_location", str(_SCRIPT_LOCATION))
    cfg.attributes["connection"] = connection
    return cfg


def run_migrations(engine: Engine) -> None:
    with engine.begin() as connection:
        tables = set(inspect(connection).get_table_names())
        cfg = _config(connection)
        if "users" in tables and "alembic_version" not in tables:
            command.stamp(cfg, BASELINE)  # legacy database created by create_all()
        command.upgrade(cfg, "head")
