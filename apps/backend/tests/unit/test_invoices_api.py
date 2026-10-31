import pytest

from invoiceflow.modules.intake.schemas import Draft
from invoiceflow.modules.invoices.router import get_service
from invoiceflow.modules.invoices.schemas import InvoicePage, InvoiceSummary


@pytest.mark.parametrize(
    "params",
    [
        {"page": "0"},
        {"pageSize": "0"},
        {"pageSize": "101"},
        {"status": "unknown"},
        {"sort": "vendor"},
        {"q": "   "},
        {"q": "x" * 101},
        {"dueFrom": "2026-11-22", "dueTo": "2026-11-21"},
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
    assert {"page", "pageSize", "q", "status", "dueFrom", "dueTo", "sort"} <= query
    assert "ApiError" in schema["components"]["schemas"]


def test_camel_case_query_and_response_use_python_field_names_in_service(client):
    class Service:
        def list(self, query):
            assert query.page_size == 2
            assert str(query.due_from) == "2026-11-20"
            return InvoicePage(
                items=[
                    InvoiceSummary(
                        id="INV-2026-1042",
                        vendor="Example",
                        due="2026-11-21",
                        currency="PLN",
                        status="approved",
                        gross_amount="12.34",
                    )
                ],
                page=1,
                page_size=query.page_size,
                total=1,
            )

    client.app.dependency_overrides[get_service] = lambda: Service()
    response = client.get("/api/v1/invoices", params={"pageSize": 2, "dueFrom": "2026-11-20"})

    assert response.status_code == 200
    assert response.json()["pageSize"] == 2
    assert response.json()["items"][0]["grossAmount"] == "12.34"


def test_draft_accepts_camel_case_and_preserves_existing_storage_names():
    stored = {
        "vendor": "Example",
        "supplier_invoice_number": "A1",
        "issued": None,
        "due": None,
        "currency": None,
        "vat_rate": None,
        "items": [],
        "declared_totals": None,
    }
    draft = Draft.model_validate(stored)
    wire = draft.model_dump(mode="json", by_alias=True)

    assert wire["supplierInvoiceNumber"] == "A1"
    assert Draft.model_validate(wire).model_dump(mode="json") == stored
