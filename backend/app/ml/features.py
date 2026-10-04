"""Feature engineering.

All features are scale-free (ratios, returns, z-like measures) because raw price levels
are non-stationary and would let a model memorise a price range instead of a pattern.

Look-ahead safety: every feature at row ``t`` is computed from rows ``<= t`` only (trailing
rolling windows, ``shift(k)`` with positive ``k``). ``tests/test_ml_features.py`` verifies this
by recomputing features on truncated data and checking the values do not change.
Rows without enough history are NaN and are excluded from training - never imputed.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from app.indicators import core

# key -> (short label, plain-English description)
FEATURE_META: dict[str, tuple[str, str]] = {
    "ret_1": ("1-day return", "Close-to-close return of the latest session."),
    "log_ret_1": ("1-day log return", "Natural-log return of the latest session."),
    "ret_5": ("5-day momentum", "Price change over the last 5 sessions."),
    "ret_10": ("10-day momentum", "Price change over the last 10 sessions."),
    "ret_20": ("20-day momentum", "Price change over the last 20 sessions."),
    "vol_20": ("Volatility (20d)", "Annualised standard deviation of daily log returns over 20 sessions."),
    "vol_ratio": ("Volatility trend", "Short-term (10d) volatility relative to its 60-day level."),
    "price_sma20": ("Price vs SMA 20", "Close relative to the 20-day simple moving average."),
    "price_sma50": ("Price vs SMA 50", "Close relative to the 50-day simple moving average."),
    "price_sma200": ("Price vs SMA 200", "Close relative to the 200-day simple moving average."),
    "sma20_sma50": ("SMA 20 / SMA 50", "Short-term versus medium-term trend alignment."),
    "sma50_sma200": ("SMA 50 / SMA 200", "Medium-term versus long-term trend alignment."),
    "ema20_ema50": ("EMA crossover", "20-day EMA relative to the 50-day EMA."),
    "rsi_14": ("RSI (14)", "Relative Strength Index - speed and size of recent price changes."),
    "macd_norm": ("MACD", "MACD line normalised by price."),
    "macd_hist_norm": ("MACD histogram", "Distance between MACD and its signal line, normalised by price."),
    "bb_pct_b": ("Bollinger %B", "Where the close sits inside the Bollinger Bands (0 = lower, 1 = upper)."),
    "bb_width": ("Bollinger width", "Band width relative to the 20-day average - a volatility gauge."),
    "volume_change": ("Volume change", "Session volume versus the previous session."),
    "volume_ratio": ("Volume vs average", "Session volume relative to its 20-day average."),
    "hl_range": ("High-low range", "Intraday range relative to the close."),
    "atr_norm": ("ATR (14)", "Average True Range relative to the close."),
}
FEATURE_COLUMNS: list[str] = list(FEATURE_META)

# Longest trailing window used by any feature (SMA 200) - minimum history for a full row.
WARMUP_ROWS = 200


def _safe_ratio(a: pd.Series, b: pd.Series) -> pd.Series:
    out = a / b.replace(0.0, np.nan)
    return out.replace([np.inf, -np.inf], np.nan)


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Compute the model feature matrix for an already-cleaned OHLCV frame."""
    close, volume = df["close"], df["volume"]
    feats = pd.DataFrame(index=df.index)

    feats["ret_1"] = close.pct_change(1)
    feats["log_ret_1"] = core.log_returns(close)
    feats["ret_5"] = close.pct_change(5)
    feats["ret_10"] = close.pct_change(10)
    feats["ret_20"] = close.pct_change(20)

    feats["vol_20"] = core.rolling_volatility(close, 20)
    vol_10 = core.rolling_volatility(close, 10)
    vol_60 = core.rolling_volatility(close, 60)
    feats["vol_ratio"] = _safe_ratio(vol_10, vol_60)

    sma20, sma50, sma200 = core.sma(close, 20), core.sma(close, 50), core.sma(close, 200)
    ema20, ema50 = core.ema(close, 20), core.ema(close, 50)
    feats["price_sma20"] = _safe_ratio(close, sma20) - 1
    feats["price_sma50"] = _safe_ratio(close, sma50) - 1
    feats["price_sma200"] = _safe_ratio(close, sma200) - 1
    feats["sma20_sma50"] = _safe_ratio(sma20, sma50) - 1
    feats["sma50_sma200"] = _safe_ratio(sma50, sma200) - 1
    feats["ema20_ema50"] = _safe_ratio(ema20, ema50) - 1

    feats["rsi_14"] = core.rsi(close, 14)
    m = core.macd(close)
    feats["macd_norm"] = _safe_ratio(m["macd"], close)
    feats["macd_hist_norm"] = _safe_ratio(m["macd_hist"], close)
    bb = core.bollinger(close)
    feats["bb_pct_b"] = bb["bb_pct_b"]
    feats["bb_width"] = bb["bb_width"]

    vol_avg = volume.rolling(20, min_periods=20).mean()
    feats["volume_change"] = _safe_ratio(volume, volume.shift(1)) - 1
    feats["volume_ratio"] = _safe_ratio(volume, vol_avg)

    feats["hl_range"] = _safe_ratio(df["high"] - df["low"], close)
    feats["atr_norm"] = _safe_ratio(core.atr(df, 14), close)

    # Zero-volume instruments (e.g. some indices) make the volume features meaningless.
    if (volume > 0).sum() < len(volume) * 0.5:
        feats[["volume_change", "volume_ratio"]] = 0.0

    return feats[FEATURE_COLUMNS].replace([np.inf, -np.inf], np.nan)
