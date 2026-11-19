from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response

from src.core.config import settings
from src.modules.addresses.clients import OpenRouteServiceGeocodingClient
from src.modules.addresses.schemas import AddressSuggestionsResponse, SearchText
from src.modules.addresses.service import AddressService

router = APIRouter(prefix="/addresses", tags=["Addresses"])

_service = AddressService(
    OpenRouteServiceGeocodingClient(
        settings.OPENROUTESERVICE_AUTOCOMPLETE_URL,
        settings.OPENROUTESERVICE_API_KEY,
        settings.OPENROUTESERVICE_TIMEOUT_SECONDS,
    ),
    requests_per_minute=settings.ADDRESS_SEARCH_REQUESTS_PER_MINUTE,
)


def get_address_service() -> AddressService:
    return _service


@router.get("/suggestions", response_model=AddressSuggestionsResponse)
async def get_address_suggestions(
    response: Response,
    q: Annotated[SearchText, Query()],
    service: Annotated[AddressService, Depends(get_address_service)],
    limit: Annotated[int, Query(ge=1, le=10)] = 5,
) -> AddressSuggestionsResponse:
    response.headers["Cache-Control"] = "no-store"
    return AddressSuggestionsResponse(data=await service.suggest(q, limit))
