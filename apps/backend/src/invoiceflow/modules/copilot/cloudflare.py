import base64
import binascii
import json
import os
import re
import socket
import subprocess
import sys
from collections.abc import Callable
from contextlib import suppress
from http.client import HTTPException
from urllib.error import HTTPError, URLError
from urllib.request import Request

MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast"


class CloudflareProviderError(Exception):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def _run_child(command: list[str], payload: bytes, timeout: float) -> bytes:
    env = {
        key: value
        for key, value in os.environ.items()
        if key.upper() not in {"CLOUDFLARE_API_TOKEN", "CLOUDFLARE_LOCAL_SECRET"}
    }
    process = subprocess.Popen(
        command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, env=env
    )
    try:
        output, _ = process.communicate(input=payload, timeout=timeout)
    except subprocess.TimeoutExpired:
        if process.poll() is None:
            with suppress(ProcessLookupError):
                process.kill()
        process.communicate()
        raise CloudflareProviderError("timeout") from None
    except BaseException:
        if process.poll() is None:
            with suppress(ProcessLookupError):
                process.kill()
        process.communicate()
        raise
    if process.returncode != 0:
        raise CloudflareProviderError("upstream_error")
    return output


class CloudflareProvider:
    def __init__(
        self,
        account_id: str | None,
        api_token: str | None,
        model: str,
        *,
        timeout: float = 20,
        max_response_bytes: int = 65536,
        transport: Callable[[Request, float], bytes] | None = None,
    ):
        self._account_id = account_id
        self._api_token = api_token
        self.model = model
        if not 0 < timeout <= 60 or not 0 < max_response_bytes <= 1048576:
            raise ValueError("Invalid Cloudflare HTTP limits")
        self._timeout = timeout
        self._max_response_bytes = max_response_bytes
        self._transport = transport or self._send

    def _send(self, request: Request, timeout: float) -> bytes:
        payload = json.dumps(
            {
                "url": request.full_url,
                "authorization": request.get_header("Authorization"),
                "body": base64.b64encode(request.data).decode("ascii"),
                "timeout": timeout,
                "max_response_bytes": self._max_response_bytes,
            }
        ).encode("utf-8")
        raw = _run_child(
            [sys.executable, "-m", "invoiceflow.modules.copilot.cloudflare_child"], payload, timeout
        )
        try:
            result = json.loads(raw)
            if not isinstance(result, dict):
                raise ValueError
            code = result.get("error")
            if code in {"timeout", "authentication", "quota", "upstream_error", "invalid_response"}:
                raise CloudflareProviderError(code)
            return base64.b64decode(result["body"], validate=True)
        except (ValueError, KeyError, TypeError, binascii.Error, RecursionError):
            raise CloudflareProviderError("upstream_error") from None

    def complete(
        self,
        messages: list[dict],
        tools: list[dict] | None = None,
        *,
        response_format: dict | None = None,
    ) -> dict:
        if not self._account_id or not self._api_token:
            raise CloudflareProviderError("missing_configuration")
        if not re.fullmatch(r"[a-zA-Z0-9]{1,128}", self._account_id):
            raise CloudflareProviderError("missing_configuration")
        if self.model != MODEL:
            raise CloudflareProviderError("unsupported_model")
        payload = {"messages": messages, "max_tokens": 512, "stream": False}
        if tools is not None:
            payload["tools"] = tools
        if response_format is not None:
            payload["response_format"] = response_format
        request = Request(
            f"https://api.cloudflare.com/client/v4/accounts/{self._account_id}/ai/run/{MODEL}",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self._api_token}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            body = self._transport(request, self._timeout)
        except HTTPError as exc:
            code = (
                "authentication"
                if exc.code in (401, 403)
                else "quota"
                if exc.code == 429
                else "upstream_error"
            )
            raise CloudflareProviderError(code) from None
        except TimeoutError:
            raise CloudflareProviderError("timeout") from None
        except URLError as exc:
            code = (
                "timeout"
                if isinstance(exc.reason, (TimeoutError, socket.timeout))
                else "upstream_error"
            )
            raise CloudflareProviderError(code) from None
        except (OSError, HTTPException):
            raise CloudflareProviderError("upstream_error") from None
        if not isinstance(body, bytes) or len(body) > self._max_response_bytes:
            raise CloudflareProviderError("invalid_response")
        try:
            envelope = json.loads(body)
        except (UnicodeDecodeError, ValueError, RecursionError):
            raise CloudflareProviderError("invalid_json") from None
        if not isinstance(envelope, dict) or envelope.get("success") is not True:
            raise CloudflareProviderError("upstream_error")
        result = envelope.get("result")
        if not isinstance(result, dict):
            raise CloudflareProviderError("invalid_response")
        return result
