from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.v1.api_router import api_v1_router
from src.core.config import settings
from src.core.exceptions import setup_exception_handlers


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gerenciamento de ciclo de vida (startup e shutdown) da aplicação."""
    # Inicialização (ex: verificação de conexão com banco, pools)
    yield
    # Limpeza no encerramento da aplicação


def create_application() -> FastAPI:
    """Fábrica para instanciação e configuração do aplicativo FastAPI."""
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description="API da plataforma ProtegEla - Segurança e mobilidade para mulheres em São Paulo.",
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
        docs_url=f"{settings.API_V1_STR}/docs",
        redoc_url=f"{settings.API_V1_STR}/redoc",
        lifespan=lifespan,
    )

    # Configuração de CORS para permitir acesso dos clientes Mobile e Web
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Configuração de manipuladores globais de erro (envelope RFC 7807)
    setup_exception_handlers(app)

    # Registro de rotas versionadas
    app.include_router(api_v1_router, prefix=settings.API_V1_STR)

    @app.get("/", tags=["Root"])
    async def root():
        return {
            "name": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "docs": f"{settings.API_V1_STR}/docs",
            "health": f"{settings.API_V1_STR}/health",
        }

    return app


app = create_application()
