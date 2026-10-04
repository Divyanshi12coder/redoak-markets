"""Anomaly detection for unusual price, volume and volatility activity.

Two complementary detectors, both using only information available at each session:

1. Rolling robust z-scores (median / MAD over the *previous* ``window`` sessions, so the
   session being tested never contaminates its own baseline).
2. An Isolation Forest fitted on history *older* than the evaluation period, used to
   confirm multivariate oddness (e.g. a moderately large move combined with moderate volume).

An anomaly only says recent activity was statistically unusual compared with the stock's
own history. It carries no information about the direction of future prices.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

WINDOW = 60
Z_THRESHOLD = 3.0
ISO_CONFIRM_Z = 2.0
EVAL_SESSIONS = 60  # how far back anomalies are reported
HEADLINE_SESSIONS = 3  # "current" anomaly = flagged within the latest N sessions
MIN_ROWS = WINDOW + 40

NOTE = (
    "An anomaly means recent activity was statistically unusual compared with this stock's own "
    "history. It does not indicate whether the price will rise or fall."
)


def _robust_z(x: pd.Series, window: int = WINDOW) -> pd.Series:
    """z-score of x_t against the median / MAD of the previous ``window`` observations."""
    prev = x.shift(1)
    med = prev.rolling(window, min_periods=window).median()
    mad = prev.rolling(window, min_periods=window).apply(
        lambda a: np.median(np.abs(a - np.median(a))), raw=True
    )
    scale = (1.4826 * mad).where(lambda s: s > 1e-12)
    return (x - med) / scale


def anomaly_frame(df: pd.DataFrame) -> pd.DataFrame:
    close = df["close"]
    ret = close.pct_change()
    rng = (df["high"] - df["low"]) / close
    has_volume = (df["volume"] > 0).mean() >= 0.5
    log_vol = np.log1p(df["volume"]) if has_volume else pd.Series(0.0, index=df.index)

    out = pd.DataFrame(index=df.index)
    out["z_price"] = _robust_z(ret)
    out["z_volume"] = _robust_z(log_vol) if has_volume else np.nan
    out["z_range"] = _robust_z(rng)
    out["_ret"] = ret
    out["_logvol"] = log_vol
    out["_rng"] = rng
    out["_volchg"] = ret.abs().rolling(5, min_periods=5).mean() / ret.abs().rolling(20, min_periods=20).mean().replace(0, np.nan)
    return out


def _iso_flags(frame: pd.DataFrame, eval_sessions: int, seed: int = 7) -> tuple[pd.Series, bool]:
    cols = ["_ret", "_logvol", "_rng", "_volchg"]
    data = frame[cols].replace([np.inf, -np.inf], np.nan).dropna()
    if len(data) < 120 + eval_sessions:
        return pd.Series(False, index=frame.index), False
    cutoff = data.index[-eval_sessions]
    train = data[data.index < cutoff].iloc[-500:]
    test = data[data.index >= cutoff]
    # standardise with training statistics only
    mu, sd = train.mean(), train.std(ddof=0).replace(0, 1.0)
    forest = IsolationForest(n_estimators=150, contamination=0.02, random_state=seed, n_jobs=1)
    forest.fit(((train - mu) / sd).to_numpy())
    pred = forest.predict(((test - mu) / sd).to_numpy())
    flags = pd.Series(False, index=frame.index)
    flags.loc[test.index] = pred == -1
    return flags, True


def detect_anomalies(df: pd.DataFrame, eval_sessions: int = EVAL_SESSIONS) -> dict:
    if len(df) < MIN_ROWS:
        return {
            "available": False,
            "headline": "Not enough history for anomaly detection",
            "detected": False, "kinds": [], "events": [], "note": NOTE,
            "methods": ["Rolling robust z-score", "Isolation Forest"],
        }

    frame = anomaly_frame(df)
    iso, iso_used = _iso_flags(frame, eval_sessions)
    recent = frame.iloc[-eval_sessions:]

    events = []
    for ts, row in recent.iterrows():
        zs = {"price": row["z_price"], "volume": row["z_volume"], "volatility": row["z_range"]}
        zs = {k: (None if pd.isna(v) else float(v)) for k, v in zs.items()}
        strong = [k for k, v in zs.items() if v is not None and abs(v) >= Z_THRESHOLD]
        # Volume only matters when it is *unusually high*, not unusually quiet.
        strong = [k for k in strong if not (k == "volume" and zs[k] < 0)]
        iso_flag = bool(iso.loc[ts])
        kinds = strong
        if not kinds and iso_flag:
            cand = {k: abs(v) for k, v in zs.items() if v is not None and abs(v) >= ISO_CONFIRM_Z}
            if cand:
                kinds = [max(cand, key=cand.get)]
        if kinds:
            events.append({
                "t": int(pd.Timestamp(ts).timestamp()),
                "date": pd.Timestamp(ts).strftime("%Y-%m-%d"),
                "kinds": kinds,
                "z_price": None if zs["price"] is None else round(zs["price"], 2),
                "z_volume": None if zs["volume"] is None else round(zs["volume"], 2),
                "z_volatility": None if zs["volatility"] is None else round(zs["volatility"], 2),
                "isolation_forest_flag": iso_flag,
                "return_pct": round(float(row["_ret"]) * 100, 2),
            })

    latest_cutoff = pd.Timestamp(recent.index[-HEADLINE_SESSIONS]).strftime("%Y-%m-%d")
    current = [e for e in events if e["date"] >= latest_cutoff]  # ISO dates sort lexicographically
    kinds = sorted({k for e in current for k in e["kinds"]})
    if not kinds:
        headline = "No Significant Anomaly Detected"
    elif kinds == ["volume"]:
        headline = "Unusual Volume Activity Detected"
    elif kinds == ["price"]:
        headline = "Unusual Price Movement Detected"
    elif kinds == ["volatility"]:
        headline = "Unusual Volatility Detected"
    else:
        headline = "Unusual " + " & ".join(k.capitalize() for k in kinds) + " Activity Detected"

    return {
        "available": True,
        "headline": headline,
        "detected": bool(kinds),
        "kinds": kinds,
        "events": events[::-1],  # most recent first
        "window_sessions": eval_sessions,
        "z_threshold": Z_THRESHOLD,
        "isolation_forest_used": iso_used,
        "methods": ["Rolling robust z-score (median/MAD)"] + (["Isolation Forest"] if iso_used else []),
        "note": NOTE,
    }
