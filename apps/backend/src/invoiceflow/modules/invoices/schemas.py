from datetime import date
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import (
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

from invoiceflow.core.api_schema import ApiSchema

Money = Annotated[str, StringConstraints(pattern=r"^-?\d+\.\d{2}$")]
InvoiceId = Annotated[str, StringConstraints(max_length=64, pattern=r"^INV-\d{4}-\d{4,}$")]


class InvoiceStatus(StrEnum):
    needs_review = "needs_review"
    approved = "approved"
    processing = "processing"


class InvoiceQuery(ApiSchema):
    model_config = ConfigDict(extra="forbid")
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    status: InvoiceStatus | None = None
    q: str | None = Field(default=None, min_length=1, max_length=100)
    due_from: date | None = None
    due_to: date | None = None
    sort: Literal["id", "-id", "due", "-due", "gross_amount", "-gross_amount"] = "-id"

    @field_validator("q", mode="before")
    @classmethod
    def trim_query(cls, value: str | None) -> str | None:
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def validate_dates(self):
        if self.due_from and self.due_to and self.due_from > self.due_to:
            raise ValueError("due_from must not be later than due_to")
        return self


class InvoiceSummary(ApiSchema):
    id: InvoiceId
    vendor: str
    due: date
    currency: str
    status: InvoiceStatus
    gross_amount: Money


class InvoiceItem(ApiSchema):
    position: int = Field(ge=1)
    name: str
    quantity: int = Field(gt=0)
    unit_net: Money
    net: Money


class InvoiceTotals(ApiSchema):
    net: Money
    vat: Money
    gross: Money


class InvoiceDetail(InvoiceSummary):
    issued: date | None
    purchase_order: str | None
    vat_rate: str | None
    items: list[InvoiceItem]
    totals: InvoiceTotals | None


class InvoicePage(ApiSchema):
    items: list[InvoiceSummary]
    page: int
    page_size: int
    total: int


class ComparisonItem(ApiSchema):
    position: int = Field(ge=1)
    name: str
    quantity: int = Field(gt=0)
    invoice_unit_net: Money
    po_unit_net: Money
    invoice_net: Money
    po_net: Money


class InvoiceComparison(ApiSchema):
    invoice_id: InvoiceId
    purchase_order: str
    delivery_receipt_id: str | None
    currency: str
    vat_rate: str
    items: list[ComparisonItem]
    invoice_totals: InvoiceTotals
    po_totals: InvoiceTotals
    difference: InvoiceTotals
    difference_percent: str | None


class ErrorDetail(ApiSchema):
    code: str
    message: str
    current_revision: int | None = None
    existing_document_id: str | None = None


class ApiError(ApiSchema):
    error: ErrorDetail


class ReconciliationRequest(ApiSchema):
    model_config = ConfigDict(extra="forbid")


class ReconciliationLine(ApiSchema):
    position: int
    name: str
    invoice_quantity: int
    po_quantity: int
    invoice_unit_net: Money
    po_unit_net: Money
    invoice_net: Money
    po_net: Money
    difference_net: Money


class ReconciliationInputLine(ApiSchema):
    position: int
    name: str
    invoice_quantity: int
    po_quantity: int
    invoice_unit_net: Money
    po_unit_net: Money


class ReconciliationInputs(ApiSchema):
    source_snapshot_id: str | None = Field(default=None, exclude_if=lambda value: value is None)
    invoice_id: InvoiceId
    purchase_order: str
    delivery_receipt_id: str | None
    currency: str
    vat_rate: str
    lines: list[ReconciliationInputLine]
    stored_invoice_totals: InvoiceTotals


class ReconciliationResult(ApiSchema):
    invoice_id: InvoiceId
    revision: int
    state: Literal["completed"]
    algorithm: Literal["deterministic-v1", "deterministic-v2"]
    input_hash: str
    inputs: ReconciliationInputs
    lines: list[ReconciliationLine]
    invoice_totals: InvoiceTotals
    po_totals: InvoiceTotals
    difference: InvoiceTotals
    difference_percent: str | None


class EvidenceReference(ApiSchema):
    kind: Literal[
        "invoice", "invoice_line", "po_snapshot", "po_line", "reconciliation", "discrepancy_line"
    ]
    invoice_id: InvoiceId
    reconciliation_revision: int | None
    line_position: int | None
    evidence_id: str
    label: str


class ReconciliationRead(ApiSchema):
    revision: int
    input_hash: str
    algorithm_version: Literal["deterministic-v1", "deterministic-v2"]
    result: ReconciliationResult
    evidence_refs: list[EvidenceReference]
    is_current: bool
