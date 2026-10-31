from unittest.mock import MagicMock

import pytest
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from invoiceflow.core.database import get_session


def test_liveness_does_not_require_a_database_connection(client):
    # Arrange: the client points at an unreachable database.
    # Act
    response = client.get("/health")

    # Assert
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.parametrize("available", [True, False])
def test_readiness_reports_database_availability_without_exposing_errors(client, available):
    # Arrange
    session = MagicMock(spec=Session)
    if available:
        session.execute.return_value.scalar_one.return_value = 1
    else:
        session.execute.side_effect = OperationalError(
            "secret connection details", {}, Exception("password=do-not-expose")
        )
    client.app.dependency_overrides[get_session] = lambda: session

    # Act
    response = client.get("/health/ready")

    # Assert
    assert response.status_code == (200 if available else 503)
    assert response.json() == {"status": "ok" if available else "unavailable"}
    assert "secret" not in response.text
    assert "password" not in response.text


def test_openapi_declares_health_contracts(client):
    # Act
    schema = client.get("/openapi.json").json()

    # Assert
    assert schema["paths"]["/health"]["get"]["operationId"] == "getHealth"
    responses = schema["paths"]["/health/ready"]["get"]["responses"]
    for code in ("200", "503"):
        assert responses[code]["content"]["application/json"]["schema"] == {
            "$ref": "#/components/schemas/HealthResponse"
        }
