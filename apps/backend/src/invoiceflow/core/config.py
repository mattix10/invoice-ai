from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", hide_input_in_errors=True)

    database_url: SecretStr
    ai_provider: str = "demo"
    cloudflare_account_id: str | None = None
    cloudflare_api_token: SecretStr | None = None
    cloudflare_ai_model: str = "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
    cloudflare_timeout_seconds: float = Field(default=15, gt=0, le=30)
    cloudflare_local_enabled: bool = False
    cloudflare_local_secret: SecretStr | None = None
    intake_storage_dir: str = ".invoiceflow-storage"
    intake_ocr_spool_dir: str | None = None

    @field_validator("database_url")
    @classmethod
    def require_postgresql(cls, value: SecretStr) -> SecretStr:
        try:
            url = make_url(value.get_secret_value())
        except ArgumentError:
            raise ValueError("DATABASE_URL must be a valid PostgreSQL URL") from None
        if url.drivername != "postgresql+psycopg" or not url.database:
            raise ValueError("DATABASE_URL must use postgresql+psycopg and name a database")
        return value
