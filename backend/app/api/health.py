from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import text

from app import __version__
from app.api.deps import DbSession
from app.config import get_settings

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", summary="Liveness and dependency status")
def health(db: DbSession) -> dict:
    settings = get_settings()
    try:
        db.execute(text("SELECT 1"))
        database = "ok"
    except Exception:
        database = "unavailable"
    provider = settings.market_data_provider.lower()
    return {
        "status": "ok" if database == "ok" else "degraded",
        "version": __version__,
        "environment": settings.environment,
        "database": database,
        "market_data": {
            "provider": provider,
            "configured": provider == "demo" or bool(settings.market_data_api_key),
            "synthetic": provider == "demo",
        },
        "llm_enabled": settings.llm_enabled,
    }
