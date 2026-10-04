"""Twelve Data client: parsing, error mapping, retries - using a mocked HTTP transport."""
import httpx
import pytest

from app.config import Settings
from app.services.market import MarketDataService
from app.services.market.twelvedata import TwelveDataProvider
from app.utils.errors import (
    ProviderError,
    ProviderNotConfiguredError,
    RateLimitedError,
    SymbolNotFoundError,
)
from app.utils.ratelimit import CreditLimiter

QUOTE = {
    "symbol": "AAPL", "name": "Apple Inc", "exchange": "NASDAQ", "currency": "USD", "datetime": "2025-01-10",
    "timestamp": 1736530800, "open": "180.0", "high": "186.0", "low": "179.0", "close": "185.5", "volume": "55000000",
    "previous_close": "182.0", "change": "3.5", "percent_change": "1.92308", "average_volume": "60000000",
    "is_market_open": False, "fifty_two_week": {"low": "120.0", "high": "199.0"},
}


def provider(handler, key="k", backoff=0.0, limiter=None):
    client = httpx.Client(base_url="https://api.test", transport=httpx.MockTransport(handler))
    return TwelveDataProvider(key, limiter=limiter or CreditLimiter(1000), client=client, backoff=backoff)


def test_quote_parsing_and_api_key_is_sent_as_param():
    seen = {}

    def handler(request):
        seen["params"] = dict(request.url.params)
        return httpx.Response(200, json=QUOTE)

    q = provider(handler).quotes(["AAPL"])["AAPL"]
    assert seen["params"]["apikey"] == "k" and seen["params"]["symbol"] == "AAPL"
    assert q.price == 185.5 and q.change_percent == pytest.approx(1.92308) and q.volume == 55_000_000
    assert q.fifty_two_week_high == 199.0 and q.is_market_open is False


def test_batch_quotes_skip_failed_symbols():
    payload = {"AAPL": QUOTE, "ZZZZ": {"code": 400, "message": "symbol not found", "status": "error"}}
    out = provider(lambda r: httpx.Response(200, json=payload)).quotes(["AAPL", "ZZZZ"])
    assert list(out) == ["AAPL"]


def test_time_series_daily_and_intraday_timezones():
    daily = {"meta": {"exchange_timezone": "America/New_York"}, "status": "ok",
             "values": [{"datetime": "2025-01-02", "open": "1", "high": "2", "low": "0.5", "close": "1.5", "volume": "10"},
                        {"datetime": "2025-01-03", "open": "1.5", "high": "2", "low": "1", "close": "1.8", "volume": "12"}]}
    df = provider(lambda r: httpx.Response(200, json=daily)).time_series("AAPL", "1day", 2)
    assert str(df.index.tz) == "UTC" and df.index[0].strftime("%Y-%m-%d") == "2025-01-02"

    intraday = {"meta": {"exchange_timezone": "America/New_York"}, "status": "ok",
                "values": [{"datetime": "2025-01-02 09:30:00", "open": "1", "high": "2", "low": "1", "close": "1.5", "volume": "5"}]}
    df = provider(lambda r: httpx.Response(200, json=intraday)).time_series("AAPL", "5min", 1)
    assert df.index[0].hour == 14 and df.index[0].minute == 30  # 09:30 EST -> 14:30 UTC


def test_search_prefers_us_and_dedupes():
    payload = {"status": "ok", "data": [
        {"symbol": "AAPL", "instrument_name": "Apple", "exchange": "LSE", "country": "United Kingdom"},
        {"symbol": "AAPL", "instrument_name": "Apple Inc", "exchange": "NASDAQ", "country": "United States"},
        {"symbol": "AAPL", "instrument_name": "Apple Inc", "exchange": "NASDAQ", "country": "United States"},
    ]}
    out = provider(lambda r: httpx.Response(200, json=payload)).search("aapl")
    assert [(m.exchange) for m in out] == ["NASDAQ", "LSE"]


@pytest.mark.parametrize("payload,exc", [
    ({"code": 429, "message": "run out of API credits", "status": "error"}, RateLimitedError),
    ({"code": 404, "message": "symbol not found", "status": "error"}, SymbolNotFoundError),
    ({"code": 401, "message": "apikey invalid", "status": "error"}, ProviderError),
    ({"code": 500, "message": "boom", "status": "error"}, ProviderError),
])
def test_provider_error_payloads_map_to_domain_errors(payload, exc):
    with pytest.raises(exc):
        provider(lambda r: httpx.Response(200, json=payload)).quotes(["AAPL"])


def test_http_429_is_reported_with_retry_after():
    p = provider(lambda r: httpx.Response(429, headers={"Retry-After": "17"}, json={}))
    with pytest.raises(RateLimitedError) as e:
        p.quotes(["AAPL"])
    assert e.value.retry_after == 17


def test_retries_transient_server_errors_then_succeeds():
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        return httpx.Response(503) if calls["n"] < 3 else httpx.Response(200, json=QUOTE)

    assert provider(handler).quotes(["AAPL"])["AAPL"].price == 185.5
    assert calls["n"] == 3


def test_gives_up_after_max_attempts():
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        raise httpx.ConnectTimeout("slow")

    with pytest.raises(ProviderError):
        provider(handler).quotes(["AAPL"])
    assert calls["n"] == 3


def test_missing_api_key_is_reported_clearly():
    with pytest.raises(ProviderNotConfiguredError):
        provider(lambda r: httpx.Response(200, json=QUOTE), key="").quotes(["AAPL"])


def test_service_caches_and_serves_stale_data_when_provider_fails():
    calls = {"n": 0, "fail": False}

    def handler(request):
        calls["n"] += 1
        return httpx.Response(200, json={"code": 429, "message": "limit", "status": "error"}) if calls["fail"] \
            else httpx.Response(200, json=QUOTE)

    settings = Settings(cache_quote_ttl=0, _env_file=None)  # ttl 0: every call is "expired"
    svc = MarketDataService(provider(handler), settings)
    assert svc.quote("AAPL").stale is False
    calls["fail"] = True
    again = svc.quote("AAPL")
    assert again.stale is True and again.value.price == 185.5  # served from stale cache, UI keeps working

    fresh = MarketDataService(provider(handler), Settings(cache_quote_ttl=600, _env_file=None))
    calls["fail"], calls["n"] = False, 0
    fresh.quote("AAPL"), fresh.quote("AAPL")
    assert calls["n"] == 1  # second call came from cache


def test_credit_limiter_blocks_then_raises():
    limiter = CreditLimiter(2, max_wait=0.05, window=60)
    limiter.acquire(1), limiter.acquire(1)
    with pytest.raises(RateLimitedError) as e:
        limiter.acquire(1)
    assert e.value.retry_after >= 1


def test_credit_limiter_recovers_after_window():
    limiter = CreditLimiter(1, max_wait=2.0, window=0.2)
    limiter.acquire(1)
    limiter.acquire(1)  # waits ~0.2s for the window to free the credit
