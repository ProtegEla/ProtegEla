from fastapi import APIRouter, status

router = APIRouter(prefix="/routes", tags=["Routes"])


@router.get("/status", status_code=status.HTTP_200_OK)
async def routes_status():
    """Endpoint inicial de status do módulo de rotas."""
    return {"module": "routes", "status": "initialized"}
