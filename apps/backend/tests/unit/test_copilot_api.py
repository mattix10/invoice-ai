import pytest
from pydantic import SecretStr


@pytest.mark.parametrize(
    "body",
    [
        {"question": ""},
        {"question": "   "},
        {"question": "x" * 501},
        {"question": "hello", "invoiceId": "bad"},
        {"question": "hello", "extra": True},
    ],
)
def test_copilot_rejects_invalid_requests(client, body):
    assert client.post("/api/v1/copilot/queries", json=body).status_code == 422


@pytest.mark.parametrize(
    "body",
    [
        {"reconciliationRevision": 0},
        {"reconciliationRevision": -1},
        {"unexpected": True},
    ],
)
def test_investigation_rejects_invalid_requests(client, body):
    response = client.post("/api/v1/invoices/INV-2026-1042/investigations", json=body)
    assert response.status_code == 422


def test_copilot_openapi_documents_implemented_endpoints(client):
    paths = client.get("/openapi.json").json()["paths"]
    for path in ("/api/v1/copilot/queries", "/api/v1/invoices/{invoice_id}/investigations"):
        assert {"200", "404", "409", "422", "503"} <= paths[path]["post"]["responses"].keys()


def test_disabled_provider_returns_unavailable_not_demo(client):
    client.app.state.settings.ai_provider = "disabled"
    response = client.post("/api/v1/copilot/queries", json={"question": "Show invoices"})
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "ai_disabled"


@pytest.mark.parametrize(
    "path, body",
    [
        ("/api/v1/copilot/queries", {"question": "hello"}),
        ("/api/v1/invoices/INV-2026-1042/investigations", {}),
    ],
)
@pytest.mark.parametrize(
    "case",
    [
        "disabled",
        "missing_secret",
        "weak_secret",
        "missing_header",
        "wrong_header",
        "same_token",
        "forwarded",
    ],
)
def test_cloudflare_rejects_unauthorized_requests_before_provider(
    client, monkeypatch, path, body, case
):
    import invoiceflow.modules.copilot.router as copilot_router

    settings = client.app.state.settings
    settings.ai_provider = "cloudflare"
    settings.cloudflare_local_enabled = case != "disabled"
    secret = "ab" * 32
    settings.cloudflare_local_secret = (
        None if case == "missing_secret" else SecretStr("weak" if case == "weak_secret" else secret)
    )
    settings.cloudflare_api_token = SecretStr(secret if case == "same_token" else "provider-token")
    headers = (
        {}
        if case in {"missing_header", "forwarded"}
        else {"X-InvoiceFlow-Local-Secret": "cd" * 32 if case == "wrong_header" else secret}
    )
    if case == "forwarded":
        headers["X-Forwarded-For"] = "127.0.0.1"
    monkeypatch.setattr(
        copilot_router,
        "CloudflareProvider",
        lambda *args, **kwargs: pytest.fail("provider instantiated"),
    )

    response = client.post(path, json=body, headers=headers)

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "ai_unavailable"
    assert secret not in response.text
    assert "provider-token" not in response.text


def test_cloudflare_valid_secret_constructs_provider_without_network(client, monkeypatch):
    import invoiceflow.modules.copilot.router as copilot_router

    settings = client.app.state.settings
    settings.ai_provider = "cloudflare"
    settings.cloudflare_local_enabled = True
    settings.cloudflare_local_secret = SecretStr("ab" * 32)
    settings.cloudflare_api_token = SecretStr("provider-token")
    settings.cloudflare_account_id = "account"
    created = []
    sentinel = object()
    monkeypatch.setattr(
        copilot_router,
        "CloudflareProvider",
        lambda *args, **kwargs: created.append((args, kwargs)) or sentinel,
    )
    monkeypatch.setattr(
        copilot_router.CopilotService,
        "query",
        lambda self, *_: (
            (_ for _ in ()).throw(copilot_router.CopilotUnavailable("test_provider_selected"))
            if self.cloudflare_provider is sentinel
            else pytest.fail("wrong provider")
        ),
    )

    response = client.post(
        "/api/v1/copilot/queries",
        json={"question": "hello"},
        headers={"X-InvoiceFlow-Local-Secret": "ab" * 32, "X-Forwarded-For": "127.0.0.1"},
    )

    assert response.json()["error"]["code"] == "test_provider_selected"
    assert created[0][0] == ("account", "provider-token", settings.cloudflare_ai_model)


def test_demo_mode_does_not_require_local_secret(client):
    response = client.post("/api/v1/copilot/queries", json={"question": "hello"})
    assert response.status_code == 200
    assert response.json()["provider"] == "demo"


@pytest.mark.parametrize(
    "path", ["/api/v1/copilot/queries", "/api/v1/invoices/{invoice_id}/investigations"]
)
def test_copilot_openapi_documents_optional_local_secret(client, path):
    operation = client.get("/openapi.json").json()["paths"][path]["post"]
    header = next(p for p in operation["parameters"] if p["name"] == "X-InvoiceFlow-Local-Secret")
    assert header["in"] == "header"
    assert header["required"] is False
    assert "Cloudflare" in header["description"]


def test_cloudflare_rejects_duplicate_secret_headers(client, monkeypatch):
    import invoiceflow.modules.copilot.router as copilot_router

    settings = client.app.state.settings
    settings.ai_provider = "cloudflare"
    settings.cloudflare_local_enabled = True
    settings.cloudflare_local_secret = SecretStr("ab" * 32)
    settings.cloudflare_api_token = SecretStr("provider-token")
    monkeypatch.setattr(
        copilot_router,
        "CloudflareProvider",
        lambda *args, **kwargs: pytest.fail("provider instantiated"),
    )

    response = client.post(
        "/api/v1/copilot/queries",
        json={"question": "hello"},
        headers=[
            ("X-InvoiceFlow-Local-Secret", "ab" * 32),
            ("X-InvoiceFlow-Local-Secret", "ab" * 32),
        ],
    )
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "ai_unavailable"


@pytest.mark.parametrize(
    "authorized, code", [(True, "missing_configuration"), (False, "ai_unavailable")]
)
def test_missing_provider_token_is_reported_only_after_local_authorization(
    client, monkeypatch, authorized, code
):
    import invoiceflow.modules.copilot.router as copilot_router

    settings = client.app.state.settings
    settings.ai_provider = "cloudflare"
    settings.cloudflare_local_enabled = True
    settings.cloudflare_local_secret = SecretStr("ab" * 32)
    settings.cloudflare_api_token = None
    monkeypatch.setattr(
        copilot_router,
        "CloudflareProvider",
        lambda *args, **kwargs: pytest.fail("provider instantiated"),
    )
    headers = {"X-InvoiceFlow-Local-Secret": "ab" * 32} if authorized else {}

    response = client.post("/api/v1/copilot/queries", json={"question": "hello"}, headers=headers)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == code
