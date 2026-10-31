"""Bound multipart bodies before Starlette spools file parts to disk."""

from fastapi.responses import JSONResponse

MAX_BODY = 10 * 1024 * 1024 + 64 * 1024


class BodyLimitExceeded(BaseException):
    pass


class IntakeBodyLimit:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if (
            scope["type"] != "http"
            or scope["method"] != "POST"
            or scope["path"] != "/api/v1/intake/documents"
        ):
            return await self.app(scope, receive, send)
        count = 0

        async def limited_receive():
            nonlocal count
            message = await receive()
            if message["type"] == "http.request":
                count += len(message.get("body", b""))
                if count > MAX_BODY:
                    raise BodyLimitExceeded
            return message

        try:
            await self.app(scope, limited_receive, send)
        except BodyLimitExceeded:
            response = JSONResponse(
                status_code=413,
                content={
                    "error": {
                        "code": "document_limit_exceeded",
                        "message": "Document exceeds size limit",
                    }
                },
            )
            await response(scope, receive, send)
