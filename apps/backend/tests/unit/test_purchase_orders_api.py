import pytest


@pytest.mark.parametrize(
    "changes",
    [
        {"items": []},
        {"items": [{"position": 1, "description": "Item", "quantity": 0, "unitNet": "1.00"}]},
        {"items": [{"position": 1, "description": "Item", "quantity": 1, "unitNet": "-1.00"}]},
        {"items": [{"position": 0, "description": "Item", "quantity": 1, "unitNet": "1.00"}]},
    ],
)
def test_purchase_order_rejects_invalid_items(client, changes):
    body = {
        "externalReference": "PO-TEST",
        "supplier": "Fictional supplier",
        "currency": "PLN",
        "vatRate": "0.23",
        "items": [{"position": 1, "description": "Item", "quantity": 1, "unitNet": "1.00"}],
    }
    body.update(changes)

    response = client.post("/api/v1/purchase-orders", json=body)

    assert response.status_code == 422
    assert isinstance(response.json()["detail"], list)


def test_purchase_order_openapi_documents_operations_and_errors(client):
    paths = client.get("/openapi.json").json()["paths"]
    for path, method in [
        ("/api/v1/purchase-orders", "get"),
        ("/api/v1/purchase-orders", "post"),
        ("/api/v1/purchase-orders/{po_id}", "get"),
        ("/api/v1/purchase-orders/{po_id}", "put"),
        ("/api/v1/invoices/{invoice_id}/purchase-order-link", "put"),
    ]:
        operation = paths[path][method]
        assert "operationId" in operation
        assert "503" in operation["responses"]
        if method != "get" or "{" in path:
            assert "422" in operation["responses"]
        if "{po_id}" in path or "{invoice_id}" in path:
            assert "404" in operation["responses"]
        if method == "put":
            assert "409" in operation["responses"]
