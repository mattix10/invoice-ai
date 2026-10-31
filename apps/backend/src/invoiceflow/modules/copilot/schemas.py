from typing import Literal

from pydantic import ConfigDict, Field, field_validator

from invoiceflow.core.api_schema import ApiSchema
from invoiceflow.modules.invoices.schemas import EvidenceReference, InvoiceId, Money


class CopilotQuery(ApiSchema):
    model_config = ConfigDict(extra="forbid")
    question: str = Field(min_length=1, max_length=500)
    invoice_id: InvoiceId | None = None

    @field_validator("question", mode="before")
    @classmethod
    def trim_question(cls, value):
        return value.strip() if isinstance(value, str) else value


class InvestigationRequest(ApiSchema):
    model_config = ConfigDict(extra="forbid")
    reconciliation_revision: int | None = Field(default=None, gt=0)


class Finding(ApiSchema):
    description: str = Field(max_length=500)
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    net: Money
    vat: Money
    gross: Money
    evidence_ids: list[str] = Field(min_length=1, max_length=20)


class CopilotAnswer(ApiSchema):
    answer: str = Field(max_length=4000)
    citations: list[EvidenceReference] = Field(max_length=100)
    findings: list[Finding] = Field(max_length=20)
    suggested_questions: list[str] = Field(max_length=3)
    generation_mode: Literal["demo", "live", "disabled"]
    provider: str
    model: str | None
    prompt_version: str
    incomplete_context: bool
    human_review_required: bool
    unavailable_reason: str | None
