from alembic import context

import app.models  # noqa: F401  (registers the tables on Base.metadata)
from app.db import Base

target_metadata = Base.metadata


def run_migrations_online() -> None:
    # app.migrate.run_migrations passes in an open connection (same engine the app uses)
    connection = context.config.attributes["connection"]
    context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
    context.run_migrations()


run_migrations_online()
