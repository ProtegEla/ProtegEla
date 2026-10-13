from fastapi import APIRouter, status

router = APIRouter(prefix="/comments", tags=["Comments"])


@router.get("/status", status_code=status.HTTP_200_OK)
async def comments_status():
    """Endpoint inicial de status do módulo de comentários."""
    return {"module": "comments", "status": "initialized"}
