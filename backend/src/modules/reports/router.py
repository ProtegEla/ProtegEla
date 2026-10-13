from fastapi import APIRouter, status

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/status", status_code=status.HTTP_200_OK)
async def reports_status():
    """Endpoint inicial de status do módulo de relatos."""
    return {"module": "reports", "status": "initialized"}
