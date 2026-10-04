"""HTTP-level tests for the market / analysis endpoints (served by the demo provider)."""
import pytest


def test_health(client):
    body = client.get("/api/health").json()
    assert body["status"] == "ok" and body["database"] == "ok"
    assert body["market_data"] == {"provider": "demo", "configured": True, "synthetic": True}
    assert body["llm_enabled"] is False


def test_openapi_docs_available(client):
    assert client.get("/api/docs").status_code == 200
    spec = client.get("/api/openapi.json").json()
    for path in ("/api/stocks/{ticker}/ml-analysis", "/api/watchlist", "/api/auth/login", "/api/market/overview"):
        assert path in spec["paths"]


def test_search_by_ticker_and_name(client):
    by_ticker = client.get("/api/stocks/search", params={"q": "aapl"}).json()
    assert by_ticker["results"][0]["ticker"] == "AAPL"
    assert by_ticker["results"][0]["price"] > 0 and "change_percent" in by_ticker["results"][0]
    by_name = client.get("/api/stocks/search", params={"q": "microsoft"}).json()
    assert by_name["results"][0]["ticker"] == "MSFT" and by_name["results"][0]["exchange"] == "NASDAQ"
    assert client.get("/api/stocks/search", params={"q": "qqqqqzzzz"}).json()["results"] == []
    assert client.get("/api/stocks/search").status_code == 422


def test_quote_labels_demo_data(client):
    q = client.get("/api/stocks/aapl").json()
    assert q["ticker"] == "AAPL" and q["price"] > 0
    assert q["meta"]["source"] == "demo" and "DEMO" in q["meta"]["data_note"]


def test_unknown_and_invalid_tickers(client):
    r = client.get("/api/stocks/ZZZZ")
    assert r.status_code == 404 and r.json()["error"]["code"] == "symbol_not_found"
    r = client.get("/api/stocks/bad$ticker")
    assert r.status_code == 422


@pytest.mark.parametrize("rng,interval", [("1D", "5min"), ("5D", "30min"), ("1M", "1day"), ("6M", "1day"), ("5Y", "1day")])
def test_history_ranges(client, rng, interval):
    body = client.get("/api/stocks/AAPL/history", params={"range": rng}).json()
    assert body["interval"] == interval and body["range"] == rng
    candles = body["candles"]
    assert len(candles) > 5
    ts = [c["t"] for c in candles]
    assert ts == sorted(ts) and len(set(ts)) == len(ts)
    assert all(c["l"] <= c["o"] <= c["h"] and c["l"] <= c["c"] <= c["h"] for c in candles)


def test_history_range_sizes_grow(client):
    sizes = [len(client.get("/api/stocks/MSFT/history", params={"range": r}).json()["candles"]) for r in ("1M", "3M", "1Y", "5Y")]
    assert sizes == sorted(sizes) and sizes[0] < sizes[-1]
    assert client.get("/api/stocks/MSFT/history", params={"range": "7Y"}).status_code == 422


def test_indicators_endpoint(client):
    body = client.get("/api/stocks/NVDA/indicators", params={"range": "1Y"}).json()
    n = len(body["t"])
    assert n > 200 and all(len(v) == n for v in body["series"].values())
    assert body["series"]["sma200"][0] is not None  # warm-up comes from data before the visible window
    assert 0 <= body["latest"]["rsi14"] <= 100
    short = client.get("/api/stocks/NVDA/indicators", params={"range": "1D"}).json()
    assert short["range_used"] == "1M"


def test_analysis_endpoint(client):
    body = client.get("/api/stocks/TSLA/analysis").json()
    assert body["signal"]["label"] in {"Bullish signal", "Bearish signal", "Neutral"}
    assert 0 <= body["signal"]["position"] <= 1
    assert set(body["components"]) == {"rsi", "moving_average", "momentum"}
    assert body["rules"] and "financial advice" in body["disclaimer"]


def test_ml_analysis_contract(client):
    body = client.get("/api/stocks/AAPL/ml-analysis").json()
    cls = body["classification"]
    assert cls["regime"] in {"bullish", "bearish", "neutral"}
    assert sum(cls["probabilities"].values()) == pytest.approx(1.0, abs=1e-2)
    assert "not the probability that the price will rise" in cls["confidence_note"]
    ev = body["evaluation"]
    assert {"accuracy", "precision_macro", "recall_macro", "f1_macro", "roc_auc_ovr", "confusion_matrix", "baseline_accuracy"} <= ev.keys()
    assert body["model"]["version"].startswith("rf-v1-") and "walk-forward" in ev["validation"]
    assert body["feature_importance"]["global"] and body["feature_importance"]["local"]
    assert body["regime"]["volatility"]["label"] in {"Low", "Moderate", "High"}
    assert body["dia"]["source"] == "template" and body["dia"]["summary"]
    assert "not a prediction" in body["disclaimer"]
    assert any("SIGNAL" in b["label"] for b in body["badges"])


def test_ml_subresources_share_the_same_model(client):
    full = client.get("/api/stocks/MSFT/ml-analysis").json()
    regime = client.get("/api/stocks/MSFT/regime").json()
    anomalies = client.get("/api/stocks/MSFT/anomalies").json()
    importance = client.get("/api/stocks/MSFT/feature-importance").json()
    assert regime["classification"] == full["classification"]
    assert anomalies["anomalies"]["headline"] == full["anomalies"]["headline"]
    assert importance["model_version"] == full["model"]["version"]
    assert importance["predicted_class"] == full["classification"]["regime"]


def test_market_overview(client):
    body = client.get("/api/market/overview").json()
    assert [i["ticker"] for i in body["indices"]] == ["SPY", "QQQ", "DIA", "IWM"]
    assert body["gainers"] == sorted(body["gainers"], key=lambda q: -q["change_percent"])
    assert body["losers"] == sorted(body["losers"], key=lambda q: q["change_percent"])
    assert body["total_volume"] > 0 and body["meta"]["source"] == "demo"
    assert body["advancers"] + body["decliners"] <= body["universe_size"]


def test_compare(client):
    body = client.get("/api/compare", params={"tickers": "AAPL,MSFT,NVDA", "range": "6M"}).json()
    assert body["tickers"] == ["AAPL", "MSFT", "NVDA"]
    assert all(body["performance"][t][0] == 100.0 for t in body["tickers"])  # rebased
    assert all(len(v) == len(body["t"]) for v in body["performance"].values())
    row = body["table"][0]
    assert {"price", "change_percent", "volume", "rsi14", "sma50", "ema20", "signal", "range_return_percent"} <= row.keys()


def test_compare_validates_selection(client):
    assert client.get("/api/compare", params={"tickers": "AAPL"}).status_code == 422
    assert client.get("/api/compare", params={"tickers": "AAPL,AAPL"}).status_code == 422
    assert client.get("/api/compare", params={"tickers": "A,B,C,D,E"}).status_code == 422
    assert client.get("/api/compare", params={"tickers": "AAPL,MSFT", "range": "1D"}).status_code == 422


def test_cors_allows_configured_origin_only(client):
    ok = client.options("/api/health", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    bad = client.options("/api/health", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in bad.headers


def test_security_headers_present(client):
    r = client.get("/api/health")
    assert r.headers["x-content-type-options"] == "nosniff" and r.headers["x-frame-options"] == "DENY"
