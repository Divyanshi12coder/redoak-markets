"""Descriptive market-regime measurements, all derived from calculated features.

These are descriptive statistics of recent behaviour (is price trending or chopping? is
volatility high relative to its own history?). They are not forecasts.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

ER_WINDOW = 20
ER_TRENDING = 0.30
VOL_HISTORY = 252


def efficiency_ratio(close: pd.Series, window: int = ER_WINDOW) -> float | None:
    """Kaufman efficiency ratio: net move / total path length. 1 = straight line, 0 = pure chop."""
    if len(close) <= window:
        return None
    seg = close.iloc[-(window + 1):]
    path = seg.diff().abs().sum()
    if path == 0:
        return 0.0
    return float(abs(seg.iloc[-1] - seg.iloc[0]) / path)


def describe_regime(df: pd.DataFrame, feats: pd.DataFrame, model_class: str) -> dict:
    last = feats.iloc[-1]
    close = df["close"]

    er = efficiency_ratio(close)
    character = "Trending" if er is not None and er >= ER_TRENDING else "Sideways"

    # volatility regime: where does current vol sit within its own trailing year?
    vol_hist = feats["vol_20"].dropna().iloc[-VOL_HISTORY:]
    vol_now = float(last["vol_20"])
    percentile = float((vol_hist <= vol_now).mean() * 100) if len(vol_hist) else float("nan")
    if np.isnan(percentile):
        vol_label = "Unknown"
    elif percentile >= 67:
        vol_label = "High"
    elif percentile <= 33:
        vol_label = "Low"
    else:
        vol_label = "Moderate"

    # momentum: 10-day move measured in units of its expected size (z-score)
    daily_sigma = vol_now / np.sqrt(252)
    z = float(last["ret_10"] / (daily_sigma * np.sqrt(10))) if daily_sigma > 0 else 0.0
    strength = "Strong" if abs(z) >= 1.0 else "Moderate" if abs(z) >= 0.4 else "Weak"
    direction = "Positive" if z > 0.05 else "Negative" if z < -0.05 else "Flat"

    ratio = float(last["volume_ratio"])
    if ratio >= 1.3:
        vol_state = "Above average"
    elif ratio <= 0.7:
        vol_state = "Below average"
    else:
        vol_state = "Average"

    return {
        "trend": {"label": model_class.capitalize(), "source": "ML classification"},
        "character": {"label": character, "efficiency_ratio": None if er is None else round(er, 3)},
        "momentum": {"label": strength, "direction": direction, "z_score": round(z, 2)},
        "volatility": {
            "label": vol_label,
            "annualised": round(vol_now, 4),
            "percentile": None if np.isnan(percentile) else round(percentile, 1),
        },
        "volume": {"label": vol_state, "ratio_to_20d_avg": round(ratio, 2)},
    }
