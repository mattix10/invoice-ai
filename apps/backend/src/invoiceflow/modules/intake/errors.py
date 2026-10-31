class IntakeError(Exception):
    def __init__(
        self,
        status: int,
        code: str,
        message: str,
        current_revision: int | None = None,
        existing_document_id: str | None = None,
    ):
        self.status = status
        self.code = code
        self.message = message
        self.current_revision = current_revision
        self.existing_document_id = existing_document_id
