"""Market-data service: provider + caching + stale fallback + market overview."""
from __future__ import annotations

from dataclasses import asdict
from datetime import datetime, timedelta, timezone

import pandas as pd

from app.config import Settings
from app.services.market.types import MarketDataProvider, Quote, SymbolMatch
from app.utils.cache import CacheResult, StaleCache
from app.utils.errors import AppError, ProviderError, SymbolNotFoundError

RANGES = ("1D", "5D", "1M", "3M", "6M", "1Y", "5Y")
DAILY_RANGE_DAYS = {"1M": 31, "3M": 92, "6M": 183, "1Y": 366, "5Y": 1827}
DAILY_OUTPUTSIZE = 1500  # ~6 years: 5Y of display plus the 200-bar SMA warm-up

INDEX_PROXIES = {
    "SPY": "S&P 500",
    "QQQ": "Nasdaq-100",
    "DIA": "Dow Jones",
    "IWM": "Russell 2000",
}


def quote_to_dict(q: Quote) -> dict:
    d = asdict(q)
    d["as_of"] = q.as_of.astimezone(timezone.utc).isoformat()
    return d


class MarketDataService:
    def __init__(self, provider: MarketDataProvider, settings: Settings):
        self.provider = provider
        self.settings = settings
        self.cache = StaleCache(stale_ttl=settings.cache_stale_ttl)

    # ------------------------------------------------------------- metadata --
    @property
    def source(self) -> str:
        return self.provider.name

    @property
    def source_label(self) -> str:
        return self.provider.label

    @property
    def data_note(self) -> str:
        return self.provider.data_note

    # --------------------------------------------------------------- search --
    def search(self, query: str) -> CacheResult[list[SymbolMatch]]:
        q = query.strip()
        return self.cache.get_or_load(
            f"search:{q.lower()}", self.settings.cache_search_ttl, lambda: self.provider.search(q)
        )

    # --------------------------------------------------------------- quotes --
    def quote(self, ticker: str) -> CacheResult[Quote]:
        def load() -> Quote:
            found = self.provider.quotes([ticker])
            if ticker not in found:
                raise SymbolNotFoundError(f"No quote is available for '{ticker}'.")
            return found[ticker]

        return self.cache.get_or_load(f"quote:{ticker}", self.settings.cache_quote_ttl, load)

    def quotes(self, tickers: list[str]) -> tuple[dict[str, Quote], bool]:
        """Batch quotes. Returns (quotes, any_stale). Missing symbols are simply absent."""
        ttl = self.settings.cache_quote_ttl
        result: dict[str, Quote] = {}
        missing: list[str] = []
        for t in tickers:
            hit = self.cache.get_fresh(f"quote:{t}", ttl)
            if hit:
                result[t] = hit.value  # type: ignore[assignment]
            else:
                missing.append(t)

        stale = False
        if missing:
            try:
                fetched = self.provider.quotes(missing)
            except AppError:
                fetched = {}
                for t in missing:
                    old = self.cache.get_stale(f"quote:{t}")
                    if old:
                        result[t] = old.value  # type: ignore[assignment]
                        stale = True
                if not result:
                    raise
            for t, q in fetched.items():
                self.cache.put(f"quote:{t}", q)
                result[t] = q
        return result, stale

    # ----------------------------------------------------------- price bars --
    def daily(self, ticker: str) -> CacheResult[pd.DataFrame]:
        return self.cache.get_or_load(
            f"daily:{ticker}",
            self.settings.cache_daily_ttl,
            lambda: self.provider.time_series(ticker, "1day", DAILY_OUTPUTSIZE),
        )

    def intraday(self, ticker: str, range_: str) -> CacheResult[pd.DataFrame]:
        interval, size = ("5min", 78) if range_ == "1D" else ("30min", 65)

        def load() -> pd.DataFrame:
            df = self.provider.time_series(ticker, interval, size)
            if range_ == "1D" and len(df):
                last_day = df.index[-1].date()
                df = df[[d.date() == last_day for d in df.index]]  # latest session only
            return df

        return self.cache.get_or_load(
            f"intraday:{ticker}:{range_}", self.settings.cache_intraday_ttl, load
        )

    @staticmethod
    def slice_daily(df: pd.DataFrame, range_: str) -> pd.DataFrame:
        days = DAILY_RANGE_DAYS[range_]
        cutoff = df.index[-1] - timedelta(days=days)
        return df[df.index >= cutoff]

    # ------------------------------------------------------------- overview --
    def overview(self) -> CacheResult[dict]:
        return self.cache.get_or_load(
            "overview", self.settings.cache_overview_ttl, self._build_overview
        )

    def _build_overview(self) -> dict:
        universe = self.settings.universe
        quotes, stale = self.quotes(universe)
        if not quotes:
            raise ProviderError("No quotes were returned for the tracked universe.")

        indices = [
            {"ticker": t, "name": INDEX_PROXIES[t], **quote_to_dict(quotes[t])}
            for t in INDEX_PROXIES
            if t in quotes
        ]
        stocks = [q for t, q in quotes.items() if t not in INDEX_PROXIES]
        by_change = sorted(stocks, key=lambda q: q.change_percent, reverse=True)
        by_volume = sorted(stocks, key=lambda q: q.volume or 0, reverse=True)
        return {
            "market_open": any(q.is_market_open for q in quotes.values()),
            "indices": indices,
            "gainers": [quote_to_dict(q) for q in by_change if q.change_percent > 0][:5],
            "losers": [quote_to_dict(q) for q in reversed(by_change) if q.change_percent < 0][:5],
            "most_active": [quote_to_dict(q) for q in by_volume[:5]],
            "movers": [quote_to_dict(q) for q in by_change],
            "total_volume": int(sum(q.volume or 0 for q in stocks)),
            "advancers": sum(1 for q in stocks if q.change_percent > 0),
            "decliners": sum(1 for q in stocks if q.change_percent < 0),
            "universe_size": len(quotes),
            "stale": stale,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
