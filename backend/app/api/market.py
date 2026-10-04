from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import Analysis, Market
from app.schemas.market import CompareOut, OverviewOut
from app.services.analysis import COMPARE_RANGES
from app.utils.errors import InvalidTickerError
from app.utils.tickers import normalise_ticker

router = APIRouter(prefix="/api", tags=["market"])


@router.get("/market/overview", response_model=OverviewOut,
            summary="Index proxies, movers and volume across the tracked universe")
def overview(market: Market) -> dict:
    fetched = market.overview()
    return {
        **fetched.value,
        "stale": fetched.value["stale"] or fetched.stale,
        "meta": {"source": market.source, "source_label": market.source_label, "data_note": market.data_note,
                 "stale": fetched.stale, "fetched_at": fetched.value["generated_at"]},
    }


@router.get("/compare", response_model=CompareOut, summary="Compare 2-4 stocks")
def compare(
    tickers: Annotated[str, Query(description="Comma-separated tickers, 2 to 4", examples=["AAPL,MSFT,NVDA"])],
    svc: Analysis,
    range: Annotated[str, Query(pattern=r"^(1M|3M|6M|1Y|5Y)$")] = "1Y",
) -> dict:
    parsed = list(dict.fromkeys(normalise_ticker(t) for t in tickers.split(",") if t.strip()))
    if not 2 <= len(parsed) <= 4:
        raise InvalidTickerError("Select between 2 and 4 distinct tickers to compare.")
    assert range in COMPARE_RANGES
    return svc.compare(parsed, range)
