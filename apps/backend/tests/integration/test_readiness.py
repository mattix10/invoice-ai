import pytest
from fastapi.testclient import TestClient

from invoiceflow.main import create_app

pytestmark = pytest.mark.integration


def test_readiness_connects_to_real_postgresql(database_settings):
    # Arrange
    app = create_app(database_settings)
    with TestClient(app) as client:
        # Act
        response = client.get("/health/ready")

    # Assert
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
