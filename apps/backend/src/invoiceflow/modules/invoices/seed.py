"""Seed the fictional demo records explicitly, only on a local PostgreSQL server."""

import os
from datetime import date
from decimal import Decimal

from sqlalchemy import insert
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from invoiceflow.core.config import Settings
from invoiceflow.core.database import create_database_engine
from invoiceflow.modules.invoices.models import (
    Invoice,
    InvoiceItem,
    InvoicePoItem,
    InvoicePoSnapshot,
)


def seed(session: Session) -> int:
    rows = [
        Invoice(
            id="INV-2026-1042",
            vendor="Northline Office Sp. z o.o.",
            issued=date(2026, 10, 22),
            due=date(2026, 11, 21),
            currency="PLN",
            status="needs_review",
            gross_amount=Decimal("12915.00"),
            net_amount=Decimal("10500.00"),
            vat_amount=Decimal("2415.00"),
            vat_rate=Decimal("0.23"),
            items=[
                InvoiceItem(
                    position=1, name="27-inch monitor", quantity=10, unit_net=Decimal("820.00")
                ),
                InvoiceItem(position=2, name="Keyboard", quantity=10, unit_net=Decimal("110.00")),
                InvoiceItem(
                    position=3, name="USB-C docking station", quantity=5, unit_net=Decimal("240.00")
                ),
            ],
            po_snapshot=InvoicePoSnapshot(
                purchase_order="PO-2026-0871",
                delivery_receipt_id="DR-2026-1042",
                currency="PLN",
                vat_rate=Decimal("0.23"),
                items=[
                    InvoicePoItem(position=1, quantity=10, unit_net=Decimal("770.00")),
                    InvoicePoItem(position=2, quantity=10, unit_net=Decimal("110.00")),
                    InvoicePoItem(position=3, quantity=5, unit_net=Decimal("240.00")),
                ],
            ),
        ),
        Invoice(
            id="INV-2026-1041",
            vendor="Riverton Cloud Ltd.",
            due=date(2026, 11, 19),
            currency="PLN",
            status="approved",
            gross_amount=Decimal("3444.00"),
        ),
        Invoice(
            id="INV-2026-1040",
            vendor="Baltic Logistics Sp. z o.o.",
            due=date(2026, 11, 18),
            currency="PLN",
            status="processing",
            gross_amount=Decimal("1845.00"),
        ),
        Invoice(
            id="INV-2026-1039",
            vendor="Fieldstone Services",
            due=date(2026, 11, 16),
            currency="PLN",
            status="needs_review",
            gross_amount=Decimal("5166.00"),
        ),
    ]
    count = 0
    for row in rows:
        values = {column.name: getattr(row, column.name) for column in Invoice.__table__.columns}
        inserted = session.scalar(
            pg_insert(Invoice)
            .values(**values)
            .on_conflict_do_nothing(index_elements=["id"])
            .returning(Invoice.id)
        )
        if inserted is None:
            continue
        count += 1
        for item in row.items:
            session.execute(
                insert(InvoiceItem).values(
                    invoice_id=row.id,
                    position=item.position,
                    name=item.name,
                    quantity=item.quantity,
                    unit_net=item.unit_net,
                )
            )
        snapshot = row.po_snapshot
        if snapshot is not None:
            session.execute(
                insert(InvoicePoSnapshot).values(
                    invoice_id=row.id,
                    purchase_order=snapshot.purchase_order,
                    delivery_receipt_id=snapshot.delivery_receipt_id,
                    currency=snapshot.currency,
                    vat_rate=snapshot.vat_rate,
                )
            )
            for item in snapshot.items:
                session.execute(
                    insert(InvoicePoItem).values(
                        invoice_id=row.id,
                        position=item.position,
                        quantity=item.quantity,
                        unit_net=item.unit_net,
                    )
                )
    return count


def main() -> None:
    settings = Settings()
    url = make_url(settings.database_url.get_secret_value())
    if os.environ.get("INVOICEFLOW_ENV") != "local" or url.host not in {
        "localhost",
        "127.0.0.1",
        "::1",
    }:
        raise SystemExit("Seeding requires INVOICEFLOW_ENV=local and a loopback PostgreSQL host")
    engine = create_database_engine(settings)
    try:
        with Session(engine) as session, session.begin():
            count = seed(session)
        print(f"Inserted {count} demo invoices; existing invoices were preserved.")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
