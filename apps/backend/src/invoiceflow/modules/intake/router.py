from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response

from invoiceflow.core.database import DatabaseSession
from invoiceflow.modules.intake.errors import IntakeError
from invoiceflow.modules.intake.extraction_service import ExtractionService
from invoiceflow.modules.intake.schemas import (
    ConfirmRequest,
    ConfirmResponse,
    DocumentResponse,
    DraftRequest,
    DraftResponse,
    RequestValidationError,
    TextExtractionResponse,
    UploadResponse,
)
from invoiceflow.modules.intake.service import IntakeService, document_response
from invoiceflow.modules.intake.suggestion_schemas import SuggestionsResponse
from invoiceflow.modules.intake.suggestion_service import SuggestionService
from invoiceflow.modules.invoices.schemas import ApiError

router = APIRouter(prefix="/api/v1/intake/documents", tags=["intake"])
errors = {code: {"model": ApiError} for code in (404, 409, 413, 415, 503)}
errors[422] = {"model": ApiError | RequestValidationError}


def get_service(request: Request, session: DatabaseSession) -> IntakeService:
    settings = request.app.state.settings
    return IntakeService(session, settings.intake_storage_dir, settings.intake_ocr_spool_dir)


Service = Annotated[IntakeService, Depends(get_service)]


def get_extraction_service(request: Request, session: DatabaseSession) -> ExtractionService:
    settings = request.app.state.settings
    return ExtractionService(session, settings.intake_storage_dir, settings.intake_ocr_spool_dir)


Extraction = Annotated[ExtractionService, Depends(get_extraction_service)]


def get_suggestion_service(request: Request, session: DatabaseSession) -> SuggestionService:
    settings = request.app.state.settings
    return SuggestionService(session, settings.intake_storage_dir, settings.ai_provider)


Suggestions = Annotated[SuggestionService, Depends(get_suggestion_service)]


@router.post("", status_code=201, response_model=UploadResponse, responses=errors)
def upload_document(
    file: Annotated[UploadFile, File()],
    service: Service,
    allow_duplicate: Annotated[bool, Form(alias="allowDuplicate")] = False,
):
    doc = service.upload(file, allow_duplicate)
    return {
        "document_id": doc.id,
        "status": doc.status,
        "original_name": doc.original_name,
        "size_bytes": doc.size_bytes,
        "created_at": doc.created_at,
    }


@router.get("/by-invoice/{invoice_id}/preview", response_class=Response, responses=errors)
def get_invoice_document_preview(invoice_id: str, service: Service):
    doc = service.get_by_invoice(invoice_id)
    return Response(
        service.preview(doc),
        media_type="image/jpeg",
        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store"},
    )


@router.get("/{document_id}", response_model=DocumentResponse, responses=errors)
def get_document(document_id: UUID, service: Service):
    return document_response(service.get(str(document_id)))


@router.get("/{document_id}/file", responses=errors)
def get_document_file(document_id: UUID, service: Service):
    doc = service.get(str(document_id))
    path = service.file(doc)
    media_type = {".pdf": "application/pdf", ".jpeg": "image/jpeg", ".png": "image/png"}.get(
        path.suffix, "application/octet-stream"
    )
    return FileResponse(
        path,
        media_type=media_type,
        filename=doc.original_name,
        content_disposition_type="inline",
        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store"},
    )


@router.get(
    "/{document_id}/preview",
    responses={
        **errors,
        200: {"content": {"image/jpeg": {"schema": {"type": "string", "format": "binary"}}}},
    },
    response_class=Response,
)
def get_document_preview(document_id: UUID, service: Service):
    doc = service.get(str(document_id))
    return Response(
        service.preview(doc),
        media_type="image/jpeg",
        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store"},
    )


@router.post(
    "/{document_id}/text-extractions", response_model=TextExtractionResponse, responses=errors
)
def extract_document_text(document_id: UUID, service: Extraction):
    return service.start(str(document_id))


@router.get(
    "/{document_id}/text-extractions/latest",
    response_model=TextExtractionResponse,
    responses=errors,
)
def get_latest_text_extraction(document_id: UUID, service: Extraction):
    return service.latest(str(document_id))


@router.post("/{document_id}/suggestions", response_model=SuggestionsResponse, responses=errors)
def create_suggestions(document_id: UUID, service: Suggestions):
    return service.start(str(document_id))


@router.get(
    "/{document_id}/suggestions/latest", response_model=SuggestionsResponse, responses=errors
)
def get_latest_suggestions(document_id: UUID, service: Suggestions):
    return service.latest(str(document_id))


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
            error["currentRevision"] = exc.current_revision
        if exc.existing_document_id is not None:
            error["existingDocumentId"] = exc.existing_document_id
        return JSONResponse(status_code=exc.status, content={"error": error})
