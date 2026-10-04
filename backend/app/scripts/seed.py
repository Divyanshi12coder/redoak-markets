"""Seed a local demo account.

Creates the demo user "Dia" with a small watchlist so the app can be explored straight away.
This seeds *user* data only (account, watchlist, recent analyses). Market prices come from the
configured provider - with MARKET_DATA_PROVIDER=demo they are clearly-labelled synthetic data.

    python -m app.scripts.seed

The credentials below are for local demonstration only; the script refuses to run in production.
"""
from __future__ import annotations

import sys
from datetime import timedelta

from sqlalchemy import select

from app.auth.security import hash_password
from app.config import get_settings
from app.database.base import utcnow
from app.database.session import get_session_factory
from app.models import AnalysisHistory, User, UserPreferences, Watchlist, WatchlistStock

DEMO_NAME = "Dia"
DEMO_EMAIL = "dia@redoak.dev"
DEMO_PASSWORD = "DiaDemo2025!"
DEMO_WATCHLIST = ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN"]
DEMO_HISTORY = ["NVDA", "AAPL", "MSFT"]


def seed() -> str:
    settings = get_settings()
    if settings.is_production:
        raise SystemExit("Refusing to seed demo credentials when ENVIRONMENT=production.")

    with get_session_factory()() as db:
        user = db.scalar(select(User).where(User.email == DEMO_EMAIL))
        if user is not None:
            return f"Demo user {DEMO_EMAIL} already exists - nothing to do."

        user = User(name=DEMO_NAME, email=DEMO_EMAIL, password_hash=hash_password(DEMO_PASSWORD))
        user.watchlist = Watchlist(
            stocks=[WatchlistStock(ticker=t, position=i) for i, t in enumerate(DEMO_WATCHLIST)]
        )
        user.preferences = UserPreferences(default_range="6M", chart_type="candles", indicators=["sma20", "sma50", "ema20", "volume"])
        db.add(user)
        db.flush()
        now = utcnow()
        for i, ticker in enumerate(DEMO_HISTORY):
            db.add(AnalysisHistory(user_id=user.id, ticker=ticker, analyzed_at=now - timedelta(hours=i + 1)))
        db.commit()
    return f"Created demo user '{DEMO_NAME}' ({DEMO_EMAIL} / {DEMO_PASSWORD}) with a {len(DEMO_WATCHLIST)}-stock watchlist."


if __name__ == "__main__":
    print(seed())
    sys.exit(0)
