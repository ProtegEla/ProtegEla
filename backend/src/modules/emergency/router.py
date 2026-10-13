from fastapi import APIRouter, status

router = APIRouter(prefix="/emergency", tags=["Emergency"])


@router.get("/status", status_code=status.HTTP_200_OK)
async def emergency_status():
    """Endpoint inicial de status do módulo de emergência."""
    return {"module": "emergency", "status": "initialized"}
