"""Twelve Data (https://twelvedata.com) market-data provider.

Data latency depends on the Twelve Data plan attached to the API key. The free "Basic" plan is
rate limited (8 credits/minute, 800/day) and is intended for evaluation - this application
therefore labels the data as "provider data, may be delayed" and never calls it real time.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone

import httpx
import pandas as pd

from app.services.market.types import Quote, SymbolMatch
from app.utils.errors import (
    ProviderError,
    ProviderNotConfiguredError,
    RateLimitedError,
    SymbolNotFoundError,
)
from app.utils.ratelimit import CreditLimiter

logger = logging.getLogger(__name__)

RETRY_STATUSES = {500, 502, 503, 504}
MAX_ATTEMPTS = 3


def _f(value) -> float | None:
    try:
        return None if value in (None, "") else float(value)
    except (TypeError, ValueError):
        return None


def _i(value) -> int | None:
    v = _f(value)
    return None if v is None else int(v)


class TwelveDataProvider:
    name = "twelvedata"
    label = "Twelve Data"
    data_note = (
        "Market data from Twelve Data. Timeliness depends on the provider plan - treat prices as "
        "possibly delayed, not as a real-time feed."
    )

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.twelvedata.com",
        limiter: CreditLimiter | None = None,
        client: httpx.Client | None = None,
        backoff: float = 0.6,
    ):
        self.api_key = api_key
        self.limiter = limiter or CreditLimiter(8)
        self.backoff = backoff
        self._client = client or httpx.Client(base_url=base_url, timeout=httpx.Timeout(12.0, connect=5.0))

    # ---------------------------------------------------------------- HTTP --
    def _get(self, path: str, params: dict, credits: int = 1) -> dict:
        if not self.api_key:
            raise ProviderNotConfiguredError(
                "No market-data API key is configured. Set MARKET_DATA_API_KEY, or set "
                "MARKET_DATA_PROVIDER=demo to use clearly-labelled synthetic demo data."
            )
        params = {**params, "apikey": self.api_key}
        last_error: Exception | None = None
        for attempt in range(MAX_ATTEMPTS):
            self.limiter.acquire(credits)
            try:
                resp = self._client.get(path, params=params)
            except httpx.TransportError as exc:  # timeouts, connection resets, DNS
                last_error = exc
                logger.warning("Twelve Data transport error (attempt %d): %s", attempt + 1, exc)
            else:
                if resp.status_code == 429:
                    raise RateLimitedError(
                        "The market-data provider is rate limiting requests. Please retry shortly.",
                        retry_after=int(resp.headers.get("Retry-After", 30)),
                    )
                if resp.status_code in RETRY_STATUSES:
                    last_error = ProviderError(f"Provider returned HTTP {resp.status_code}")
                else:
                    return self._parse(resp)
            time.sleep(self.backoff * (2 ** attempt))
        raise ProviderError("The market-data provider is currently unreachable.") from last_error

    @staticmethod
    def _parse(resp: httpx.Response) -> dict:
        try:
            payload = resp.json()
        except ValueError as exc:
            raise ProviderError("The market-data provider returned an unreadable response.") from exc
        if isinstance(payload, dict) and payload.get("status") == "error":
            TwelveDataProvider._raise_for_error(payload)
        if resp.status_code >= 400:
            raise ProviderError(f"Provider returned HTTP {resp.status_code}")
        return payload

    @staticmethod
    def _raise_for_error(payload: dict) -> None:
        code = int(payload.get("code") or 0)
        message = str(payload.get("message") or "Unknown provider error")
        lowered = message.lower()
        if code == 429:
            raise RateLimitedError(
                "The market-data provider's request limit has been reached. Please retry in a minute.",
                retry_after=60,
            )
        if code == 404 or "not found" in lowered or "symbol" in lowered and "invalid" in lowered:
            raise SymbolNotFoundError("The provider could not find that symbol.")
        if code in (401, 403):
            raise ProviderError(
                "The market-data provider rejected the API key or the plan does not include this data."
            )
        raise ProviderError(f"Market-data provider error: {message}")

    # --------------------------------------------------------------- search --
    def search(self, query: str) -> list[SymbolMatch]:
        data = self._get("/symbol_search", {"symbol": query, "outputsize": 12})
        seen: set[tuple[str, str]] = set()
        matches: list[SymbolMatch] = []
        for item in data.get("data", []):
            ticker, exchange = item.get("symbol"), item.get("exchange") or ""
            if not ticker or (ticker, exchange) in seen:
                continue
            seen.add((ticker, exchange))
            matches.append(SymbolMatch(
                ticker=ticker,
                name=item.get("instrument_name") or ticker,
                exchange=exchange,
                country=item.get("country"),
                instrument_type=item.get("instrument_type"),
                currency=item.get("currency"),
            ))
        # US listings first: that is what the free plan covers best.
        matches.sort(key=lambda m: (m.country != "United States", m.ticker != query.upper()))
        return matches

    # --------------------------------------------------------------- quotes --
    @staticmethod
    def _to_quote(d: dict) -> Quote:
        price = _f(d.get("close"))
        if price is None:
            raise ProviderError("The provider returned a quote without a price.")
        prev = _f(d.get("previous_close"))
        change = _f(d.get("change"))
        pct = _f(d.get("percent_change"))
        if change is None and prev:
            change = price - prev
        if pct is None and prev:
            pct = (price / prev - 1) * 100
        ts = _i(d.get("timestamp"))
        as_of = datetime.fromtimestamp(ts, tz=timezone.utc) if ts else datetime.now(timezone.utc)
        wk = d.get("fifty_two_week") or {}
        return Quote(
            ticker=d.get("symbol", ""),
            name=d.get("name") or d.get("symbol", ""),
            exchange=d.get("exchange") or "",
            currency=d.get("currency") or "USD",
            price=price,
            change=change or 0.0,
            change_percent=pct or 0.0,
            previous_close=prev,
            open=_f(d.get("open")),
            high=_f(d.get("high")),
            low=_f(d.get("low")),
            volume=_i(d.get("volume")),
            average_volume=_i(d.get("average_volume")),
            is_market_open=bool(d.get("is_market_open")),
            as_of=as_of,
            fifty_two_week_low=_f(wk.get("low")),
            fifty_two_week_high=_f(wk.get("high")),
        )

    def quotes(self, tickers: list[str]) -> dict[str, Quote]:
        if not tickers:
            return {}
        data = self._get("/quote", {"symbol": ",".join(tickers)}, credits=len(tickers))
        # one symbol -> the quote itself; several -> {symbol: quote | error}
        items = {tickers[0]: data} if len(tickers) == 1 else data
        out: dict[str, Quote] = {}
        for ticker, item in items.items():
            if not isinstance(item, dict) or item.get("status") == "error":
                continue
            try:
                q = self._to_quote(item)
            except ProviderError:
                continue
            q.ticker = q.ticker or ticker
            out[ticker.upper()] = q
        if len(tickers) == 1 and not out:
            raise SymbolNotFoundError("The provider could not find that symbol.")
        return out

    # ---------------------------------------------------------- time series --
    def time_series(self, ticker: str, interval: str, outputsize: int) -> pd.DataFrame:
        data = self._get(
            "/time_series",
            {"symbol": ticker, "interval": interval, "outputsize": outputsize, "order": "asc"},
        )
        values = data.get("values") or []
        if not values:
            raise SymbolNotFoundError("The provider has no price history for that symbol.")
        df = pd.DataFrame(values)
        tz = (data.get("meta") or {}).get("exchange_timezone") or "UTC"
        idx = pd.to_datetime(df["datetime"])
        idx = idx.dt.tz_localize("UTC") if interval.endswith("day") else idx.dt.tz_localize(
            tz, ambiguous="NaT", nonexistent="NaT"
        ).dt.tz_convert("UTC")
        df = df.drop(columns=["datetime"]).apply(pd.to_numeric, errors="coerce")
        df.index = pd.DatetimeIndex(idx, name="t")
        if "volume" not in df.columns:
            df["volume"] = 0.0
        df = df[df.index.notna()].sort_index()
        return df[["open", "high", "low", "close", "volume"]]
