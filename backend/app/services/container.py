"""Lazily-built singletons for the service layer (provider, cache, model registry, Dia)."""
from __future__ import annotations

from functools import lru_cache

from app.config import get_settings
from app.ml.predict import ModelRegistry
from app.services.analysis import AnalysisService
from app.services.dia import DiaService
from app.services.market import MarketDataService
from app.services.market.demo import DemoProvider
from app.services.market.twelvedata import TwelveDataProvider
from app.utils.errors import ProviderNotConfiguredError
from app.utils.ratelimit import CreditLimiter


def build_provider():
    settings = get_settings()
    name = settings.market_data_provider.lower()
    if name == "demo":
        return DemoProvider()
    if name == "twelvedata":
        if not settings.market_data_api_key:
            raise ProviderNotConfiguredError(
                "MARKET_DATA_PROVIDER=twelvedata but MARKET_DATA_API_KEY is empty. Add a key, or set "
                "MARKET_DATA_PROVIDER=demo for clearly-labelled synthetic demo data."
            )
        return TwelveDataProvider(
            api_key=settings.market_data_api_key,
            base_url=settings.market_data_base_url,
            limiter=CreditLimiter(
                settings.market_data_credits_per_minute, max_wait=settings.market_data_max_wait_seconds
            ),
        )
    raise ValueError(f"Unknown MARKET_DATA_PROVIDER '{settings.market_data_provider}'")


@lru_cache
def get_market_service() -> MarketDataService:
    return MarketDataService(build_provider(), get_settings())


@lru_cache
def get_model_registry() -> ModelRegistry:
    settings = get_settings()
    return ModelRegistry(settings.ml_model_dir, persist=settings.ml_persist_models)


@lru_cache
def get_dia_service() -> DiaService:
    return DiaService(get_settings())


@lru_cache
def get_analysis_service() -> AnalysisService:
    return AnalysisService(get_market_service(), get_model_registry(), get_dia_service())


def reset_services() -> None:
    """Drop cached singletons (used by tests and settings reloads)."""
    for fn in (get_market_service, get_model_registry, get_dia_service, get_analysis_service):
        fn.cache_clear()
