"""Provider-independent market data types."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

import pandas as pd


@dataclass
class SymbolMatch:
    ticker: str
    name: str
    exchange: str
    country: str | None = None
    instrument_type: str | None = None
    currency: str | None = None


@dataclass
class Quote:
    ticker: str
    name: str
    exchange: str
    currency: str
    price: float
    change: float
    change_percent: float
    previous_close: float | None
    open: float | None
    high: float | None
    low: float | None
    volume: int | None
    average_volume: int | None
    is_market_open: bool
    as_of: datetime
    fifty_two_week_low: float | None = None
    fifty_two_week_high: float | None = None


class MarketDataProvider(Protocol):
    name: str  # machine id, e.g. "twelvedata" or "demo"
    label: str  # human readable provider name
    data_note: str  # honest description of data latency / nature

    def search(self, query: str) -> list[SymbolMatch]: ...

    def quotes(self, tickers: list[str]) -> dict[str, Quote]:
        """Return quotes for the tickers that could be resolved (unknown ones are omitted)."""

    def time_series(self, ticker: str, interval: str, outputsize: int) -> pd.DataFrame:
        """OHLCV bars, ascending, tz-aware UTC index, lower-case columns."""
