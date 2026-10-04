"""Transparent, rule-based technical signals.

Every rule is listed in ``RULE_DESCRIPTIONS`` and returns a score in [-1, 1]. The overall
signal is a weighted mean of the rule scores. Nothing here predicts prices: it describes the
*current state* of well-known indicators.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np
import pandas as pd

BULL_THRESHOLD = 0.25
BEAR_THRESHOLD = -0.25
RSI_OVERBOUGHT = 70.0
RSI_OVERSOLD = 30.0
CROSS_LOOKBACK = 5  # sessions within which a crossover is reported as "recent"


@dataclass
class Rule:
    key: str
    group: str  # "trend" | "momentum" | "rsi"
    score: float
    label: str
    detail: str
    weight: float


def _label(score: float) -> str:
    if score >= BULL_THRESHOLD:
        return "Bullish signal"
    if score <= BEAR_THRESHOLD:
        return "Bearish signal"
    return "Neutral"


def _last(s: pd.Series) -> float | None:
    s = s.dropna()
    return float(s.iloc[-1]) if len(s) else None


def _recent_cross(fast: pd.Series, slow: pd.Series, lookback: int = CROSS_LOOKBACK) -> int:
    """+1 if fast crossed above slow within the last ``lookback`` bars, -1 if below, else 0."""
    diff = (fast - slow).dropna()
    if len(diff) < 2:
        return 0
    sign = np.sign(diff.to_numpy())
    window = sign[-(lookback + 1):]
    for i in range(len(window) - 1, 0, -1):
        if window[i] != window[i - 1] and window[i] != 0:
            return int(window[i])
    return 0


def evaluate_rules(df: pd.DataFrame, ind: pd.DataFrame) -> list[Rule]:
    close = _last(df["close"])
    rules: list[Rule] = []
    if close is None:
        return rules

    # --- trend: price vs SMA ------------------------------------------------
    for key, weight in (("sma20", 1.0), ("sma50", 1.5), ("sma200", 1.5)):
        v = _last(ind[key])
        if v is None:
            continue
        n = key.replace("sma", "")
        above = close > v
        pct = (close / v - 1) * 100
        rules.append(Rule(
            key=f"price_vs_{key}", group="trend", weight=weight,
            score=1.0 if above else -1.0,
            label="Bullish signal" if above else "Bearish signal",
            detail=f"Price is {abs(pct):.1f}% {'above' if above else 'below'} the {n}-day SMA.",
        ))

    # --- SMA 50 / 200 relationship + recent cross ---------------------------
    s50, s200 = _last(ind["sma50"]), _last(ind["sma200"])
    if s50 is not None and s200 is not None:
        cross = _recent_cross(ind["sma50"], ind["sma200"], lookback=10)
        if cross == 1:
            rules.append(Rule("sma_50_200_cross", "trend", 1.0, "Bullish signal",
                              "The 50-day SMA recently crossed above the 200-day SMA (a 'golden cross').", 1.0))
        elif cross == -1:
            rules.append(Rule("sma_50_200_cross", "trend", -1.0, "Bearish signal",
                              "The 50-day SMA recently crossed below the 200-day SMA (a 'death cross').", 1.0))
        else:
            above = s50 > s200
            rules.append(Rule("sma_50_200", "trend", 0.5 if above else -0.5,
                              "Bullish signal" if above else "Bearish signal",
                              f"The 50-day SMA is {'above' if above else 'below'} the 200-day SMA.", 1.0))

    # --- EMA 20 / 50 -------------------------------------------------------
    e20, e50 = _last(ind["ema20"]), _last(ind["ema50"])
    if e20 is not None and e50 is not None:
        cross = _recent_cross(ind["ema20"], ind["ema50"])
        if cross == 1:
            rules.append(Rule("ema_cross", "momentum", 1.0, "Momentum strengthening",
                              "The 20-day EMA recently crossed above the 50-day EMA.", 1.5))
        elif cross == -1:
            rules.append(Rule("ema_cross", "momentum", -1.0, "Momentum weakening",
                              "The 20-day EMA recently crossed below the 50-day EMA.", 1.5))
        else:
            above = e20 > e50
            rules.append(Rule("ema_state", "momentum", 0.5 if above else -0.5,
                              "Bullish signal" if above else "Bearish signal",
                              f"The 20-day EMA is {'above' if above else 'below'} the 50-day EMA.", 1.0))

    # --- MACD histogram ----------------------------------------------------
    hist = ind["macd_hist"].dropna()
    if len(hist) >= 2:
        h, h_prev = float(hist.iloc[-1]), float(hist.iloc[-2])
        improving = h > h_prev
        if h > 0:
            label, score = ("Momentum strengthening", 1.0) if improving else ("Bullish signal", 0.5)
            detail = f"MACD is above its signal line and the histogram is {'rising' if improving else 'fading'}."
        else:
            label, score = ("Bearish signal", -1.0) if not improving else ("Momentum weakening", -0.5)
            detail = f"MACD is below its signal line and the histogram is {'rising' if improving else 'falling'}."
        rules.append(Rule("macd", "momentum", score, label, detail, 1.0))

    # --- RSI --------------------------------------------------------------
    r = _last(ind["rsi14"])
    if r is not None:
        if r >= RSI_OVERBOUGHT:
            rules.append(Rule("rsi", "rsi", -0.5, "Potentially overbought",
                              f"RSI(14) is {r:.1f}, above the traditional {RSI_OVERBOUGHT:.0f} threshold.", 1.0))
        elif r <= RSI_OVERSOLD:
            rules.append(Rule("rsi", "rsi", 0.5, "Potentially oversold",
                              f"RSI(14) is {r:.1f}, below the traditional {RSI_OVERSOLD:.0f} threshold.", 1.0))
        else:
            score = float(np.clip((r - 50.0) / 20.0, -0.5, 0.5))
            rules.append(Rule("rsi", "rsi", score, "Neutral",
                              f"RSI(14) is {r:.1f}, between the oversold ({RSI_OVERSOLD:.0f}) and "
                              f"overbought ({RSI_OVERBOUGHT:.0f}) thresholds.", 1.0))
    return rules


def _group_summary(rules: list[Rule], group: str, empty: str) -> dict:
    items = [r for r in rules if r.group == group]
    if not items:
        return {"score": 0.0, "label": "Insufficient data", "detail": empty}
    score = sum(r.score * r.weight for r in items) / sum(r.weight for r in items)
    top = max(items, key=lambda r: abs(r.score) * r.weight)
    if group == "rsi":
        label = top.label
    else:
        label = _label(score)
    return {"score": round(score, 3), "label": label, "detail": top.detail}


def build_signal_summary(df: pd.DataFrame, ind: pd.DataFrame) -> dict:
    rules = evaluate_rules(df, ind)
    if not rules:
        return {
            "overall": {"score": 0.0, "label": "Insufficient data", "position": 0.5},
            "components": {}, "rules": [],
        }
    total_w = sum(r.weight for r in rules)
    score = float(sum(r.score * r.weight for r in rules) / total_w)
    return {
        "overall": {"score": round(score, 3), "label": _label(score), "position": round((score + 1) / 2, 3)},
        "components": {
            "rsi": _group_summary(rules, "rsi", "Not enough history for RSI."),
            "moving_average": _group_summary(rules, "trend", "Not enough history for moving averages."),
            "momentum": _group_summary(rules, "momentum", "Not enough history for momentum."),
        },
        "rules": [asdict(r) for r in rules],
    }


RULE_DESCRIPTIONS = [
    "Price above / below SMA 20, 50 and 200 (trend)",
    "SMA 50 vs SMA 200, with golden / death cross detection in the last 10 sessions",
    "EMA 20 vs EMA 50, with crossover detection in the last 5 sessions (momentum)",
    "MACD histogram sign and direction (momentum)",
    "RSI(14) vs the traditional 30 / 70 thresholds",
]
