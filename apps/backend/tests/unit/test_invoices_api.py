import pytest


@pytest.mark.parametrize(
    "params",
    [
        {"page": "0"},
        {"page_size": "0"},
        {"page_size": "101"},
        {"status": "unknown"},
        {"sort": "vendor"},
        {"q": "   "},
        {"q": "x" * 101},
        {"due_from": "2026-11-22", "due_to": "2026-11-21"},
        {"unexpected": "value"},
    ],
)
def test_list_rejects_invalid_query_with_documented_validation_shape(client, params):
    response = client.get("/api/v1/invoices", params=params)

    assert response.status_code == 422
    assert isinstance(response.json()["detail"], list)
    assert {"loc", "msg", "type"} <= response.json()["detail"][0].keys()


@pytest.mark.parametrize("path", ["/api/v1/invoices/bad", "/api/v1/invoices/bad/comparison"])
def test_malformed_invoice_id_is_rejected(client, path):
    assert client.get(path).status_code == 422


def test_openapi_declares_invoice_operations_and_errors(client):
    schema = client.get("/openapi.json").json()
    paths = schema["paths"]
    for path, operation in [
        ("/api/v1/invoices", "listInvoices"),
        ("/api/v1/invoices/{invoice_id}", "getInvoice"),
        ("/api/v1/invoices/{invoice_id}/comparison", "getInvoiceComparison"),
    ]:
        route = paths[path]["get"]
        assert route["operationId"] == operation
        assert "200" in route["responses"]
        assert "422" in route["responses"]
        assert "503" in route["responses"]
        if "{invoice_id}" in path:
            assert "404" in route["responses"]
    query = {p["name"] for p in paths["/api/v1/invoices"]["get"]["parameters"]}
    assert {"page", "page_size", "q", "status", "due_from", "due_to", "sort"} <= query
    assert "ApiError" in schema["components"]["schemas"]
