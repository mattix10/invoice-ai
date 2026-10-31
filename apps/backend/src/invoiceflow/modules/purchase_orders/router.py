import os

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy.engine import make_url

from invoiceflow.core.database import DatabaseSession
from invoiceflow.modules.invoices.router import Id
from invoiceflow.modules.invoices.schemas import ApiError
from invoiceflow.modules.purchase_orders.schemas import (
    LinkRead,
    LinkRequest,
    POFields,
    PORead,
    POUpdate,
    SnapshotRead,
)
from invoiceflow.modules.purchase_orders.service import (
    PurchaseOrderError,
    PurchaseOrderService,
    po_response,
)

router = APIRouter(prefix="/api/v1", tags=["purchase orders"])
errors = {code: {"model": ApiError} for code in (404, 409, 503)}


def require_local(request: Request):
    url = make_url(request.app.state.settings.database_url.get_secret_value())
    if os.environ.get("INVOICEFLOW_ENV") != "local" or url.host not in {
        "localhost",
        "127.0.0.1",
        "::1",
    }:
        raise PurchaseOrderError(
            403, "local_demo_required", "Purchase order editing requires local demo mode"
        )


@router.get("/purchase-orders", operation_id="listPurchaseOrders", responses=errors)
def list_purchase_orders(session: DatabaseSession) -> list[PORead]:
    return PurchaseOrderService(session).list()


@router.get("/purchase-orders/{po_id}", operation_id="getPurchaseOrder", responses=errors)
def get_purchase_order(po_id: str, session: DatabaseSession) -> PORead:
    return po_response(PurchaseOrderService(session).get(po_id))


@router.post(
    "/purchase-orders",
    status_code=201,
    operation_id="createPurchaseOrder",
    responses={**errors, 403: {"model": ApiError}},
)
def create_purchase_order(body: POFields, request: Request, session: DatabaseSession) -> PORead:
    require_local(request)
    return PurchaseOrderService(session).save(body)


@router.put(
    "/purchase-orders/{po_id}",
    operation_id="updatePurchaseOrder",
    responses={**errors, 403: {"model": ApiError}},
)
def update_purchase_order(
    po_id: str, body: POUpdate, request: Request, session: DatabaseSession
) -> PORead:
    require_local(request)
    return PurchaseOrderService(session).save(body, po_id)


@router.get(
    "/invoices/{invoice_id}/purchase-order-link",
    operation_id="getInvoicePurchaseOrderLink",
    responses=errors,
)
def get_link(invoice_id: Id, session: DatabaseSession) -> LinkRead:
    return PurchaseOrderService(session).get_link(invoice_id)


@router.put(
    "/invoices/{invoice_id}/purchase-order-link",
    operation_id="linkInvoicePurchaseOrder",
    responses=errors,
)
def put_link(invoice_id: Id, body: LinkRequest, session: DatabaseSession) -> LinkRead:
    return PurchaseOrderService(session).link(invoice_id, body)


@router.get(
    "/invoices/{invoice_id}/purchase-order-snapshots/{snapshot_id}",
    operation_id="getInvoicePurchaseOrderSnapshot",
    responses=errors,
)
def get_snapshot(invoice_id: Id, snapshot_id: str, session: DatabaseSession) -> SnapshotRead:
    return PurchaseOrderService(session).get_snapshot(invoice_id, snapshot_id)


def register_purchase_order_handlers(app):
    @app.exception_handler(PurchaseOrderError)
    async def handle_purchase_order_error(request, exc):
        return JSONResponse(
            status_code=exc.status, content={"error": {"code": exc.code, "message": exc.message}}
        )
