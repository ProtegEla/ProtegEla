from typing import List

from cryptography.fernet import Fernet
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configurações centrais da aplicação carregadas via variáveis de ambiente."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
        hide_input_in_errors=True,
    )

    PROJECT_NAME: str = "ProtegEla API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Segurança e Autenticação
    APP_SECRET_KEY: str = "dev_secret_key_change_in_production_min_32_chars_long"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Recuperação de senha por e-mail
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_STARTTLS: bool = True
    PASSWORD_RESET_URL: str = ""

    # Criptografia de Campos em Repouso (LGPD: e-mail, telefones de contatos)
    FIELD_ENCRYPTION_KEY: str = Field(repr=False)

    # Chave HMAC para busca determinística de campos cifrados (ex.: unicidade de e-mail)
    FIELD_LOOKUP_KEY: str = Field(repr=False)

    @field_validator("FIELD_ENCRYPTION_KEY")
    @classmethod
    def validate_encryption_key(cls, value: str) -> str:
        try:
            Fernet(value.encode("utf-8"))
        except ValueError:
            raise ValueError(
                "FIELD_ENCRYPTION_KEY deve ser uma chave Fernet válida."
            ) from None
        return value

    @field_validator("FIELD_LOOKUP_KEY")
    @classmethod
    def validate_lookup_key(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("FIELD_LOOKUP_KEY não pode estar vazia.")
        return value

    # Banco de Dados PostgreSQL
    POSTGRES_USER: str = "protegela_user"
    POSTGRES_PASSWORD: str = "protegela_secret_dev_pass"
    POSTGRES_DB: str = "protegela_db"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    DATABASE_URL: str = (
        "postgresql+asyncpg://protegela_user:protegela_secret_dev_pass@localhost:5432/protegela_db"
    )
    DATABASE_SYNC_URL: str = (
        "postgresql+psycopg2://protegela_user:protegela_secret_dev_pass@localhost:5432/protegela_db"
    )

    # CORS
    ALLOWED_ORIGINS: str = (
        "http://localhost:3000,http://localhost:8081,http://localhost:19006,exp://localhost:8081"
    )

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    # APIs Externas
    OVERPASS_API_URL: str = "https://overpass-api.de/api/interpreter"
    OVERPASS_TIMEOUT_SECONDS: int = 10
    OPENROUTESERVICE_API_URL: str = "https://api.heigit.org/openrouteservice"
    OPENROUTESERVICE_API_KEY: str = "mock_dev_key"
    OPENROUTESERVICE_TIMEOUT_SECONDS: int = 8
    OPENROUTESERVICE_AUTOCOMPLETE_URL: str = "https://api.heigit.org/pelias/v1/autocomplete"
    ADDRESS_SEARCH_REQUESTS_PER_MINUTE: int = Field(default=60, ge=1)


settings = Settings()
