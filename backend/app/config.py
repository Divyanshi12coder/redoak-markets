"""Application settings, loaded from environment variables (and an optional .env file)."""
from __future__ import annotations

import logging
import secrets
from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

ML_MODEL_DIR = Path(__file__).resolve().parent / "ml" / "models"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "RedOak Markets API"
    environment: str = "development"  # development | production | test

    # --- database -------------------------------------------------------
    database_url: str = "sqlite:///./redoak.db"

    # --- auth -----------------------------------------------------------
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 12 * 60

    # --- CORS -----------------------------------------------------------
    cors_origins: str = "http://localhost:5173"

    # --- market data ----------------------------------------------------
    market_data_provider: str = "demo"  # "twelvedata" | "demo"
    market_data_api_key: str = ""
    market_data_base_url: str = "https://api.twelvedata.com"
    # Twelve Data's free plan allows 8 credits/minute; one credit per symbol per request.
    market_data_credits_per_minute: int = 8
    market_data_max_wait_seconds: float = 8.0
    market_universe: str = "SPY,QQQ,DIA,IWM,AAPL,MSFT,NVDA,AMZN,GOOGL,META,TSLA,JPM"

    # cache lifetimes (seconds)
    cache_quote_ttl: int = 60
    cache_intraday_ttl: int = 300
    cache_daily_ttl: int = 3600
    cache_search_ttl: int = 86400
    cache_overview_ttl: int = 300
    cache_stale_ttl: int = 6 * 3600  # how long expired entries may be served if the provider fails

    # --- optional LLM layer for Dia ------------------------------------
    llm_api_key: str = ""
    llm_model: str = "claude-haiku-4-5-20251001"
    llm_base_url: str = "https://api.anthropic.com"
    llm_timeout_seconds: float = 20.0

    # --- ML -------------------------------------------------------------
    ml_model_dir: str = str(ML_MODEL_DIR)
    ml_persist_models: bool = True

    @field_validator("database_url")
    @classmethod
    def _normalise_database_url(cls, v: str) -> str:
        # Render/Heroku hand out postgres:// or postgresql:// URLs; SQLAlchemy needs the driver.
        if v.startswith("postgres://"):
            v = "postgresql://" + v[len("postgres://"):]
        if v.startswith("postgresql://"):
            v = "postgresql+psycopg://" + v[len("postgresql://"):]
        return v

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.cors_origins.split(",") if o.strip()]

    @property
    def universe(self) -> list[str]:
        return [t.strip().upper() for t in self.market_universe.split(",") if t.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def llm_enabled(self) -> bool:
        return bool(self.llm_api_key)


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if not settings.jwt_secret:
        if settings.is_production:
            raise RuntimeError("JWT_SECRET must be set when ENVIRONMENT=production")
        # Ephemeral secret: tokens stop working on restart, which is fine for local development.
        settings.jwt_secret = secrets.token_urlsafe(48)
        logger.warning("JWT_SECRET not set - using an ephemeral development secret")
    elif settings.is_production and len(settings.jwt_secret) < 32:
        raise RuntimeError("JWT_SECRET must be at least 32 characters in production")
    return settings
