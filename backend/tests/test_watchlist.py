from sqlalchemy import select

from app.models import AnalysisHistory, MlAnalysis, Watchlist, WatchlistStock


def add(client, headers, ticker):
    return client.post("/api/watchlist", json={"ticker": ticker}, headers=headers)


def tickers(client, headers):
    return [i["ticker"] for i in client.get("/api/watchlist", headers=headers).json()["items"]]


def test_empty_watchlist(client, auth_headers):
    r = client.get("/api/watchlist", headers=auth_headers)
    assert r.status_code == 200 and r.json()["items"] == []


def test_add_list_remove_flow_with_quotes(client, auth_headers):
    assert add(client, auth_headers, "aapl").status_code == 201
    assert add(client, auth_headers, "MSFT").status_code == 201
    body = client.get("/api/watchlist", headers=auth_headers).json()
    assert [i["ticker"] for i in body["items"]] == ["AAPL", "MSFT"]
    assert body["items"][0]["quote"]["price"] > 0 and body["meta"]["source"] == "demo"

    assert client.delete("/api/watchlist/AAPL", headers=auth_headers).status_code == 204
    assert tickers(client, auth_headers) == ["MSFT"]
    assert client.delete("/api/watchlist/AAPL", headers=auth_headers).status_code == 404


def test_duplicate_and_unknown_symbols(client, auth_headers):
    assert add(client, auth_headers, "NVDA").status_code == 201
    assert add(client, auth_headers, "NVDA").status_code == 409
    assert add(client, auth_headers, "ZZZZ").status_code == 404  # provider says it does not exist
    assert add(client, auth_headers, "bad ticker!").status_code == 422


def test_reorder_persists(client, auth_headers):
    for t in ("AAPL", "MSFT", "NVDA"):
        add(client, auth_headers, t)
    r = client.put("/api/watchlist/order", json={"tickers": ["NVDA", "AAPL", "MSFT"]}, headers=auth_headers)
    assert r.status_code == 200
    assert tickers(client, auth_headers) == ["NVDA", "AAPL", "MSFT"]
    bad = client.put("/api/watchlist/order", json={"tickers": ["NVDA", "AAPL"]}, headers=auth_headers)
    assert bad.status_code == 422
    assert tickers(client, auth_headers) == ["NVDA", "AAPL", "MSFT"]


def test_positions_stay_contiguous_after_delete(client, auth_headers, db_session_factory):
    for t in ("AAPL", "MSFT", "NVDA"):
        add(client, auth_headers, t)
    client.delete("/api/watchlist/MSFT", headers=auth_headers)
    with db_session_factory() as db:
        rows = db.scalars(select(WatchlistStock).order_by(WatchlistStock.position)).all()
        assert [(r.ticker, r.position) for r in rows] == [("AAPL", 0), ("NVDA", 1)]


def test_watchlists_are_private_per_user(client, auth_headers):
    add(client, auth_headers, "AAPL")
    other = client.post("/api/auth/register", json={"name": "Other", "email": "o@example.com", "password": "another-password"})
    other_headers = {"Authorization": f"Bearer {other.json()['access_token']}"}
    assert tickers(client, other_headers) == []
    assert tickers(client, auth_headers) == ["AAPL"]


def test_data_survives_a_new_session(client, auth_headers, db_session_factory):
    add(client, auth_headers, "TSLA")
    with db_session_factory() as db:  # independent session == data is really in the database
        assert [s.ticker for s in db.scalars(select(WatchlistStock)).all()] == ["TSLA"]
        assert db.scalar(select(Watchlist)) is not None


def test_analysis_and_ml_history_are_persisted(client, auth_headers, db_session_factory):
    assert client.get("/api/stocks/AAPL/analysis", headers=auth_headers).status_code == 200
    client.get("/api/stocks/AAPL/analysis", headers=auth_headers)  # deduplicated within the window
    client.get("/api/stocks/MSFT/analysis", headers=auth_headers)
    assert client.get("/api/stocks/AAPL/ml-analysis", headers=auth_headers).status_code == 200
    with db_session_factory() as db:
        assert len(db.scalars(select(AnalysisHistory)).all()) == 2
        row = db.scalar(select(MlAnalysis))
        assert row.ticker == "AAPL" and row.model_version.startswith("rf-v1-") and row.data_source == "demo"
        assert 0 < row.confidence <= 1
    profile = client.get("/api/user/profile", headers=auth_headers).json()
    assert profile["recent_tickers"][0] == "MSFT"
    ml_hist = client.get("/api/user/ml-history", headers=auth_headers).json()
    assert ml_hist[0]["ticker"] == "AAPL"


def test_anonymous_analysis_does_not_store_history(client, db_session_factory):
    assert client.get("/api/stocks/AAPL/analysis").status_code == 200
    with db_session_factory() as db:
        assert db.scalars(select(AnalysisHistory)).all() == []
