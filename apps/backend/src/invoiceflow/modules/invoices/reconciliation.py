"""Deterministic reconciliation over stored structured invoice and PO data."""

import hashlib
import json

from invoiceflow.modules.invoices.calculations import (
    calculate_difference,
    calculate_totals,
    line_net,
)
from invoiceflow.modules.invoices.models import Reconciliation
from invoiceflow.modules.invoices.schemas import ReconciliationResult
from invoiceflow.modules.invoices.service import InvoiceNotFound, checked_totals, money, totals_dto


class ReconciliationConflict(Exception):
    pass


def reconcile_inputs(invoice) -> dict:
    po = invoice.po_snapshot
    if (
        po is None
        or invoice.vat_rate is None
        or not invoice.items
        or not po.items
        or invoice.currency != po.currency
        or invoice.vat_rate != po.vat_rate
    ):
        raise ValueError("Incomplete or incompatible invoice and purchase order")
    po_items = {item.position: item for item in po.items}
    if set(po_items) != {item.position for item in invoice.items}:
        raise ValueError("Invoice and purchase order positions do not match")
    invoice_totals = checked_totals(invoice)
    po_totals = calculate_totals(po.items, po.vat_rate, po.currency)
    difference, percent = calculate_difference(invoice_totals, po_totals)
    lines = []
    for item in invoice.items:
        other = po_items[item.position]
        invoice_net = line_net(item.quantity, item.unit_net)
        po_net = line_net(other.quantity, other.unit_net)
        lines.append(
            {
                "position": item.position,
                "name": item.name,
                "invoice_quantity": item.quantity,
                "po_quantity": other.quantity,
                "invoice_unit_net": money(item.unit_net),
                "po_unit_net": money(other.unit_net),
                "invoice_net": money(invoice_net),
                "po_net": money(po_net),
                "difference_net": money(invoice_net - po_net),
            }
        )
    inputs = {
        "invoice_id": invoice.id,
        "purchase_order": po.purchase_order,
        "delivery_receipt_id": po.delivery_receipt_id,
        "currency": invoice.currency,
        "vat_rate": str(invoice.vat_rate),
        "lines": [
            {
                key: line[key]
                for key in (
                    "position",
                    "name",
                    "invoice_quantity",
                    "po_quantity",
                    "invoice_unit_net",
                    "po_unit_net",
                )
            }
            for line in lines
        ],
        "stored_invoice_totals": totals_dto(invoice_totals).model_dump(),
    }
    return {
        "inputs": inputs,
        "lines": lines,
        "invoice_totals": totals_dto(invoice_totals).model_dump(),
        "po_totals": totals_dto(po_totals).model_dump(),
        "difference": totals_dto(difference).model_dump(),
        "difference_percent": str(percent) if percent is not None else None,
    }


def complete_processing(result: Reconciliation) -> None:
    if result.state != "processing":
        raise ValueError("Invalid processing transition")
    result.state = "completed"


class ReconciliationService:
    def __init__(self, repository):
        self.repository = repository

    def reconcile(self, invoice_id: str) -> ReconciliationResult:
        try:
            invoice = self.repository.lock_invoice(invoice_id)
            if invoice is None:
                raise InvoiceNotFound
            try:
                result = reconcile_inputs(invoice)
            except ValueError as exc:
                raise ReconciliationConflict from exc
            algorithm = "deterministic-v1"
            encoded = json.dumps(
                {"algorithm": algorithm, "inputs": result["inputs"]},
                sort_keys=True,
                separators=(",", ":"),
            ).encode()
            input_hash = hashlib.sha256(encoded).hexdigest()
            existing = self.repository.reconciliation(invoice_id, input_hash)
            if existing is not None:
                response = ReconciliationResult.model_validate(existing.payload)
            else:
                response = ReconciliationResult(
                    invoice_id=invoice_id,
                    revision=self.repository.next_revision(invoice_id),
                    state="completed",
                    algorithm=algorithm,
                    input_hash=input_hash,
                    **result,
                )
                record = Reconciliation(
                    invoice_id=invoice_id,
                    revision=response.revision,
                    input_hash=input_hash,
                    state="processing",
                    payload=response.model_dump(mode="json"),
                )
                self.repository.save_reconciliation(record)
                complete_processing(record)
            self.repository.commit()
            return response
        except Exception:
            self.repository.rollback()
            raise
