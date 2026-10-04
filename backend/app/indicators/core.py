"""Technical indicators implemented with pandas / numpy.

Every function is *causal*: the value at row ``t`` only uses rows ``<= t``. Rows without
enough history are ``NaN`` (never back-filled), so downstream code can never silently
use partially-warmed-up values.
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def sma(close: pd.Series, window: int) -> pd.Series:
    """Simple moving average."""
    return close.rolling(window=window, min_periods=window).mean()


def ema(close: pd.Series, span: int) -> pd.Series:
    """Exponential moving average with smoothing factor 2 / (span + 1).

    ``adjust=False`` gives the recursive form used by charting platforms:
    ``ema_t = alpha * x_t + (1 - alpha) * ema_{t-1}``.
    """
    return close.ewm(span=span, adjust=False, min_periods=span).mean()


def _wilder_smooth(values: np.ndarray, period: int) -> np.ndarray:
    """Wilder's smoothing: seed with the simple mean of the first ``period`` values,
    then ``s_t = (s_{t-1} * (period - 1) + x_t) / period``. NaNs before the seed."""
    out = np.full(len(values), np.nan)
    if len(values) < period:
        return out
    seed_slice = values[:period]
    if np.isnan(seed_slice).any():
        return out
    out[period - 1] = seed_slice.mean()
    for i in range(period, len(values)):
        x = values[i]
        prev = out[i - 1]
        out[i] = prev if np.isnan(x) else (prev * (period - 1) + x) / period
    return out


def rsi(close: pd.Series, period: int = 14) -> pd.Series:
    """Relative Strength Index using Wilder's smoothing (range 0-100)."""
    delta = close.diff()
    gains = delta.clip(lower=0.0).to_numpy(dtype=float)
    losses = (-delta.clip(upper=0.0)).to_numpy(dtype=float)
    # first element of diff is NaN -> seed from index 1
    avg_gain = np.full(len(close), np.nan)
    avg_loss = np.full(len(close), np.nan)
    avg_gain[1:] = _wilder_smooth(gains[1:], period)
    avg_loss[1:] = _wilder_smooth(losses[1:], period)

    with np.errstate(divide="ignore", invalid="ignore"):
        rs = avg_gain / avg_loss
        out = 100.0 - 100.0 / (1.0 + rs)
    # No losses at all -> RSI 100; no movement at all -> neutral 50.
    out = np.where((avg_loss == 0) & (avg_gain > 0), 100.0, out)
    out = np.where((avg_loss == 0) & (avg_gain == 0), 50.0, out)
    return pd.Series(out, index=close.index, name=f"rsi_{period}")


def macd(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> pd.DataFrame:
    """MACD line, signal line and histogram."""
    line = ema(close, fast) - ema(close, slow)
    sig = line.ewm(span=signal, adjust=False, min_periods=signal).mean()
    return pd.DataFrame({"macd": line, "macd_signal": sig, "macd_hist": line - sig})


def bollinger(close: pd.Series, window: int = 20, num_std: float = 2.0) -> pd.DataFrame:
    """Bollinger Bands, %B position inside the bands and relative band width."""
    mid = sma(close, window)
    std = close.rolling(window=window, min_periods=window).std(ddof=0)
    upper = mid + num_std * std
    lower = mid - num_std * std
    width = (upper - lower) / mid
    band = (upper - lower).replace(0.0, np.nan)
    pct_b = (close - lower) / band
    return pd.DataFrame({"bb_mid": mid, "bb_upper": upper, "bb_lower": lower, "bb_width": width, "bb_pct_b": pct_b})


def true_range(df: pd.DataFrame) -> pd.Series:
    prev_close = df["close"].shift(1)
    ranges = pd.concat(
        [df["high"] - df["low"], (df["high"] - prev_close).abs(), (df["low"] - prev_close).abs()], axis=1
    )
    # first bar has no previous close: fall back to high-low
    return ranges.max(axis=1, skipna=True)


def atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """Average True Range (Wilder)."""
    tr = true_range(df).to_numpy(dtype=float)
    return pd.Series(_wilder_smooth(tr, period), index=df.index, name=f"atr_{period}")


def log_returns(close: pd.Series) -> pd.Series:
    return np.log(close / close.shift(1))


def rolling_volatility(close: pd.Series, window: int = 20, annualise: bool = True) -> pd.Series:
    """Rolling standard deviation of log returns (annualised by sqrt(252) by default)."""
    vol = log_returns(close).rolling(window=window, min_periods=window).std(ddof=1)
    return vol * np.sqrt(252) if annualise else vol


# Indicator catalogue exposed through the API ---------------------------------
OVERLAYS = {
    "sma20": lambda c: sma(c, 20),
    "sma50": lambda c: sma(c, 50),
    "sma200": lambda c: sma(c, 200),
    "ema20": lambda c: ema(c, 20),
    "ema50": lambda c: ema(c, 50),
}


def compute_indicator_frame(df: pd.DataFrame) -> pd.DataFrame:
    """All display indicators for an OHLCV frame (index preserved)."""
    close = df["close"]
    out = pd.DataFrame(index=df.index)
    for key, fn in OVERLAYS.items():
        out[key] = fn(close)
    out["rsi14"] = rsi(close, 14)
    out = out.join(macd(close))
    out = out.join(bollinger(close))
    out["atr14"] = atr(df, 14)
    return out
