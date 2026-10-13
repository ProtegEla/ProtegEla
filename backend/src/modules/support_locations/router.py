from fastapi import APIRouter, status

router = APIRouter(prefix="/support-locations", tags=["Support Locations"])


@router.get("/status", status_code=status.HTTP_200_OK)
async def support_locations_status():
    """Endpoint inicial de status do módulo de locais de apoio."""
    return {"module": "support_locations", "status": "initialized"}
