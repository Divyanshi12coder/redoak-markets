"""Dia: grounded summaries and LLM output validation."""
import json

import httpx

from app.config import Settings
from app.services.dia import DiaService, template_summary, validate_llm_text

FACTS = {
    "ticker": "AAPL", "price": 214.3, "rsi": 54.4, "sma_20": 214.24, "sma_50": 208.08, "sma_200": 192.85,
    "ema_20": 211.58, "ema_50": 207.8, "macd_histogram": -0.019, "volatility": 0.301, "volatility_level": "Moderate",
    "volatility_percentile": 50.0, "volume_change": 1.4, "volume_level": "Above average",
    "momentum": "Moderate (Positive)", "trend_character": "Trending", "ml_regime": "bullish",
    "ml_class_probability": 0.46, "model_beats_baseline": False, "model_holdout_accuracy": 0.31,
    "model_baseline_accuracy": 0.36, "anomaly": "No Significant Anomaly Detected", "rule_based_signal": "Bullish signal",
}


def test_template_summary_is_grounded_and_hedged():
    text = template_summary(FACTS)
    assert "208.08" in text and "RSI is 54.4" in text and "bullish" in text
    assert "did not beat a naive baseline" in text  # honesty about model skill
    lowered = text.lower()
    for banned in ("guarantee", "will rise", "will fall", "buy now"):
        assert banned not in lowered


def test_template_handles_missing_values_and_overbought():
    facts = {**FACTS, "sma_50": None, "sma_200": None, "rsi": 78.0, "model_beats_baseline": True}
    text = template_summary(facts)
    assert "limited moving-average history" in text and "overbought" in text
    assert "historical result and not a forecast" in text


def test_anomaly_sentence_never_implies_direction():
    text = template_summary({**FACTS, "anomaly": "Unusual Volume Activity Detected"})
    assert "Unusual Volume Activity Detected" in text and "not that price will move in any direction" in text


def test_validator_rejects_ungrounded_numbers_and_predictions():
    assert validate_llm_text("AAPL trades above its 50-day average of 208.08 and RSI is 54.4.", FACTS) is None
    assert "number" in validate_llm_text("AAPL has a fair value of 301.55.", FACTS)
    assert "forbidden" in validate_llm_text("AAPL will rise next week.", FACTS)
    assert "forbidden" in validate_llm_text("This is a guaranteed winner", FACTS)


def _service(handler, key="sk-test"):
    settings = Settings(llm_api_key=key, _env_file=None)
    return DiaService(settings, client=httpx.Client(transport=httpx.MockTransport(handler)))


def llm_reply(text):
    return lambda request: httpx.Response(200, json={"content": [{"type": "text", "text": text}]})


def test_without_key_dia_uses_template_and_never_calls_network():
    def handler(request):
        raise AssertionError("network must not be used without an API key")

    out = _service(handler, key="").summarise(FACTS, "2025-01-10")
    assert out["source"] == "template" and out["llm_enabled"] is False


def test_valid_llm_summary_is_used_and_sends_only_structured_facts():
    sent = {}

    def handler(request):
        sent["body"] = json.loads(request.content)
        sent["key"] = request.headers["x-api-key"]
        return llm_reply("AAPL sits above its 50-day average of 208.08 with RSI at 54.4, which suggests neutral momentum.")(request)

    out = _service(handler).summarise(FACTS, "2025-01-10")
    assert out["source"] == "llm" and "208.08" in out["summary"]
    assert json.loads(sent["body"]["messages"][0]["content"])["ticker"] == "AAPL"
    assert "never predict" in sent["body"]["system"].lower() or "never" in sent["body"]["system"].lower()
    assert sent["key"] == "sk-test"


def test_hallucinated_llm_output_falls_back_to_template():
    out = _service(llm_reply("AAPL will rise to 250 after a strong earnings beat.")).summarise(FACTS, "2025-01-10")
    assert out["source"] == "template" and "grounding" in out["note"]


def test_llm_outage_does_not_break_analysis():
    out = _service(lambda r: httpx.Response(500)).summarise(FACTS, "2025-01-10")
    assert out["source"] == "template" and out["summary"] and out["note"]
