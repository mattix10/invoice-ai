from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

MoneyInput = Annotated[str, StringConstraints(pattern=r"^\d{1,16}\.\d{2}$")]
VatInput = Annotated[str, StringConstraints(pattern=r"^(0(?:\.\d{1,4})?|1(?:\.0{1,4})?)$")]


class NullableDraftModel(BaseModel):
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


class DraftRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_revision: int = Field(ge=0, strict=True)
    draft: Draft


class ConfirmRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_revision: int = Field(ge=0, strict=True)


class Validation(BaseModel):
    complete: bool
    errors: list[str]


class DraftResponse(BaseModel):
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


class UploadResponse(BaseModel):
    document_id: str
    status: Literal["uploaded"]
    original_name: str
    size_bytes: int
    created_at: datetime


class ConfirmResponse(BaseModel):
    invoice_id: str
    status: Literal["confirmed"]


class RequestValidationDetail(BaseModel):
    loc: list[str | int]
    msg: str
    type: str


class RequestValidationError(BaseModel):
    detail: list[RequestValidationDetail]
