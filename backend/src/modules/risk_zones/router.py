from typing import Annotated
from fastapi import APIRouter, Depends, Query, status
from pydantic import UUID5
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db_session
from src.modules.comments.schemas import PageMeta
from src.modules.risk_zones.service import RiskZoneService
from src.modules.risk_zones.schemas import (
    ZoneResponse,
    FeatureCollection,
    ZoneFeature,
    ZoneMeta,
    IncidentRead,
    IncidentPage,
)

router = APIRouter(prefix="/risk-zones", tags=["Risk Zones"])


@router.get("/status", status_code=status.HTTP_200_OK)
async def risk_zones_status():
    """Endpoint inicial de status do módulo de zonas de risco."""
    return {"module": "risk_zones", "status": "initialized"}


async def get_risk_zone_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> RiskZoneService:
    return RiskZoneService(session)


@router.get("", response_model=ZoneResponse)
async def list_zones(
    bbox: Annotated[str, Query()],
    service: Annotated[RiskZoneService, Depends(get_risk_zone_service)],
) -> ZoneResponse:
    zones = await service.list(bbox)
    return ZoneResponse(
        data=FeatureCollection(features=[ZoneFeature.from_zone(z) for z in zones]),
        meta=ZoneMeta(total_records=len(zones)),
    )


@router.get("/{zone_id}/incidents", response_model=IncidentPage)
async def list_zone_incidents(
    zone_id: UUID5,
    service: Annotated[RiskZoneService, Depends(get_risk_zone_service)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> IncidentPage:
    incidents, total = await service.incidents(zone_id, page=page, page_size=page_size)
    return IncidentPage(
        data=[IncidentRead.from_incident(i) for i in incidents],
        meta=PageMeta(page=page, page_size=page_size, total_records=total),
    )
