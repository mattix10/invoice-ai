import json
from http.client import IncompleteRead
from urllib.error import HTTPError, URLError

import pytest

from invoiceflow.modules.copilot.cloudflare import (
    MODEL,
    CloudflareProvider,
    CloudflareProviderError,
)


def test_sends_bounded_request_and_returns_cloudflare_result():
    calls = []

    def transport(request, timeout):
        calls.append((request, timeout))
        return json.dumps({"success": True, "result": {"tool_calls": []}}).encode()

    provider = CloudflareProvider("account123", "secret", MODEL, transport=transport)
    result = provider.complete([{"role": "user", "content": "hello"}], [{"name": "search"}])
    request, timeout = calls[0]
    assert result == {"tool_calls": []}
    assert (
        request.full_url
        == f"https://api.cloudflare.com/client/v4/accounts/account123/ai/run/{MODEL}"
    )
    assert request.get_header("Authorization") == "Bearer secret"
    assert timeout == 20
    assert json.loads(request.data) == {
        "messages": [{"role": "user", "content": "hello"}],
        "tools": [{"name": "search"}],
        "max_tokens": 512,
        "stream": False,
    }


@pytest.mark.parametrize(
    "status, code",
    [(401, "authentication"), (403, "authentication"), (429, "quota"), (500, "upstream_error")],
)
def test_http_errors_are_typed_and_redacted(status, code):
    def transport(request, timeout):
        raise HTTPError(request.full_url, status, "secret payload", {}, None)

    with pytest.raises(CloudflareProviderError) as error:
        CloudflareProvider("account", "secret", MODEL, transport=transport).complete([])
    assert error.value.code == code
    assert "secret" not in str(error.value)


@pytest.mark.parametrize(
    "exception, code",
    [
        (TimeoutError(), "timeout"),
        (URLError(TimeoutError()), "timeout"),
        (URLError("sensitive"), "upstream_error"),
    ],
)
def test_transport_errors_are_typed(exception, code):
    def transport(request, timeout):
        raise exception

    with pytest.raises(CloudflareProviderError) as error:
        CloudflareProvider("account", "secret", MODEL, transport=transport).complete([])
    assert error.value.code == code


@pytest.mark.parametrize(
    "body, code",
    [
        (b"bad", "invalid_json"),
        (b"{}", "upstream_error"),
        (b'{"success":true,"result":[]}', "invalid_response"),
        (b"x" * 101, "invalid_response"),
    ],
)
def test_invalid_responses_fail_closed(body, code):
    provider = CloudflareProvider(
        "account", "secret", MODEL, max_response_bytes=100, transport=lambda *_: body
    )
    with pytest.raises(CloudflareProviderError) as error:
        provider.complete([])
    assert error.value.code == code


@pytest.mark.parametrize(
    "account, token, model, code",
    [
        (None, "token", MODEL, "missing_configuration"),
        ("../path", "token", MODEL, "missing_configuration"),
        ("account", "token", "other", "unsupported_model"),
    ],
)
def test_invalid_configuration_never_calls_transport(account, token, model, code):
    def transport(*_):
        pytest.fail("Unexpected external call")

    with pytest.raises(CloudflareProviderError) as error:
        CloudflareProvider(account, token, model, transport=transport).complete([])
    assert error.value.code == code


def test_native_function_call_payload_and_response():
    tool = {
        "name": "get_invoice_details",
        "description": "Read an invoice",
        "parameters": {
            "type": "object",
            "properties": {"invoice_id": {"type": "string"}},
            "required": ["invoice_id"],
        },
    }
    call = {"name": "get_invoice_details", "arguments": {"invoice_id": "INV-2026-1042"}}
    seen = []

    def transport(request, timeout):
        seen.append(json.loads(request.data))
        return json.dumps(
            {"success": True, "errors": [], "messages": [], "result": {"tool_calls": [call]}}
        ).encode()

    result = CloudflareProvider("account", "token", MODEL, transport=transport).complete(
        [{"role": "user", "content": "Show invoice INV-2026-1042"}], [tool]
    )
    assert seen[0]["tools"] == [tool]
    assert result["tool_calls"] == [call]


def test_incomplete_http_response_fails_as_upstream_error():
    def transport(request, timeout):
        raise IncompleteRead(b"sensitive response", 100)

    with pytest.raises(CloudflareProviderError) as error:
        CloudflareProvider("account", "secret", MODEL, transport=transport).complete([])
    assert error.value.code == "upstream_error"
    assert "sensitive response" not in str(error.value)


def test_child_deadline_kills_and_reaps_real_process(monkeypatch):
    import subprocess
    import sys

    from invoiceflow.modules.copilot.cloudflare import _run_child

    processes = []
    original = subprocess.Popen

    def capture_process(*args, **kwargs):
        process = original(*args, **kwargs)
        processes.append(process)
        return process

    monkeypatch.setattr(subprocess, "Popen", capture_process)
    with pytest.raises(CloudflareProviderError) as error:
        _run_child([sys.executable, "-c", "import time; time.sleep(30)"], b"secret", 0.3)
    assert error.value.code == "timeout"
    assert processes[0].poll() is not None
    assert "secret" not in str(error.value)


def test_real_child_uses_stdin_credentials_and_bounds_response(monkeypatch):
    import base64
    import sys

    from invoiceflow.modules.copilot.cloudflare import _run_child

    monkeypatch.setenv("CLOUDFLARE_API_TOKEN", "environment-secret")
    monkeypatch.setenv("CLOUDFLARE_LOCAL_SECRET", "local-secret")
    script = """
import os
from invoiceflow.modules.copilot import cloudflare_child as child
assert 'CLOUDFLARE_API_TOKEN' not in os.environ
assert 'CLOUDFLARE_LOCAL_SECRET' not in os.environ
class Response:
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def read(self, limit): return b'x' * limit
class Opener:
    def open(self, request, timeout):
        assert request.get_header('Authorization') == 'Bearer stdin-secret'
        return Response()
child.build_opener = lambda *_: Opener()
child.main()
"""
    payload = json.dumps(
        {
            "url": "https://api.cloudflare.com/",
            "authorization": "Bearer stdin-secret",
            "body": base64.b64encode(b"{}").decode(),
            "timeout": 5,
            "max_response_bytes": 32,
        }
    ).encode()
    output = _run_child([sys.executable, "-c", script], payload, 5)
    assert json.loads(output) == {"error": "invalid_response"}


@pytest.mark.parametrize("body", [b"[" * 20000 + b"0" + b"]" * 20000, b"1" * 5000])
def test_pathological_json_fails_as_invalid_json(body):
    provider = CloudflareProvider("account", "secret", MODEL, transport=lambda *_: body)
    with pytest.raises(CloudflareProviderError) as error:
        provider.complete([])
    assert error.value.code == "invalid_json"
