import os
import sys
from logging.config import fileConfig

from alembic import context
from geoalchemy2.alembic_helpers import include_object
from sqlalchemy import engine_from_config, pool

# Adiciona o diretório raiz do backend ao sys.path para importar os módulos da aplicação
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.core.config import settings
from src.core.database import Base
from src.modules.reports.models import Report  # noqa: F401 -- registra em Base.metadata

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Configura a URL de conexão com base nas configurações da aplicação (sync URL para o Alembic)
config.set_main_option("sqlalchemy.url", settings.DATABASE_SYNC_URL)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Executa migrações no modo 'offline' sem uma engine conectada."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Executa migrações no modo 'online' conectando diretamente ao PostgreSQL."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
