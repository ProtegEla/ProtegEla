from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.database import get_db_session
from src.modules.risk_zones.service import RoutingRiskService
from src.modules.routes.clients import OpenRouteServiceClient, OverpassRoadClient
from src.modules.routes.schemas import RouteCalculate, RouteCalculateResponse
from src.modules.routes.service import RouteRiskEvaluator, RouteService

router = APIRouter(prefix="/routes", tags=["Routes"])


@lru_cache
def get_route_service() -> RouteService:
    return RouteService(
        OpenRouteServiceClient(
            settings.OPENROUTESERVICE_API_URL,
            settings.OPENROUTESERVICE_API_KEY,
            settings.OPENROUTESERVICE_TIMEOUT_SECONDS,
        ),
        requests_per_minute=settings.ROUTE_REQUESTS_PER_MINUTE,
    )


def get_risk_evaluator(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> RouteRiskEvaluator:
    return RouteRiskEvaluator(
        RoutingRiskService(session),
        OverpassRoadClient(
            settings.OVERPASS_API_URL, settings.OVERPASS_TIMEOUT_SECONDS
        ),
    )


@router.post(
    "/calculate",
    response_model=RouteCalculateResponse,
    summary="Calcula candidatas para pedestres e compara exposição ao risco",
    responses={
        422: {"description": "Entrada inválida ou caminho não encontrado."},
        429: {"description": "Limite de cálculos excedido."},
        503: {"description": "Provedor de rotas indisponível."},
    },
)
async def calculate_route(
    payload: RouteCalculate,
    response: Response,
    service: Annotated[RouteService, Depends(get_route_service)],
    evaluator: Annotated[RouteRiskEvaluator, Depends(get_risk_evaluator)],
) -> RouteCalculateResponse:
    response.headers["Cache-Control"] = "no-store"
    return RouteCalculateResponse(
        data=await service.calculate(payload, evaluator=evaluator)
    )


@router.get("/status", status_code=status.HTTP_200_OK)
async def routes_status():
    """Endpoint inicial de status do módulo de rotas."""
    return {"module": "routes", "status": "initialized"}
