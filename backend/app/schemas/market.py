from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class DataMeta(BaseModel):
    source: str
    source_label: str
    data_note: str
    stale: bool = False
    fetched_at: str | None = None


class QuoteOut(BaseModel):
    ticker: str
    name: str
    exchange: str
    currency: str
    price: float
    change: float
    change_percent: float
    previous_close: float | None = None
    open: float | None = None
    high: float | None = None
    low: float | None = None
    volume: int | None = None
    average_volume: int | None = None
    is_market_open: bool
    as_of: str
    fifty_two_week_low: float | None = None
    fifty_two_week_high: float | None = None
    meta: DataMeta


class SearchItem(BaseModel):
    ticker: str
    name: str
    exchange: str
    country: str | None = None
    instrument_type: str | None = None
    currency: str | None = None
    price: float | None = None
    change_percent: float | None = None


class SearchOut(BaseModel):
    query: str
    results: list[SearchItem]
    meta: DataMeta


class Candle(BaseModel):
    t: int
    o: float | None
    h: float | None
    l: float | None
    c: float | None
    v: int


class HistoryOut(BaseModel):
    ticker: str
    range: str
    interval: str
    candles: list[Candle]
    meta: DataMeta


class IndicatorsOut(BaseModel):
    ticker: str
    range: str
    range_used: str
    interval: str
    t: list[int]
    series: dict[str, list[float | None]]
    latest: dict[str, float | None]
    price: float | None
    meta: DataMeta


class SignalScore(BaseModel):
    score: float
    label: str
    position: float | None = None
    detail: str | None = None


class SignalRule(BaseModel):
    key: str
    group: str
    score: float
    label: str
    detail: str
    weight: float


class AnalysisOut(BaseModel):
    ticker: str
    as_of: str
    signal: SignalScore
    components: dict[str, SignalScore]
    rules: list[SignalRule]
    rule_catalogue: list[str]
    latest: dict[str, float | None]
    disclaimer: str
    meta: DataMeta


class OverviewOut(BaseModel):
    market_open: bool
    indices: list[dict[str, Any]]
    gainers: list[dict[str, Any]]
    losers: list[dict[str, Any]]
    most_active: list[dict[str, Any]]
    movers: list[dict[str, Any]]
    total_volume: int
    advancers: int
    decliners: int
    universe_size: int
    stale: bool
    generated_at: str
    meta: DataMeta


class CompareOut(BaseModel):
    range: str
    tickers: list[str]
    t: list[int]
    performance: dict[str, list[float | None]]
    table: list[dict[str, Any]]
    meta: DataMeta


class Classification(BaseModel):
    regime: str
    probabilities: dict[str, float]
    confidence: float
    confidence_note: str


class Badge(BaseModel):
    label: str
    tone: str


class MlAnalysisOut(BaseModel):
    ticker: str
    as_of: str
    model: dict[str, Any]
    classification: Classification
    regime: dict[str, Any]
    evaluation: dict[str, Any]
    feature_importance: dict[str, list[dict[str, Any]]]
    anomalies: dict[str, Any]
    signals: dict[str, Any]
    dia: dict[str, Any]
    badges: list[Badge]
    disclaimer: str
    meta: DataMeta


class RegimeOut(BaseModel):
    ticker: str
    as_of: str
    classification: Classification
    regime: dict[str, Any]
    model: dict[str, Any]
    badges: list[Badge]
    disclaimer: str
    meta: DataMeta


class AnomaliesOut(BaseModel):
    ticker: str
    as_of: str
    anomalies: dict[str, Any]
    meta: DataMeta


class FeatureImportanceOut(BaseModel):
    ticker: str
    as_of: str
    model_version: str
    importance: list[dict[str, Any]]
    local: list[dict[str, Any]]
    predicted_class: str
    note: str
    meta: DataMeta
