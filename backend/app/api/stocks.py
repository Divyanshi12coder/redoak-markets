from __future__ import annotations

from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.api.deps import Analysis, DbSession, Market, OptionalUser, RangeParam, Ticker
from app.database.base import utcnow
from app.models import AnalysisHistory, MlAnalysis
from app.schemas.market import (
    AnalysisOut,
    AnomaliesOut,
    FeatureImportanceOut,
    HistoryOut,
    IndicatorsOut,
    MlAnalysisOut,
    QuoteOut,
    RegimeOut,
    SearchItem,
    SearchOut,
)
from app.services.analysis import ML_DISCLAIMER
from app.utils.errors import AppError

router = APIRouter(prefix="/api/stocks", tags=["stocks"])

DEDUPE_WINDOW = timedelta(minutes=10)


@router.get("/search", response_model=SearchOut, summary="Search by ticker or company name")
def search(
    q: Annotated[str, Query(min_length=1, max_length=40, description="Ticker or company name")],
    market: Market,
) -> SearchOut:
    fetched = market.search(q)
    matches = fetched.value[:8]
    # Attach latest price / daily change to the top results. Best effort: a quote failure
    # (e.g. provider rate limit) must not hide the search results themselves.
    quotes = {}
    try:
        quotes, _ = market.quotes([m.ticker for m in matches[:5]])
    except AppError:
        pass
    results = [
        SearchItem(
            ticker=m.ticker, name=m.name, exchange=m.exchange, country=m.country,
            instrument_type=m.instrument_type, currency=m.currency,
            price=quotes[m.ticker].price if m.ticker in quotes else None,
            change_percent=quotes[m.ticker].change_percent if m.ticker in quotes else None,
        )
        for m in matches
    ]
    meta = {"source": market.source, "source_label": market.source_label, "data_note": market.data_note,
            "stale": fetched.stale, "fetched_at": None}
    return SearchOut(query=q, results=results, meta=meta)


@router.get("/{ticker}", response_model=QuoteOut, summary="Latest quote")
def quote(ticker: Ticker, svc: Analysis) -> dict:
    return svc.quote(ticker)


@router.get("/{ticker}/history", response_model=HistoryOut, summary="OHLCV price history")
def history(ticker: Ticker, range: RangeParam, svc: Analysis) -> dict:
    return svc.history(ticker, range)


@router.get("/{ticker}/indicators", response_model=IndicatorsOut,
            summary="SMA 20/50/200, EMA 20/50, RSI 14, MACD and Bollinger Bands (calculated with pandas)")
def indicators(ticker: Ticker, range: RangeParam, svc: Analysis) -> dict:
    return svc.indicators(ticker, range)


@router.get("/{ticker}/analysis", response_model=AnalysisOut, summary="Rule-based technical signal summary")
def analysis(ticker: Ticker, svc: Analysis, user: OptionalUser, db: DbSession) -> dict:
    result = svc.analysis(ticker)
    if user is not None:  # remember what signed-in users looked at (deduplicated)
        recent = db.scalar(
            select(AnalysisHistory.id).where(
                AnalysisHistory.user_id == user.id,
                AnalysisHistory.ticker == ticker,
                AnalysisHistory.analyzed_at >= utcnow() - DEDUPE_WINDOW,
            )
        )
        if recent is None:
            db.add(AnalysisHistory(user_id=user.id, ticker=ticker))
            db.commit()
    return result


@router.get("/{ticker}/ml-analysis", response_model=MlAnalysisOut,
            summary="ML market-regime classification, anomalies, feature importance and Dia summary")
def ml_analysis(ticker: Ticker, svc: Analysis, user: OptionalUser, db: DbSession) -> dict:
    result = svc.ml_analysis(ticker)
    if user is not None:
        model_version = f"{result['model']['version']}:{ticker}:{result['model']['trained_through']}"
        recent = db.scalar(
            select(MlAnalysis.id).where(
                MlAnalysis.user_id == user.id,
                MlAnalysis.ticker == ticker,
                MlAnalysis.model_version == model_version,
                MlAnalysis.analyzed_at >= utcnow() - DEDUPE_WINDOW,
            )
        )
        if recent is None:
            ev = result["evaluation"]
            db.add(MlAnalysis(
                user_id=user.id, ticker=ticker, model_version=model_version,
                regime=result["classification"]["regime"],
                confidence=result["classification"]["confidence"],
                volatility_regime=result["regime"]["volatility"]["label"],
                anomaly_detected=int(result["anomalies"].get("detected", False)),
                holdout_accuracy=ev["accuracy"], baseline_accuracy=ev["baseline_accuracy"],
                data_source=result["meta"]["source"],
            ))
            db.commit()
    return result


@router.get("/{ticker}/regime", response_model=RegimeOut, summary="Current market regime")
def regime(ticker: Ticker, svc: Analysis) -> dict:
    r = svc.ml_analysis(ticker)
    return {k: r[k] for k in ("ticker", "as_of", "classification", "regime", "model", "badges", "disclaimer", "meta")}


@router.get("/{ticker}/anomalies", response_model=AnomaliesOut, summary="Unusual price / volume / volatility activity")
def anomalies(ticker: Ticker, svc: Analysis) -> dict:
    r = svc.ml_analysis(ticker)
    return {"ticker": r["ticker"], "as_of": r["as_of"], "anomalies": r["anomalies"], "meta": r["meta"]}


@router.get("/{ticker}/feature-importance", response_model=FeatureImportanceOut,
            summary="Which features influenced the classification")
def feature_importance(ticker: Ticker, svc: Analysis) -> dict:
    r = svc.ml_analysis(ticker)
    return {
        "ticker": r["ticker"], "as_of": r["as_of"], "model_version": r["model"]["version"],
        "importance": r["feature_importance"]["global"], "local": r["feature_importance"]["local"],
        "predicted_class": r["classification"]["regime"],
        "note": "Global importance shows what the model relies on overall. 'Local' contributions show how much "
                "each feature moved this particular classification. " + ML_DISCLAIMER,
        "meta": r["meta"],
    }
