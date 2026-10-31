from typing import Literal

from fastapi import APIRouter, Response, status
from pydantic import BaseModel

from invoiceflow.core.database import DatabaseSession, database_is_ready

router = APIRouter(prefix="/health", tags=["health"])


class HealthResponse(BaseModel):
    status: Literal["ok", "unavailable"]


@router.get("", operation_id="getHealth")
def health() -> HealthResponse:
    return HealthResponse(status="ok")


@router.get(
    "/ready",
    operation_id="getReadiness",
    responses={503: {"model": HealthResponse, "description": "Database unavailable"}},
)
def readiness(session: DatabaseSession, response: Response) -> HealthResponse:
    if not database_is_ready(session):
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return HealthResponse(status="unavailable")
    return HealthResponse(status="ok")
