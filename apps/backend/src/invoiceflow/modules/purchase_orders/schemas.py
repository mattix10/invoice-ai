from typing import Annotated, Literal

from pydantic import ConfigDict, Field, StringConstraints, model_validator

from invoiceflow.core.api_schema import ApiSchema

Text64 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]
Text255 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
Amount = Annotated[str, StringConstraints(pattern=r"^\d{1,16}\.\d{2}$")]
Rate = Annotated[str, StringConstraints(pattern=r"^(?:0(?:\.\d{1,4})?|1(?:\.0{1,4})?)$")]


class POItem(ApiSchema):
    model_config = ConfigDict(extra="forbid")
    position: int = Field(gt=0, strict=True)
    description: Text255
    quantity: int = Field(gt=0, strict=True)
    unit_net: Amount


class POFields(ApiSchema):
    model_config = ConfigDict(extra="forbid")
    external_reference: Text64
    supplier: Text255
    currency: Annotated[str, StringConstraints(pattern=r"^[A-Z]{3}$")]
    vat_rate: Rate
    items: list[POItem] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def unique_positions(self):
        if len({item.position for item in self.items}) != len(self.items):
            raise ValueError("Duplicate PO position")
        return self


class POUpdate(POFields):
    expected_version: int = Field(gt=0, strict=True)


class PORead(POFields):
    id: str
    version: int
    source_type: Literal["existing", "human_entered_demo"]


class Mapping(ApiSchema):
    model_config = ConfigDict(extra="forbid")
    invoice_line_position: int = Field(gt=0, strict=True)
    po_line_position: int = Field(gt=0, strict=True)


class LinkRequest(ApiSchema):
    model_config = ConfigDict(extra="forbid")
    po_id: str = Field(min_length=1, max_length=36)
    po_version: int = Field(gt=0, strict=True)
    expected_link_revision: int = Field(ge=0, strict=True)
    mappings: list[Mapping] = Field(min_length=1, max_length=100)


class LinkRead(ApiSchema):
    status: Literal["linked"] = "linked"
    po_id: str
    po_version: int
    revision: int
    snapshot_id: str
    source_changed: bool
    provenance: Literal["existing", "human_entered_demo"]
    mappings: list[Mapping]


class SnapshotLine(ApiSchema):
    invoice_line_position: int
    po_line_position: int
    quantity: int
    unit_net: Amount


class SnapshotRead(ApiSchema):
    snapshot_id: str
    invoice_id: str
    po_id: str | None
    po_version: int | None
    purchase_order: str
    delivery_receipt_id: str | None
    currency: str
    vat_rate: str
    items: list[SnapshotLine]
