"""Orchestration of market data, indicators, signals, ML and Dia into API payloads."""
from __future__ import annotations

from datetime import datetime, timezone

import numpy as np
import pandas as pd

from app.indicators import core
from app.indicators.core import compute_indicator_frame
from app.indicators.signals import RULE_DESCRIPTIONS, build_signal_summary
from app.ml import anomaly as anomaly_mod
from app.ml.predict import ModelRegistry, feature_importance, local_contributions, predict_latest
from app.ml.preprocessing import clean_ohlcv
from app.ml.regime import describe_regime
from app.services.dia import DiaService, build_facts
from app.services.market import MarketDataService
from app.services.market.service import DAILY_RANGE_DAYS, quote_to_dict
from app.utils.cache import CacheResult, StaleCache
from app.utils.errors import InsufficientDataError

DISCLAIMER = (
    "RedOak Markets provides educational and analytical information only. Technical indicators and "
    "signals are not guarantees of future performance and should not be considered financial advice."
)
ML_DISCLAIMER = (
    "ML output is an experimental analytical signal derived from historical patterns. It is not a "
    "prediction, a recommendation or financial advice."
)
COMPARE_RANGES = ("1M", "3M", "6M", "1Y", "5Y")
INDICATOR_KEYS = ["sma20", "sma50", "sma200", "ema20", "ema50", "rsi14", "macd", "macd_signal", "macd_hist",
                  "bb_upper", "bb_mid", "bb_lower"]


def _epoch(ts) -> int:
    return int(pd.Timestamp(ts).timestamp())


def _num(x, nd: int = 4):
    return None if x is None or pd.isna(x) else round(float(x), nd)


def _iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


class AnalysisService:
    def __init__(self, market: MarketDataService, registry: ModelRegistry, dia: DiaService):
        self.market, self.registry, self.dia = market, registry, dia
        self._ml_cache = StaleCache(stale_ttl=3600, max_entries=128)

    # ------------------------------------------------------------- helpers --
    def _meta(self, fetched: CacheResult | None = None) -> dict:
        return {
            "source": self.market.source,
            "source_label": self.market.source_label,
            "data_note": self.market.data_note,
            "stale": bool(fetched.stale) if fetched else False,
            "fetched_at": _iso(fetched.fetched_at) if fetched else None,
        }

    def _daily_clean(self, ticker: str, min_rows: int = 30) -> tuple[pd.DataFrame, CacheResult]:
        fetched = self.market.daily(ticker)
        return clean_ohlcv(fetched.value, min_rows=min_rows), fetched

    # --------------------------------------------------------------- quote --
    def quote(self, ticker: str) -> dict:
        fetched = self.market.quote(ticker)
        return {**quote_to_dict(fetched.value), "meta": self._meta(fetched)}

    # ------------------------------------------------------------- history --
    def history(self, ticker: str, range_: str) -> dict:
        if range_ in ("1D", "5D"):
            fetched = self.market.intraday(ticker, range_)
            df = clean_ohlcv(fetched.value, min_rows=1)
            interval = "5min" if range_ == "1D" else "30min"
        else:
            daily, fetched = self._daily_clean(ticker, min_rows=2)
            df = self.market.slice_daily(daily, range_)
            interval = "1day"
        candles = [
            {"t": _epoch(ts), "o": _num(r.open), "h": _num(r.high), "l": _num(r.low), "c": _num(r.close),
             "v": int(r.volume)}
            for ts, r in zip(df.index, df.itertuples())
        ]
        return {"ticker": ticker, "range": range_, "interval": interval, "candles": candles,
                "meta": self._meta(fetched)}

    # ---------------------------------------------------------- indicators --
    def indicators(self, ticker: str, range_: str) -> dict:
        daily, fetched = self._daily_clean(ticker)
        ind = compute_indicator_frame(daily)
        window_range = range_ if range_ in DAILY_RANGE_DAYS else "1M"  # intraday views fall back to daily bars
        sliced = self.market.slice_daily(daily, window_range)
        view = ind.loc[sliced.index]
        series = {k: [_num(v) for v in view[k]] for k in INDICATOR_KEYS}
        last = ind.iloc[-1]
        return {
            "ticker": ticker,
            "range": range_,
            "range_used": window_range,
            "interval": "1day",
            "t": [_epoch(ts) for ts in view.index],
            "series": series,
            "latest": {k: _num(last[k]) for k in INDICATOR_KEYS + ["bb_width", "bb_pct_b", "atr14"]},
            "price": _num(daily["close"].iloc[-1]),
            "meta": self._meta(fetched),
        }

    # ------------------------------------------------------------ analysis --
    def analysis(self, ticker: str) -> dict:
        daily, fetched = self._daily_clean(ticker)
        ind = compute_indicator_frame(daily)
        summary = build_signal_summary(daily, ind)
        last = ind.iloc[-1]
        return {
            "ticker": ticker,
            "as_of": daily.index[-1].strftime("%Y-%m-%d"),
            "signal": summary["overall"],
            "components": summary["components"],
            "rules": summary["rules"],
            "rule_catalogue": RULE_DESCRIPTIONS,
            "latest": {
                "price": _num(daily["close"].iloc[-1]),
                **{k: _num(last[k]) for k in ("sma20", "sma50", "sma200", "ema20", "ema50", "rsi14")},
            },
            "disclaimer": DISCLAIMER,
            "meta": self._meta(fetched),
        }

    # ---------------------------------------------------------- ML analysis --
    def ml_analysis(self, ticker: str) -> dict:
        """Cached for a few minutes: the regime / anomaly / importance endpoints share one result."""
        return self._ml_cache.get_or_load(
            f"{self.market.source}:{ticker}", 300, lambda: self._ml_analysis(ticker)
        ).value

    def _ml_analysis(self, ticker: str) -> dict:
        fetched = self.market.daily(ticker)
        raw = fetched.value
        tm = self.registry.get(ticker, raw, self.market.source)
        pred = predict_latest(tm, raw)
        df, feats = pred["clean"], pred["feature_frame"]

        regime = describe_regime(df, feats, pred["regime"])
        anomalies = anomaly_mod.detect_anomalies(df)
        glob = feature_importance(tm, pred["features"])
        local = local_contributions(tm, pred["features"], pred["regime"])

        ind = compute_indicator_frame(df)
        signals = build_signal_summary(df, ind)
        last = ind.iloc[-1]
        facts = build_facts(
            ticker,
            {"price": df["close"].iloc[-1], **{k: last[k] for k in ("sma20", "sma50", "sma200", "ema20", "ema50", "rsi14", "macd_hist")},
             "volume_ratio": feats["volume_ratio"].iloc[-1]},
            regime, pred, anomalies, tm.metrics, signals,
        )
        as_of = df.index[-1].strftime("%Y-%m-%d")
        dia = self.dia.summarise(facts, as_of)

        return {
            "ticker": ticker,
            "as_of": as_of,
            "model": tm.description,
            "classification": {
                "regime": pred["regime"],
                "probabilities": pred["probabilities"],
                "confidence": pred["confidence"],
                "confidence_note": (
                    "Class probability assigned by the model to its own label. It is not the "
                    "probability that the price will rise or fall."
                ),
            },
            "regime": regime,
            "evaluation": tm.metrics,
            "feature_importance": {"global": glob, "local": local},
            "anomalies": anomalies,
            "signals": {"overall": signals["overall"], "components": signals["components"]},
            "dia": dia,
            "badges": build_badges(pred["regime"], regime, anomalies, tm.metrics),
            "disclaimer": ML_DISCLAIMER,
            "meta": self._meta(fetched),
        }

    # -------------------------------------------------------------- compare --
    def compare(self, tickers: list[str], range_: str) -> dict:
        quotes, quotes_stale = self.market.quotes(tickers)
        frames, rows, stale = {}, [], quotes_stale
        for t in tickers:
            daily, fetched = self._daily_clean(t, min_rows=30)
            stale = stale or fetched.stale
            ind = compute_indicator_frame(daily)
            signal = build_signal_summary(daily, ind)["overall"]["label"]
            view = self.market.slice_daily(daily, range_)
            frames[t] = view["close"]
            close = view["close"]
            rets = close.pct_change().dropna()
            drawdown = (close / close.cummax() - 1).min()
            last = ind.iloc[-1]
            q = quotes.get(t)
            rows.append({
                "ticker": t,
                "name": q.name if q else t,
                "price": _num(q.price if q else daily["close"].iloc[-1], 2),
                "change_percent": _num(q.change_percent, 2) if q else None,
                "volume": int(q.volume) if q and q.volume else int(daily["volume"].iloc[-1]),
                "average_volume": int(q.average_volume) if q and q.average_volume else int(daily["volume"].iloc[-20:].mean()),
                "range_return_percent": _num((close.iloc[-1] / close.iloc[0] - 1) * 100, 2),
                "volatility": _num(rets.std(ddof=1) * np.sqrt(252) if len(rets) > 1 else np.nan),
                "max_drawdown_percent": _num(drawdown * 100, 2),
                "rsi14": _num(last["rsi14"], 1),
                "sma20": _num(last["sma20"], 2), "sma50": _num(last["sma50"], 2), "sma200": _num(last["sma200"], 2),
                "ema20": _num(last["ema20"], 2), "ema50": _num(last["ema50"], 2),
                "signal": signal,
            })

        # Rebase to 100 on the first date every ticker has a bar, so lines start together.
        combined = pd.concat(frames, axis=1).dropna()
        if len(combined) < 2:
            raise InsufficientDataError("These stocks do not share enough overlapping price history to compare.")
        rebased = combined / combined.iloc[0] * 100
        return {
            "range": range_,
            "tickers": tickers,
            "t": [_epoch(ts) for ts in rebased.index],
            "performance": {t: [_num(v, 2) for v in rebased[t]] for t in tickers},
            "table": rows,
            "meta": {**self._meta(), "stale": stale},
        }


def build_badges(model_class: str, regime: dict, anomalies: dict, metrics: dict) -> list[dict]:
    tone = {"bullish": "bull", "bearish": "bear", "neutral": "neutral"}[model_class]
    badges = [{"label": f"{model_class.upper()} SIGNAL", "tone": tone}]
    vol = regime["volatility"]["label"]
    if vol != "Unknown":
        badges.append({"label": f"{vol.upper()} VOLATILITY", "tone": "warn" if vol == "High" else "neutral"})
    mom = regime["momentum"]
    badges.append({
        "label": f"{mom['label'].upper()} MOMENTUM" if mom["label"] != "Weak" else "NEUTRAL MOMENTUM",
        "tone": ("bull" if mom["direction"] == "Positive" else "bear" if mom["direction"] == "Negative" else "neutral")
        if mom["label"] != "Weak" else "neutral",
    })
    badges.append({"label": regime["character"]["label"].upper(), "tone": "neutral"})
    if anomalies.get("detected"):
        for kind in anomalies["kinds"]:
            badges.append({"label": f"UNUSUAL {kind.upper()}", "tone": "warn"})
    elif regime["volume"]["label"] == "Above average":
        badges.append({"label": "ABOVE-AVERAGE VOLUME", "tone": "neutral"})
    if not metrics["beats_baseline"]:
        badges.append({"label": "NO EDGE VS BASELINE", "tone": "warn"})
    return badges
