import pytest
from pydantic import ValidationError

from invoiceflow.core.config import Settings


def test_settings_read_database_url_from_environment_and_hide_credentials(monkeypatch):
    # Arrange
    url = "postgresql+psycopg://demo:private-password@localhost/invoiceflow"
    monkeypatch.setenv("DATABASE_URL", url)

    # Act
    settings = Settings(_env_file=None)

    # Assert
    assert settings.database_url.get_secret_value() == url
    assert "private-password" not in repr(settings)
    assert "private-password" not in settings.model_dump_json()


@pytest.mark.parametrize(
    "url",
    ["sqlite:///db.sqlite", "postgresql://host/db", "not-a-url", "postgresql+psycopg://host"],
)
def test_settings_reject_unsupported_or_incomplete_database_urls(url):
    # Act / Assert
    with pytest.raises(ValidationError, match="DATABASE_URL must"):
        Settings(database_url=url, _env_file=None)


def test_missing_database_configuration_fails_explicitly(monkeypatch):
    # Arrange
    monkeypatch.delenv("DATABASE_URL", raising=False)

    # Act / Assert
    with pytest.raises(ValidationError, match="database_url"):
        Settings(_env_file=None)
