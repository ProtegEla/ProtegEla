from fastapi import APIRouter, status

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/status", status_code=status.HTTP_200_OK)
async def users_status():
    """Endpoint inicial de status do módulo de usuárias."""
    return {"module": "users", "status": "initialized"}
