import hmac
import re
from typing import Annotated

from fastapi import APIRouter, Header, Request
from fastapi.responses import JSONResponse

from invoiceflow.core.database import DatabaseSession
from invoiceflow.modules.copilot.cloudflare import CloudflareProvider
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
LocalSecretHeader = Annotated[
    str | None,
    Header(
        alias="X-InvoiceFlow-Local-Secret",
        description="Required only for local Cloudflare inference",
    ),
]


def service(request, session):
    settings = request.app.state.settings
    provider = None
    if settings.ai_provider == "cloudflare":
        secret = settings.cloudflare_local_secret
        token = settings.cloudflare_api_token
        supplied = request.headers.getlist("x-invoiceflow-local-secret")
        secret_value = secret.get_secret_value() if secret else ""
        if (
            not settings.cloudflare_local_enabled
            or not re.fullmatch(r"[0-9a-f]{64}", secret_value)
            or (
                token is not None
                and hmac.compare_digest(secret_value.encode(), token.get_secret_value().encode())
            )
            or len(supplied) != 1
            or not re.fullmatch(r"[0-9a-f]{64}", supplied[0])
            or not hmac.compare_digest(secret_value, supplied[0])
        ):
            raise CopilotUnavailable("ai_unavailable")
        if not token or not token.get_secret_value():
            raise CopilotUnavailable("missing_configuration")
        provider = CloudflareProvider(
            settings.cloudflare_account_id,
            token.get_secret_value(),
            settings.cloudflare_ai_model,
            timeout=settings.cloudflare_timeout_seconds,
        )
    repo = InvoiceRepository(session)
    return CopilotService(
        ReadOnlyTools(InvoiceService(repo), ReconciliationService(repo)),
        repo,
        settings.ai_provider,
        cloudflare_provider=provider,
    )


@router.post("/copilot/queries", operation_id="queryCopilot", responses=responses)
def query_copilot(
    body: CopilotQuery,
    request: Request,
    session: DatabaseSession,
    local_secret: LocalSecretHeader = None,
) -> CopilotAnswer:
    return service(request, session).query(body.question, body.invoice_id)


@router.post(
    "/invoices/{invoice_id}/investigations", operation_id="investigateInvoice", responses=responses
)
def investigate_invoice(
    invoice_id: Id,
    body: InvestigationRequest,
    request: Request,
    session: DatabaseSession,
    local_secret: LocalSecretHeader = None,
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
