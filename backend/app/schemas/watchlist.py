from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.market import DataMeta


class WatchlistAddIn(BaseModel):
    ticker: str = Field(min_length=1, max_length=12)


class WatchlistReorderIn(BaseModel):
    tickers: list[str] = Field(min_length=1, max_length=50)


class WatchlistItemOut(BaseModel):
    ticker: str
    position: int
    added_at: datetime
    quote: dict[str, Any] | None = None


class WatchlistOut(BaseModel):
    items: list[WatchlistItemOut]
    quotes_error: str | None = None
    meta: DataMeta
