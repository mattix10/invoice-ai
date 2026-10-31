from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse

from invoiceflow.core.database import DatabaseSession
from invoiceflow.modules.intake.errors import IntakeError
from invoiceflow.modules.intake.schemas import (
    ConfirmRequest,
    ConfirmResponse,
    DocumentResponse,
    DraftRequest,
    DraftResponse,
    RequestValidationError,
    UploadResponse,
)
from invoiceflow.modules.intake.service import IntakeService, document_response
from invoiceflow.modules.invoices.schemas import ApiError

router = APIRouter(prefix="/api/v1/intake/documents", tags=["intake"])
errors = {code: {"model": ApiError} for code in (404, 409, 413, 415, 503)}
errors[422] = {"model": ApiError | RequestValidationError}


def get_service(request: Request, session: DatabaseSession) -> IntakeService:
    return IntakeService(session, request.app.state.settings.intake_storage_dir)


Service = Annotated[IntakeService, Depends(get_service)]


@router.post("", status_code=201, response_model=UploadResponse, responses=errors)
def upload_document(
    file: Annotated[UploadFile, File()],
    service: Service,
    allow_duplicate: Annotated[bool, Form()] = False,
):
    doc = service.upload(file, allow_duplicate)
    return {
        "document_id": doc.id,
        "status": doc.status,
        "original_name": doc.original_name,
        "size_bytes": doc.size_bytes,
        "created_at": doc.created_at,
    }


@router.get("/{document_id}", response_model=DocumentResponse, responses=errors)
def get_document(document_id: UUID, service: Service):
    return document_response(service.get(str(document_id)))


@router.get("/{document_id}/file", responses=errors)
def get_document_file(document_id: UUID, service: Service):
    doc = service.get(str(document_id))
    return FileResponse(
        service.file(doc),
        media_type="application/pdf",
        filename=doc.original_name,
        content_disposition_type="inline",
        headers={"X-Content-Type-Options": "nosniff"},
    )


@router.put("/{document_id}/draft", response_model=DraftResponse, responses=errors)
def save_draft(document_id: UUID, body: DraftRequest, service: Service):
    return service.save(str(document_id), body)


@router.post("/{document_id}/confirm", response_model=ConfirmResponse, responses=errors)
def confirm_document(document_id: UUID, body: ConfirmRequest, service: Service):
    return service.confirm(str(document_id), body.expected_revision)


def register_intake_handlers(app):
    @app.exception_handler(IntakeError)
    async def intake_error(request, exc):
        error = {"code": exc.code, "message": exc.message}
        if exc.current_revision is not None:
            error["current_revision"] = exc.current_revision
        if exc.existing_document_id is not None:
            error["existing_document_id"] = exc.existing_document_id
        return JSONResponse(status_code=exc.status, content={"error": error})
