"""Test fixtures: in-memory SQLite, demo market provider, isolated services."""
from __future__ import annotations

import os

# Must be set before the app (and its cached settings) is imported.
os.environ.setdefault("ENVIRONMENT", "test")
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["MARKET_DATA_PROVIDER"] = "demo"
os.environ["MARKET_DATA_API_KEY"] = ""
os.environ["LLM_API_KEY"] = ""
os.environ["ML_PERSIST_MODELS"] = "false"
os.environ["JWT_SECRET"] = "test-secret-test-secret-test-secret-123456"

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.api import auth as auth_api
from app.database.base import Base
from app.database.session import get_db, make_engine
from app.main import app
from app.services.container import reset_services


@pytest.fixture()
def db_session_factory():
    engine = make_engine("sqlite://")
    from app import models  # noqa: F401

    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    yield factory
    engine.dispose()


@pytest.fixture()
def client(db_session_factory):
    def override_db():
        db = db_session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_db
    auth_api.reset_limiter()
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def _fresh_services():
    reset_services()
    yield
    reset_services()


@pytest.fixture()
def auth_headers(client):
    r = client.post("/api/auth/register", json={"name": "Dia Demo", "email": "dia@example.com", "password": "correct-horse-battery"})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def make_ohlcv(n: int = 600, seed: int = 0, drift: float = 0.0004, vol: float = 0.012) -> pd.DataFrame:
    """Deterministic synthetic OHLCV frame for unit tests."""
    rng = np.random.default_rng(seed)
    rets = rng.normal(drift, vol, n)
    close = 100 * np.exp(np.cumsum(rets))
    open_ = np.concatenate([[100.0], close[:-1]]) * (1 + rng.normal(0, 0.002, n))
    high = np.maximum(open_, close) * (1 + np.abs(rng.normal(0, 0.004, n)))
    low = np.minimum(open_, close) * (1 - np.abs(rng.normal(0, 0.004, n)))
    volume = rng.lognormal(15, 0.3, n).round()
    idx = pd.bdate_range("2020-01-01", periods=n, tz="UTC")
    return pd.DataFrame({"open": open_, "high": high, "low": low, "close": close, "volume": volume}, index=idx)


@pytest.fixture()
def ohlcv() -> pd.DataFrame:
    return make_ohlcv()
