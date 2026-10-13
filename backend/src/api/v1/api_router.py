from fastapi import APIRouter, status

from src.modules.auth.router import router as auth_router
from src.modules.users.router import router as users_router
from src.modules.reports.router import router as reports_router
from src.modules.comments.router import router as comments_router
from src.modules.risk_zones.router import router as risk_zones_router
from src.modules.routes.router import router as routes_router
from src.modules.emergency.router import router as emergency_router
from src.modules.support_locations.router import router as support_locations_router
from src.modules.notifications.router import router as notifications_router

api_v1_router = APIRouter()


@api_v1_router.get("/health", status_code=status.HTTP_200_OK, tags=["Health"])
async def health_check():
    """Healthcheck endpoint para verificação de disponibilidade da API."""
    return {
        "status": "healthy",
        "service": "ProtegEla API",
        "version": "1.0.0",
    }


# Inclusão dos roteadores modulares diretos
api_v1_router.include_router(auth_router)
api_v1_router.include_router(users_router)
api_v1_router.include_router(reports_router)
api_v1_router.include_router(comments_router)
api_v1_router.include_router(risk_zones_router)
api_v1_router.include_router(routes_router)
api_v1_router.include_router(emergency_router)
api_v1_router.include_router(support_locations_router)
api_v1_router.include_router(notifications_router)
