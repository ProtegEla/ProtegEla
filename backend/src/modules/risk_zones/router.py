from fastapi import APIRouter, status

router = APIRouter(prefix="/risk-zones", tags=["Risk Zones"])


@router.get("/status", status_code=status.HTTP_200_OK)
async def risk_zones_status():
    """Endpoint inicial de status do módulo de zonas de risco."""
    return {"module": "risk_zones", "status": "initialized"}
