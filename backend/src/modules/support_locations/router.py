from fastapi import APIRouter, Depends, Query, status

from src.core.config import settings
from src.modules.support_locations.adapters import OverpassAdapter
from src.modules.support_locations.clients import (
    OpenRouteServiceDirectionsClient,
    OverpassClient,
)
from src.modules.support_locations.schemas import NearbySupportLocationsResponse
from src.modules.support_locations.service import SupportLocationService

router = APIRouter(prefix="/support-locations", tags=["Support Locations"])


def get_support_location_service() -> SupportLocationService:
    return SupportLocationService(
        overpass_client=OverpassClient(
            api_url=settings.OVERPASS_API_URL,
            timeout_seconds=settings.OVERPASS_TIMEOUT_SECONDS,
        ),
        directions_client=OpenRouteServiceDirectionsClient(
            api_url=settings.OPENROUTESERVICE_API_URL,
            api_key=settings.OPENROUTESERVICE_API_KEY,
            timeout_seconds=settings.OPENROUTESERVICE_TIMEOUT_SECONDS,
        ),
        overpass_adapter=OverpassAdapter(),
    )


@router.get(
    "/nearby",
    status_code=status.HTTP_200_OK,
    response_model=NearbySupportLocationsResponse,
    responses={
        422: {"description": "Latitude ou longitude inválida."},
        503: {"description": "Serviço externo indisponível."},
    },
)
async def get_nearby_support_locations(
    latitude: float = Query(..., ge=-90, le=90, allow_inf_nan=False),
    longitude: float = Query(..., ge=-180, le=180, allow_inf_nan=False),
    service: SupportLocationService = Depends(get_support_location_service),
) -> NearbySupportLocationsResponse:
    locations = await service.find_nearest_police_stations(
        latitude=latitude,
        longitude=longitude,
    )
    return NearbySupportLocationsResponse(data=locations)


@router.get("/status", status_code=status.HTTP_200_OK)
async def support_locations_status():
    """Endpoint inicial de status do módulo de locais de apoio."""
    return {"module": "support_locations", "status": "initialized"}
