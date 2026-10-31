"""Deterministic reconciliation over stored structured invoice and PO data."""

import hashlib
import json

from invoiceflow.modules.invoices.calculations import (
    calculate_difference,
    calculate_totals,
    line_net,
)
from invoiceflow.modules.invoices.models import Reconciliation
from invoiceflow.modules.invoices.schemas import (
    EvidenceReference,
    ReconciliationRead,
    ReconciliationResult,
)
from invoiceflow.modules.invoices.service import InvoiceNotFound, checked_totals, money, totals_dto


class ReconciliationConflict(Exception):
    pass


class ReconciliationNotFound(Exception):
    pass


def reconcile_inputs(invoice, po=None) -> dict:
    po = po if po is not None else invoice.po_snapshot
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


def fingerprint(invoice, po):
    result = reconcile_inputs(invoice, po)
    snapshot_id = getattr(po, "id", None) if po is not None else None
    algorithm = "deterministic-v2" if snapshot_id else "deterministic-v1"
    if snapshot_id:
        result["inputs"]["source_snapshot_id"] = snapshot_id
    encoded = json.dumps(
        {"algorithm": algorithm, "inputs": result["inputs"]}, sort_keys=True, separators=(",", ":")
    ).encode()
    return result, algorithm, hashlib.sha256(encoded).hexdigest(), snapshot_id


def evidence_references(result, snapshot_id):
    invoice_id, revision = result.invoice_id, result.revision
    prefix = f"invoice:{invoice_id}"
    snapshot = f"{prefix}:po-snapshot:{snapshot_id or 'legacy'}"
    reconciliation = f"{prefix}:reconciliation:{revision}"
    refs = []

    def add(kind, evidence_id, label, line_position=None):
        refs.append(
            EvidenceReference(
                kind=kind,
                invoice_id=invoice_id,
                reconciliation_revision=revision,
                line_position=line_position,
                evidence_id=evidence_id,
                label=label,
            )
        )

    add("invoice", prefix, "Invoice")
    add("po_snapshot", snapshot, "Purchase order snapshot")
    add("reconciliation", reconciliation, "Reconciliation")
    for line in result.lines:
        position = line.position
        add("invoice_line", f"{prefix}:line:{position}", f"Invoice line {position}", position)
        add("po_line", f"{snapshot}:line:{position}", f"Purchase order line {position}", position)
        add(
            "discrepancy_line",
            f"{reconciliation}:line:{position}",
            f"Difference line {position}",
            position,
        )
    return refs


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
                po = self.repository.active_snapshot(invoice)
                result, algorithm, input_hash, snapshot_id = fingerprint(invoice, po)
            except ValueError as exc:
                raise ReconciliationConflict from exc
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
                    source_snapshot_id=snapshot_id,
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

    def read(self, invoice_id: str, revision: int | None = None) -> ReconciliationRead:
        invoice = self.repository.get(invoice_id)
        if invoice is None:
            raise InvoiceNotFound
        record = self.repository.completed_reconciliation(invoice_id, revision)
        if record is None:
            raise ReconciliationNotFound
        result = ReconciliationResult.model_validate(record.payload)
        if (result.invoice_id, result.revision, result.input_hash) != (
            invoice_id,
            record.revision,
            record.input_hash,
        ):
            raise ValueError("Invalid stored reconciliation")
        if (result.algorithm == "deterministic-v2") != (record.source_snapshot_id is not None):
            raise ValueError("Invalid stored reconciliation source")
        if result.inputs.source_snapshot_id != record.source_snapshot_id:
            raise ValueError("Invalid stored reconciliation source")
        try:
            po = self.repository.active_snapshot(invoice)
            _, algorithm, input_hash, _ = fingerprint(invoice, po)
            is_current = (result.algorithm, record.input_hash) == (algorithm, input_hash)
        except ValueError:
            is_current = False
        snapshot = self.repository.historical_snapshot(invoice, record.source_snapshot_id)
        invoice_positions = {item.position for item in invoice.items}
        po_positions = {item.position for item in snapshot.items} if snapshot else set()
        refs = evidence_references(result, record.source_snapshot_id)
        refs = [
            ref
            for ref in refs
            if (ref.kind not in {"po_snapshot", "po_line"} or snapshot is not None)
            and (ref.kind != "invoice_line" or ref.line_position in invoice_positions)
            and (ref.kind != "po_line" or ref.line_position in po_positions)
        ]
        return ReconciliationRead(
            revision=record.revision,
            input_hash=record.input_hash,
            algorithm_version=result.algorithm,
            result=result,
            evidence_refs=refs,
            is_current=is_current,
        )
