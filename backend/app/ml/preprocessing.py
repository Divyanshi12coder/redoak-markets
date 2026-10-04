"""Data cleaning for OHLCV frames. Runs before any feature engineering."""
from __future__ import annotations

import numpy as np
import pandas as pd

from app.utils.errors import InsufficientDataError

REQUIRED_COLUMNS = ["open", "high", "low", "close", "volume"]


def clean_ohlcv(df: pd.DataFrame, min_rows: int = 1) -> pd.DataFrame:
    """Return a sorted, de-duplicated, numerically valid OHLCV frame.

    * columns are lower-cased and coerced to numeric
    * inf / non-positive prices are treated as missing; rows with no valid close are dropped
    * missing open/high/low fall back to the close (so range features become 0, not NaN)
    * high/low are widened to contain open and close
    * missing or negative volume becomes 0
    Only information from the bar itself is used, so no look-ahead can be introduced.
    """
    out = df.copy()
    out.columns = [str(c).lower() for c in out.columns]
    missing = [c for c in REQUIRED_COLUMNS if c not in out.columns]
    if missing:
        raise InsufficientDataError(f"Price data is missing required columns: {', '.join(missing)}")

    out = out[REQUIRED_COLUMNS].apply(pd.to_numeric, errors="coerce").replace([np.inf, -np.inf], np.nan)
    out = out[~out.index.duplicated(keep="last")].sort_index()

    for col in ("open", "high", "low", "close"):
        out.loc[out[col] <= 0, col] = np.nan
    out = out.dropna(subset=["close"])
    for col in ("open", "high", "low"):
        out[col] = out[col].fillna(out["close"])
    out["high"] = out[["high", "open", "close"]].max(axis=1)
    out["low"] = out[["low", "open", "close"]].min(axis=1)
    out["volume"] = out["volume"].fillna(0.0).clip(lower=0.0)

    if len(out) < min_rows:
        raise InsufficientDataError(
            f"Only {len(out)} valid price bars are available; at least {min_rows} are required."
        )
    return out
