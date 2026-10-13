from fastapi import APIRouter, status

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/status", status_code=status.HTTP_200_OK)
async def notifications_status():
    """Endpoint inicial de status do módulo de notificações."""
    return {"module": "notifications", "status": "initialized"}
