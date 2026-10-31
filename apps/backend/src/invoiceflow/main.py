from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy.orm import sessionmaker

from invoiceflow.core.config import Settings
from invoiceflow.core.database import create_database_engine
from invoiceflow.health import router as health_router
from invoiceflow.modules.invoices.router import register_exception_handlers
from invoiceflow.modules.invoices.router import router as invoices_router


def create_app(settings: Settings | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        configured_settings = settings if settings is not None else Settings()
        engine = create_database_engine(configured_settings)
        app.state.session_factory = sessionmaker(engine, expire_on_commit=False)
        try:
            yield
        finally:
            engine.dispose()

    app = FastAPI(title="InvoiceFlow API", version="0.1.0", lifespan=lifespan)
    app.include_router(health_router)
    app.include_router(invoices_router)
    register_exception_handlers(app)
    return app


app = create_app()
