from fastapi import APIRouter, status

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.get("/status", status_code=status.HTTP_200_OK)
async def auth_status():
    """Endpoint inicial de status do módulo de autenticação."""
    return {"module": "auth", "status": "initialized"}
