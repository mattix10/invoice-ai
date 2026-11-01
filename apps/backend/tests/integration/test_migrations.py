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


def test_upgrade_repairs_legacy_purchase_order_constraints(isolated_connection):
    from sqlalchemy import inspect, text

    config = Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))
    config.attributes["connection"] = isolated_connection
    command.upgrade(config, "0008_purchase_orders")
    inspector = inspect(isolated_connection)
    tables = {
        "invoice_purchase_order_links": (
            "invoice_po_snapshot_versions",
            ["snapshot_id", "invoice_id"],
        ),
        "invoice_purchase_order_item_mappings": (
            "invoice_po_snapshot_version_items",
            ["snapshot_id", "invoice_line_position"],
        ),
        "invoice_reconciliations": ("invoice_po_snapshot_versions", ["source_snapshot_id"]),
    }
    for table, (target, columns) in tables.items():
        for fk in inspector.get_foreign_keys(table):
            if fk["referred_table"] in {
                "invoice_po_snapshot_versions",
                "invoice_po_snapshot_version_items",
            }:
                isolated_connection.execute(
                    text(f'ALTER TABLE "{table}" DROP CONSTRAINT "{fk["name"]}"')
                )
        references = {
            "invoice_purchase_order_links": "id, invoice_id",
            "invoice_purchase_order_item_mappings": "snapshot_id, position",
            "invoice_reconciliations": "id",
        }[table]
        isolated_connection.execute(
            text(
                f'ALTER TABLE "{table}" ADD FOREIGN KEY ({", ".join(columns)}) '
                f'REFERENCES "{target}" ({references})'
            )
        )
    isolated_connection.execute(
        text("ALTER TABLE invoice_po_snapshot_versions DROP CONSTRAINT uq_snapshot_source")
    )
    unique = next(
        item
        for item in inspector.get_unique_constraints("invoice_po_snapshot_version_items")
        if item["column_names"] == ["snapshot_id", "position", "po_line_position"]
    )
    isolated_connection.execute(
        text(f'ALTER TABLE invoice_po_snapshot_version_items DROP CONSTRAINT "{unique["name"]}"')
    )
    isolated_connection.execute(text("ALTER TABLE purchase_orders DROP COLUMN source_type"))
    isolated_connection.commit()

    command.upgrade(config, "head")
    command.check(config)
    assert "source_type" in {
        column["name"] for column in inspect(isolated_connection).get_columns("purchase_orders")
    }


def test_legacy_orders_with_unknown_provenance_abort_without_changes(isolated_connection):
    from sqlalchemy import text

    config = Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))
    config.attributes["connection"] = isolated_connection
    command.upgrade(config, "0008_purchase_orders")
    isolated_connection.execute(text("ALTER TABLE purchase_orders DROP COLUMN source_type"))
    isolated_connection.execute(
        text("""
        INSERT INTO purchase_orders (id, external_reference, supplier, currency, vat_rate, version)
        VALUES ('legacy-order', 'PO-1', 'Example', 'EUR', 0, 1)
    """)
    )
    isolated_connection.commit()

    with pytest.raises(RuntimeError, match="explicit provenance"):
        command.upgrade(config, "head")
    isolated_connection.rollback()
    assert (
        isolated_connection.execute(text("SELECT count(*) FROM purchase_orders")).scalar_one() == 1
    )
    assert (
        MigrationContext.configure(isolated_connection).get_current_revision()
        == "0008_purchase_orders"
    )
