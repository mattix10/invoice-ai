from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy.orm import sessionmaker

from invoiceflow.core.config import Settings
from invoiceflow.core.database import create_database_engine
from invoiceflow.health import router as health_router
from invoiceflow.modules.intake.request_limit import IntakeBodyLimit
from invoiceflow.modules.intake.router import register_intake_handlers
from invoiceflow.modules.intake.router import router as intake_router
from invoiceflow.modules.invoices.router import register_exception_handlers
from invoiceflow.modules.invoices.router import router as invoices_router
from invoiceflow.modules.purchase_orders.router import register_purchase_order_handlers
from invoiceflow.modules.purchase_orders.router import router as purchase_orders_router


def create_app(settings: Settings | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        configured_settings = settings if settings is not None else Settings()
        app.state.settings = configured_settings
        engine = create_database_engine(configured_settings)
        app.state.session_factory = sessionmaker(engine, expire_on_commit=False)
        try:
            yield
        finally:
            engine.dispose()

    app = FastAPI(title="InvoiceFlow API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(IntakeBodyLimit)
    app.include_router(health_router)
    app.include_router(invoices_router)
    app.include_router(intake_router)
    app.include_router(purchase_orders_router)
    register_purchase_order_handlers(app)
    register_intake_handlers(app)
    register_exception_handlers(app)
    return app


app = create_app()
