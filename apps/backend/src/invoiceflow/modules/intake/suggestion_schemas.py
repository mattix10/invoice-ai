import re
from datetime import date
from typing import Literal

from pydantic import ConfigDict, Field, model_validator

from invoiceflow.core.api_schema import ApiSchema
from invoiceflow.modules.intake.schemas import DeclaredTotals, DraftItem


class SuggestionSource(ApiSchema):
    model_config = ConfigDict(extra="forbid")
    page_number: int = Field(gt=0)
    start: int = Field(ge=0)
    end: int = Field(gt=0)
    excerpt: str = Field(min_length=1)
    extraction_method: Literal["pdf_text", "ocr"]
    extraction_version: int = Field(gt=0)

    @model_validator(mode="after")
    def valid_span(self):
        if self.end <= self.start or self.end - self.start != len(self.excerpt):
            raise ValueError("Invalid evidence span")
        return self


class FieldProposal(ApiSchema):
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
    value: str | list[DraftItem] | DeclaredTotals | None
    source: SuggestionSource
    warnings: list[str]

    @model_validator(mode="after")
    def valid_value(self):
        value = self.value
        if value is None:
            return self
        if self.field == "items":
            if not isinstance(value, list) or not value:
                raise ValueError("Invalid items")
            if len({item.position for item in value}) != len(value):
                raise ValueError("Duplicate item positions")
            if any(
                None in (item.position, item.name, item.quantity, item.unit_net) for item in value
            ):
                raise ValueError("Incomplete item")
            return self
        if self.field == "declaredTotals":
            if not isinstance(value, DeclaredTotals):
                raise ValueError("Invalid declared totals")
            return self
        if not isinstance(value, str) or not value.strip() or len(value) > 255:
            raise ValueError("Invalid proposal value")
        if self.field in ("issued", "due"):
            try:
                if date.fromisoformat(value).isoformat() != value:
                    raise ValueError("Invalid date")
            except ValueError:
                raise ValueError("Invalid date") from None
        if self.field == "currency" and not re.fullmatch(r"[A-Z]{3}", value):
            raise ValueError("Invalid currency")
        if self.field == "vatRate" and not re.fullmatch(r"0(?:\.\d{1,4})?|1(?:\.0{1,4})?", value):
            raise ValueError("Invalid VAT rate")
        return self


class SuggestionsResponse(ApiSchema):
    model_config = ConfigDict(extra="forbid")
    document_id: str
    version: int = Field(gt=0)
    status: Literal["completed"]
    proposals: list[FieldProposal]
    warnings: list[str]
