from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from invoiceflow.core.database import DatabaseSession
from invoiceflow.modules.invoices.repository import InvoiceRepository
from invoiceflow.modules.invoices.schemas import (
    ApiError,
    InvoiceComparison,
    InvoiceDetail,
    InvoicePage,
    InvoiceQuery,
)
from invoiceflow.modules.invoices.service import ComparisonNotFound, InvoiceNotFound, InvoiceService

router = APIRouter(prefix="/api/v1/invoices", tags=["invoices"])
errors = {
    404: {"model": ApiError, "description": "Invoice or comparison not found"},
    500: {"model": ApiError, "description": "Internal error"},
    503: {"model": ApiError, "description": "Database unavailable"},
}


def get_service(session: DatabaseSession) -> InvoiceService:
    return InvoiceService(InvoiceRepository(session))


Service = Annotated[InvoiceService, Depends(get_service)]
Id = Annotated[str, Path(max_length=64, pattern=r"^INV-\d{4}-\d{4,}$")]


@router.get(
    "", operation_id="listInvoices", responses={k: v for k, v in errors.items() if k != 404}
)
def list_invoices(query: Annotated[InvoiceQuery, Query()], service: Service) -> InvoicePage:
    return service.list(query)


@router.get("/{invoice_id}", operation_id="getInvoice", responses=errors)
def get_invoice(invoice_id: Id, service: Service) -> InvoiceDetail:
    return service.get_invoice(invoice_id)


@router.get("/{invoice_id}/comparison", operation_id="getInvoiceComparison", responses=errors)
def get_comparison(invoice_id: Id, service: Service) -> InvoiceComparison:
    return service.get_comparison(invoice_id)


def register_exception_handlers(app):
    @app.exception_handler(InvoiceNotFound)
    async def invoice_not_found(request, exc):
        return JSONResponse(
            status_code=404,
            content={"error": {"code": "invoice_not_found", "message": "Invoice not found"}},
        )

    @app.exception_handler(ComparisonNotFound)
    async def comparison_not_found(request, exc):
        return JSONResponse(
            status_code=404,
            content={"error": {"code": "comparison_not_found", "message": "Comparison not found"}},
        )

    @app.exception_handler(SQLAlchemyError)
    async def database_error(request, exc):
        return JSONResponse(
            status_code=503,
            content={"error": {"code": "database_unavailable", "message": "Database unavailable"}},
        )

    @app.exception_handler(Exception)
    async def internal_error(request, exc):
        return JSONResponse(
            status_code=500,
            content={"error": {"code": "internal_error", "message": "Internal error"}},
        )
