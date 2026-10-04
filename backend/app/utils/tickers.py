"""Ticker normalisation and validation."""
from __future__ import annotations

import re

from app.utils.errors import InvalidTickerError

_TICKER_RE = re.compile(r"^[A-Z0-9][A-Z0-9.\-]{0,9}$")


def normalise_ticker(raw: str) -> str:
    ticker = raw.strip().upper()
    if not _TICKER_RE.match(ticker):
        raise InvalidTickerError(f"'{raw}' is not a valid ticker symbol")
    return ticker
