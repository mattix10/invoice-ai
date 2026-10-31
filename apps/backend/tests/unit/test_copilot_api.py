import pytest


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
