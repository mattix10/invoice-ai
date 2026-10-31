from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import (
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

from invoiceflow.core.api_schema import ApiSchema

MoneyInput = Annotated[str, StringConstraints(pattern=r"^\d{1,16}\.\d{2}$")]
VatInput = Annotated[str, StringConstraints(pattern=r"^(0(?:\.\d{1,4})?|1(?:\.0{1,4})?)$")]


class NullableDraftModel(ApiSchema):
    model_config = ConfigDict(extra="forbid")

    @field_validator("*", mode="before")
    @classmethod
    def empty_to_none(cls, value):
        return None if isinstance(value, str) and not value.strip() else value


class DraftItem(NullableDraftModel):
    model_config = ConfigDict(extra="forbid")
    position: int | None = Field(ge=1, le=2147483647, strict=True)
    name: str | None = Field(max_length=255)
    quantity: int | None = Field(gt=0, le=2147483647, strict=True)
    unit_net: MoneyInput | None


class DeclaredTotals(NullableDraftModel):
    model_config = ConfigDict(extra="forbid")
    net: MoneyInput | None
    vat: MoneyInput | None
    gross: MoneyInput | None


class Draft(NullableDraftModel):
    model_config = ConfigDict(extra="forbid")
    vendor: str | None = Field(max_length=255)
    supplier_invoice_number: str | None = Field(max_length=255)
    issued: date | None
    due: date | None
    currency: Annotated[str, StringConstraints(pattern=r"^[A-Z]{3}$")] | None
    vat_rate: VatInput | None
    items: list[DraftItem] = Field(max_length=1000)
    declared_totals: DeclaredTotals | None = None

    @model_validator(mode="after")
    def unique_positions(self):
        positions = [x.position for x in self.items if x.position is not None]
        if len(positions) != len(set(positions)):
            raise ValueError("Item positions must be unique")
        return self


class SuggestionDecision(ApiSchema):
    model_config = ConfigDict(extra="forbid")
    field: Literal[
        "vendor",
        "supplierInvoiceNumber",
        "issued",
        "due",
        "currency",
        "vatRate",
        "items",
        "declaredTotals",
    ]
    decision: Literal["applied", "rejected"]


class SuggestionDecisions(ApiSchema):
    model_config = ConfigDict(extra="forbid")
    suggestion_version: int = Field(gt=0, strict=True)
    decisions: list[SuggestionDecision] = Field(min_length=1, max_length=8)

    @model_validator(mode="after")
    def unique_fields(self):
        fields = [decision.field for decision in self.decisions]
        if len(fields) != len(set(fields)):
            raise ValueError("Each field may have only one decision")
        return self


class DraftRequest(ApiSchema):
    model_config = ConfigDict(extra="forbid")
    expected_revision: int = Field(ge=0, strict=True)
    draft: Draft
    suggestion_decisions: SuggestionDecisions | None = None
    suggestion_decision_batches: list[SuggestionDecisions] = Field(
        default_factory=list, max_length=100
    )

    @model_validator(mode="after")
    def unique_suggestion_versions(self):
        batches = list(self.suggestion_decision_batches)
        if self.suggestion_decisions:
            batches.append(self.suggestion_decisions)
        versions = [batch.suggestion_version for batch in batches]
        if len(versions) != len(set(versions)):
            raise ValueError("Each suggestion version may appear only once")
        return self


class ConfirmRequest(ApiSchema):
    model_config = ConfigDict(extra="forbid")
    expected_revision: int = Field(ge=0, strict=True)


class Validation(ApiSchema):
    complete: bool
    errors: list[str]


class DraftResponse(ApiSchema):
    draft: Draft
    revision: int
    validation: Validation


class DocumentResponse(DraftResponse):
    document_id: str
    invoice_id: str | None
    status: Literal["uploaded", "draft", "confirmed"]
    original_name: str
    size_bytes: int
    created_at: datetime


class UploadResponse(ApiSchema):
    document_id: str
    status: Literal["uploaded"]
    original_name: str
    size_bytes: int
    created_at: datetime


class ConfirmResponse(ApiSchema):
    invoice_id: str
    status: Literal["confirmed"]


class ExtractedPageResponse(ApiSchema):
    document_id: str
    page_number: int
    extraction_method: Literal["pdf_text", "ocr"]
    extraction_version: int
    text: str


class TextExtractionResponse(ApiSchema):
    document_id: str
    version: int
    status: Literal["completed"]
    pages: list[ExtractedPageResponse]


class RequestValidationDetail(ApiSchema):
    loc: list[str | int]
    msg: str
    type: str


class RequestValidationError(ApiSchema):
    detail: list[RequestValidationDetail]
