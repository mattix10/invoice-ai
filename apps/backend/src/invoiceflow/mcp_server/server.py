import json
from typing import Annotated

from mcp.server.mcpserver import MCPServer
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from invoiceflow.core.config import Settings
from invoiceflow.core.database import create_database_engine
from invoiceflow.modules.copilot.tools import ReadOnlyTools
from invoiceflow.modules.invoices.reconciliation import (
    ReconciliationNotFound,
    ReconciliationService,
)
from invoiceflow.modules.invoices.repository import InvoiceRepository
from invoiceflow.modules.invoices.schemas import (
    InvoiceDetail,
    InvoiceId,
    InvoicePage,
    InvoiceStatus,
    ReconciliationRead,
)
from invoiceflow.modules.invoices.service import InvoiceNotFound, InvoiceService

server = MCPServer("InvoiceFlow", instructions="Local read-only invoice data; no authentication.")


class ToolError(BaseModel):
    code: str
    message: str


class SearchPage(InvoicePage):
    incomplete: bool


class SearchResponse(BaseModel):
    data: SearchPage | None = None
    error: ToolError | None = None


class InvoiceResponse(BaseModel):
    data: InvoiceDetail | None = None
    error: ToolError | None = None


class EvidenceResponse(BaseModel):
    data: ReconciliationRead | None = None
    error: ToolError | None = None


def invoke(operation, *args, **kwargs):
    engine = None
    try:
        settings = Settings(_env_file=None)
        if make_url(settings.database_url.get_secret_value()).host not in {
            "localhost",
            "127.0.0.1",
            "::1",
        }:
            return {"error": {"code": "unavailable", "message": "Local database required"}}
        engine = create_database_engine(settings)
        with Session(engine) as session:
            session.execute(text("SET TRANSACTION READ ONLY"))
            session.execute(text("SET LOCAL statement_timeout = '5s'"))
            repository = InvoiceRepository(session)
            tools = ReadOnlyTools(InvoiceService(repository), ReconciliationService(repository))
            result = getattr(tools, operation)(*args, **kwargs)
            data = result.model_dump(mode="json")
            if len(json.dumps(data, ensure_ascii=False)) > 100_000:
                return {"error": {"code": "result_too_large", "message": "Result exceeds limit"}}
            if operation == "search_invoices":
                data["incomplete"] = data["page"] * data["page_size"] < data["total"]
            return {"data": data}
    except InvoiceNotFound:
        return {"error": {"code": "invoice_not_found", "message": "Invoice not found"}}
    except ReconciliationNotFound:
        return {
            "error": {"code": "reconciliation_not_found", "message": "Reconciliation not found"}
        }
    except ValidationError:
        return {"error": {"code": "invalid_arguments", "message": "Invalid arguments"}}
    except (SQLAlchemyError, ValueError):
        return {"error": {"code": "unavailable", "message": "Data unavailable"}}
    finally:
        if engine is not None:
            engine.dispose()


@server.tool(structured_output=True)
def search_invoices(
    status: InvoiceStatus | None = None,
    q: Annotated[str | None, Field(min_length=1, max_length=100)] = None,
    page: Annotated[int, Field(ge=1, le=2147483647, strict=True)] = 1,
    page_size: Annotated[int, Field(ge=1, le=20, strict=True)] = 20,
) -> SearchResponse:
    """Search invoices with bounded paging."""
    return SearchResponse.model_validate(
        invoke("search_invoices", status=status, q=q, page=page, page_size=page_size)
    )


@server.tool(structured_output=True)
def get_invoice(invoice_id: InvoiceId) -> InvoiceResponse:
    """Read an invoice."""
    return InvoiceResponse.model_validate(invoke("get_invoice_details", invoice_id=invoice_id))


@server.tool(structured_output=True)
def get_reconciliation_evidence(
    invoice_id: InvoiceId,
    revision: Annotated[int | None, Field(ge=1, le=2147483647, strict=True)] = None,
    require_current: bool = False,
) -> EvidenceResponse:
    """Read completed evidence; currentness is observed at read time."""
    result = invoke("get_reconciliation_evidence", invoice_id=invoice_id, revision=revision)
    if require_current and "data" in result and not result["data"]["is_current"]:
        return EvidenceResponse.model_validate(
            {"error": {"code": "reconciliation_stale", "message": "Current evidence unavailable"}}
        )
    return EvidenceResponse.model_validate(result)
