"""Dia - the analyst that explains the quantitative output in plain English.

Dia never forecasts. It receives a structured dictionary of calculated facts and:

1. always produces a deterministic, template-based summary (no network, no key needed);
2. if ``LLM_API_KEY`` is set, asks an LLM to rewrite those same facts more fluently. The reply
   is *validated*: it is rejected (and the template is used) if it contains numbers that are
   not present in the facts or phrases that sound like predictions or advice.
"""
from __future__ import annotations

import json
import logging
import re

import httpx

from app.config import Settings
from app.utils.cache import StaleCache

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are Dia, a careful market-analysis assistant inside a stock analytics app. "
    "You receive a JSON object of calculated technical indicators and model outputs for one stock. "
    "Write a concise plain-English summary (3-4 sentences, under 110 words) of what the data shows.\n"
    "Rules:\n"
    "- Use ONLY values present in the JSON. Never invent prices, news, earnings, targets or events.\n"
    "- Describe current conditions and historical patterns; never predict future prices.\n"
    "- Never say a stock will rise or fall, never recommend buying or selling, never promise outcomes.\n"
    "- Use hedged wording such as 'may indicate', 'suggests', 'signal'.\n"
    "- If a field is null, do not mention it.\n"
    "- Mention that the ML output is an experimental classification when you cite it, and if "
    "'model_beats_baseline' is false say the model showed no historical edge over a naive baseline.\n"
    "- Plain text only: no markdown, no bullet points."
)

FORBIDDEN_PHRASES = (
    "guarantee", "will rise", "will fall", "will go up", "will go down", "will increase", "will decrease",
    "will surge", "will drop", "buy now", "sell now", "you should buy", "you should sell", "price target",
    "will outperform", "certain to", "sure to",
)
# Numbers that legitimately appear as indicator parameters / thresholds.
PARAMETER_NUMBERS = {10, 14, 20, 26, 30, 50, 60, 70, 100, 200, 252, 12, 9, 5, 3, 1}


def _fmt_pct(x: float) -> str:
    return f"{x * 100:.1f}%"


def build_facts(
    ticker: str,
    close_row: dict,
    regime: dict,
    classification: dict,
    anomalies: dict,
    metrics: dict,
    signals: dict | None = None,
) -> dict:
    """Structured quantitative facts for Dia. Values are rounded; unavailable ones are None."""

    def r(v, n=2):
        return None if v is None or v != v else round(float(v), n)

    return {
        "ticker": ticker,
        "price": r(close_row.get("price")),
        "rsi": r(close_row.get("rsi14"), 1),
        "sma_20": r(close_row.get("sma20")),
        "sma_50": r(close_row.get("sma50")),
        "sma_200": r(close_row.get("sma200")),
        "ema_20": r(close_row.get("ema20")),
        "ema_50": r(close_row.get("ema50")),
        "macd_histogram": r(close_row.get("macd_hist"), 3),
        "volatility": r(regime["volatility"]["annualised"], 3),
        "volatility_level": regime["volatility"]["label"],
        "volatility_percentile": r(regime["volatility"]["percentile"], 0),
        "volume_change": r(close_row.get("volume_ratio"), 2),
        "volume_level": regime["volume"]["label"],
        "momentum": f"{regime['momentum']['label']} ({regime['momentum']['direction']})",
        "trend_character": regime["character"]["label"],
        "ml_regime": classification["regime"],
        "ml_class_probability": r(classification["confidence"], 2),
        "model_beats_baseline": bool(metrics["beats_baseline"]),
        "model_holdout_accuracy": r(metrics["accuracy"], 2),
        "model_baseline_accuracy": r(metrics["baseline_accuracy"], 2),
        "anomaly": anomalies["headline"],
        "rule_based_signal": (signals or {}).get("overall", {}).get("label"),
    }


def template_summary(f: dict) -> str:
    """Deterministic summary built only from the facts."""
    t = f["ticker"]
    sentences: list[str] = []

    # 1. trend / moving averages
    parts = []
    if f.get("sma_50") is not None and f.get("price") is not None:
        rel = "above" if f["price"] > f["sma_50"] else "below"
        parts.append(f"{t} is trading {rel} its 50-day moving average ({f['sma_50']:.2f})")
    if f.get("sma_200") is not None and f.get("price") is not None:
        rel = "above" if f["price"] > f["sma_200"] else "below"
        parts.append(f"{rel} its 200-day average")
    if parts:
        sentences.append(" and ".join(parts) + ".")
    else:
        sentences.append(f"There is limited moving-average history available for {t}.")

    # 2. RSI
    rsi = f.get("rsi")
    if rsi is not None:
        if rsi >= 70:
            sentences.append(f"RSI is {rsi:.1f}, above the traditional overbought threshold of 70, which may indicate stretched short-term momentum.")
        elif rsi <= 30:
            sentences.append(f"RSI is {rsi:.1f}, below the traditional oversold threshold of 30, which may indicate depressed short-term momentum.")
        else:
            sentences.append(f"RSI is {rsi:.1f}, between the traditional oversold (30) and overbought (70) thresholds.")

    # 3. volatility + volume
    vol_bits = [f"Volatility is {f['volatility_level'].lower()} relative to its own past year"]
    vc = f.get("volume_change")
    if vc is not None:
        lvl = f["volume_level"].lower()
        vol_bits.append(f"and the latest volume is {vc:.1f}x its 20-day average ({lvl}), which may indicate "
                        + ("increased" if vc >= 1.3 else "reduced" if vc <= 0.7 else "typical") + " market activity")
    sentences.append(" ".join(vol_bits) + ".")

    # 4. anomaly
    if f.get("anomaly") and "No Significant" not in f["anomaly"]:
        sentences.append(f"{f['anomaly']}; this only means recent activity was statistically unusual, not that price will move in any direction.")

    # 5. ML output, with honesty about skill
    ml = f"The experimental classifier labels the current pattern as {f['ml_regime']} (class probability {f['ml_class_probability']:.2f})"
    if f.get("model_beats_baseline"):
        ml += (f"; on walk-forward validation it scored {f['model_holdout_accuracy']:.2f} accuracy versus "
               f"{f['model_baseline_accuracy']:.2f} for a naive baseline, which is a historical result and not a forecast.")
    else:
        ml += (f", but on walk-forward validation it did not beat a naive baseline "
               f"({f['model_holdout_accuracy']:.2f} vs {f['model_baseline_accuracy']:.2f}), so treat this output with low weight.")
    sentences.append(ml)
    return " ".join(sentences)


# ------------------------------------------------------------- LLM guard ----
_NUM_RE = re.compile(r"\d+(?:\.\d+)?")


def _allowed_numbers(facts: dict) -> set[float]:
    allowed: set[float] = {float(n) for n in PARAMETER_NUMBERS}

    def add(v: float) -> None:
        for dp in (0, 1, 2, 3):
            allowed.add(round(abs(v), dp))
        allowed.add(round(abs(v) * 100, 0))
        allowed.add(round(abs(v) * 100, 1))

    for v in facts.values():
        if isinstance(v, bool) or v is None:
            continue
        if isinstance(v, (int, float)):
            add(float(v))
        elif isinstance(v, str):
            for m in _NUM_RE.findall(v):
                add(float(m))
    return allowed


def validate_llm_text(text: str, facts: dict) -> str | None:
    """Return a reason string if the text must be rejected, else None."""
    lowered = text.lower()
    for phrase in FORBIDDEN_PHRASES:
        if phrase in lowered:
            return f"contains forbidden phrase '{phrase}'"
    allowed = _allowed_numbers(facts)
    for m in _NUM_RE.findall(text):
        value = float(m)
        if not any(abs(value - a) <= 0.011 for a in allowed):
            return f"contains a number ({m}) that is not in the supplied facts"
    return None


class DiaService:
    def __init__(self, settings: Settings, client: httpx.Client | None = None):
        self.settings = settings
        self._client = client or httpx.Client(timeout=settings.llm_timeout_seconds)
        self._cache = StaleCache(stale_ttl=6 * 3600, max_entries=256)

    def summarise(self, facts: dict, as_of: str) -> dict:
        base = template_summary(facts)
        result = {
            "summary": base, "source": "template", "model": None,
            "llm_enabled": self.settings.llm_enabled, "grounded_on": facts, "note": None,
        }
        if not self.settings.llm_enabled:
            return result

        key = f"{facts['ticker']}:{as_of}:{self.settings.llm_model}:{hash(json.dumps(facts, sort_keys=True))}"
        hit = self._cache.get_fresh(key, 3600)
        if hit:
            return {**result, **hit.value}  # type: ignore[dict-item]

        try:
            text = self._call_llm(facts)
        except Exception as exc:  # network / HTTP / parse errors must never break the analysis
            logger.warning("Dia LLM call failed: %s", exc)
            result["note"] = "The optional LLM layer was unavailable, so the built-in summary is shown."
            return result

        problem = validate_llm_text(text, facts)
        if problem:
            logger.warning("Dia LLM output rejected: %s", problem)
            result["note"] = "The LLM response failed grounding checks, so the built-in summary is shown."
            return result

        llm_result = {"summary": text.strip(), "source": "llm", "model": self.settings.llm_model, "note": None}
        self._cache.put(key, llm_result)
        return {**result, **llm_result}

    def _call_llm(self, facts: dict) -> str:
        resp = self._client.post(
            f"{self.settings.llm_base_url.rstrip('/')}/v1/messages",
            headers={
                "x-api-key": self.settings.llm_api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": self.settings.llm_model,
                "max_tokens": 400,
                "system": SYSTEM_PROMPT,
                "messages": [{"role": "user", "content": json.dumps(facts)}],
            },
        )
        resp.raise_for_status()
        blocks = resp.json().get("content", [])
        text = "".join(b.get("text", "") for b in blocks if b.get("type") == "text").strip()
        if not text:
            raise ValueError("empty LLM response")
        return text
