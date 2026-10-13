from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configurações centrais da aplicação carregadas via variáveis de ambiente."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
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

    # Criptografia de Campos em Repouso (LGPD: e-mail, telefones de contatos)
    FIELD_ENCRYPTION_KEY: str = "dGhpcy1pcy1hLWRldmVsb3BtZW50LWtleS1mb3ItZmVybmV0PQ=="

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
        "postgresql://protegela_user:protegela_secret_dev_pass@localhost:5432/protegela_db"
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
    OPENROUTESERVICE_API_URL: str = "https://api.openrouteservice.org"
    OPENROUTESERVICE_API_KEY: str = "mock_dev_key"
    OPENROUTESERVICE_TIMEOUT_SECONDS: int = 8


settings = Settings()
