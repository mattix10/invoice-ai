from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from invoiceflow.core.database import DatabaseSession
from invoiceflow.modules.copilot.schemas import CopilotAnswer, CopilotQuery, InvestigationRequest
from invoiceflow.modules.copilot.service import CopilotService, CopilotUnavailable
from invoiceflow.modules.copilot.tools import ReadOnlyTools
from invoiceflow.modules.invoices.reconciliation import ReconciliationService
from invoiceflow.modules.invoices.repository import InvoiceRepository
from invoiceflow.modules.invoices.router import Id, errors
from invoiceflow.modules.invoices.schemas import ApiError
from invoiceflow.modules.invoices.service import InvoiceService

router = APIRouter(prefix="/api/v1", tags=["copilot"])
responses = {**errors, 409: {"model": ApiError, "description": "Current reconciliation required"}}


def service(request, session):
    repo = InvoiceRepository(session)
    return CopilotService(
        ReadOnlyTools(InvoiceService(repo), ReconciliationService(repo)),
        repo,
        request.app.state.settings.ai_provider,
    )


@router.post("/copilot/queries", operation_id="queryCopilot", responses=responses)
def query_copilot(body: CopilotQuery, request: Request, session: DatabaseSession) -> CopilotAnswer:
    return service(request, session).query(body.question, body.invoice_id)


@router.post(
    "/invoices/{invoice_id}/investigations", operation_id="investigateInvoice", responses=responses
)
def investigate_invoice(
    invoice_id: Id, body: InvestigationRequest, request: Request, session: DatabaseSession
) -> CopilotAnswer:
    return service(request, session).investigate(invoice_id, body.reconciliation_revision)


def register_copilot_handlers(app):
    @app.exception_handler(CopilotUnavailable)
    async def unavailable(request, exc):
        status = 409 if exc.code.startswith("reconciliation_") else 503
        return JSONResponse(
            status_code=status,
            content={
                "error": {
                    "code": exc.code,
                    "message": "Requested evidence or provider is unavailable",
                }
            },
        )
