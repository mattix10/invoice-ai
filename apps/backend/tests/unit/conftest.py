import pytest
from fastapi.testclient import TestClient

from invoiceflow.core.config import Settings
from invoiceflow.main import create_app


@pytest.fixture
def client():
    settings = Settings(
        database_url="postgresql+psycopg://unit:unit@127.0.0.1:1/invoiceflow_test",
        _env_file=None,
    )
    app = create_app(settings)
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
