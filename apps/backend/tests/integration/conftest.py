import os
from collections.abc import Iterator
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.engine import Connection, Engine, make_url
from sqlalchemy.orm import Session

from invoiceflow.core.config import Settings
from invoiceflow.core.database import create_database_engine


@pytest.fixture(scope="session")
def database_settings() -> Settings:
    raw_url = os.environ.get("TEST_DATABASE_URL")
    if not raw_url:
        pytest.fail("TEST_DATABASE_URL is required; start the PostgreSQL test service first")
    url = make_url(raw_url)
    if not url.database or not url.database.endswith("_test"):
        pytest.fail("TEST_DATABASE_URL must name a disposable database ending in _test")
    return Settings(database_url=raw_url, _env_file=None)


@pytest.fixture(scope="session")
def database_engine(database_settings: Settings) -> Iterator[Engine]:
    engine = create_database_engine(database_settings)
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        yield engine
    finally:
        engine.dispose()


@pytest.fixture
def isolated_connection(database_engine: Engine) -> Iterator[Connection]:
    # Only the random schema created by this fixture is ever dropped.
    schema = f"test_{uuid4().hex}"
    with database_engine.connect() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        connection.execute(text(f'SET search_path TO "{schema}"'))
        connection.commit()
        try:
            yield connection
        finally:
            connection.rollback()
            connection.execute(text("SET search_path TO public"))
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
            connection.commit()


@pytest.fixture
def session(isolated_connection: Connection) -> Iterator[Session]:
    with Session(isolated_connection, expire_on_commit=False) as database_session:
        yield database_session
