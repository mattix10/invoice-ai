from alembic import context
from sqlalchemy.engine import Connection

from invoiceflow.core.config import Settings
from invoiceflow.core.database import Base, create_database_engine
from invoiceflow.modules.invoices import models  # noqa: F401

config = context.config
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=Settings().database_url.get_secret_value(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_with_connection(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    # Tests can supply an isolated schema connection; CLI owns and disposes its engine.
    if (connection := config.attributes.get("connection")) is not None:
        run_with_connection(connection)
        return
    engine = create_database_engine(Settings())
    try:
        with engine.connect() as connection:
            run_with_connection(connection)
    finally:
        engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
