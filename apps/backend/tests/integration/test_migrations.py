from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext

pytestmark = pytest.mark.integration


def test_migrations_upgrade_check_downgrade_and_reapply_on_a_clean_schema(isolated_connection):
    # Arrange
    backend = Path(__file__).resolve().parents[2]
    config = Config(str(backend / "alembic.ini"))
    config.attributes["connection"] = isolated_connection

    # Act / Assert: real PostgreSQL, no startup create_all and no SQLite replacement.
    assert MigrationContext.configure(isolated_connection).get_current_revision() is None
    command.upgrade(config, "head")
    head = config.get_main_option("script_location")
    from alembic.script import ScriptDirectory

    expected_revision = ScriptDirectory.from_config(config).get_current_head()
    assert head
    assert (
        MigrationContext.configure(isolated_connection).get_current_revision() == expected_revision
    )
    command.check(config)
    command.downgrade(config, "base")
    assert MigrationContext.configure(isolated_connection).get_current_revision() is None
    command.upgrade(config, "head")
    assert (
        MigrationContext.configure(isolated_connection).get_current_revision() == expected_revision
    )
