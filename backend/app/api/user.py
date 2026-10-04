from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import func, select

from app.api.deps import CurrentUser, DbSession
from app.models import AnalysisHistory, MlAnalysis, UserPreferences
from app.schemas.auth import (
    HistoryItemOut,
    MlHistoryItemOut,
    PreferencesIn,
    PreferencesOut,
    ProfileOut,
)

router = APIRouter(prefix="/api/user", tags=["user"])


def _preferences(db, user) -> UserPreferences:
    prefs = db.get(UserPreferences, user.id)
    if prefs is None:  # accounts created before preferences existed
        prefs = UserPreferences(user_id=user.id)
        db.add(prefs)
        db.commit()
    return prefs


def recent_tickers(db, user_id: int, limit: int = 8) -> list[str]:
    latest = func.max(AnalysisHistory.analyzed_at)
    rows = db.execute(
        select(AnalysisHistory.ticker)
        .where(AnalysisHistory.user_id == user_id)
        .group_by(AnalysisHistory.ticker)
        .order_by(latest.desc())
        .limit(limit)
    ).scalars()
    return list(rows)


@router.get("/profile", response_model=ProfileOut, summary="Current user, preferences and recently analysed tickers")
def profile(user: CurrentUser, db: DbSession) -> ProfileOut:
    return ProfileOut(
        user=user,  # type: ignore[arg-type]
        preferences=PreferencesOut.model_validate(_preferences(db, user)),
        recent_tickers=recent_tickers(db, user.id),
    )


@router.put("/preferences", response_model=PreferencesOut, summary="Update chart preferences")
def update_preferences(body: PreferencesIn, user: CurrentUser, db: DbSession) -> PreferencesOut:
    prefs = _preferences(db, user)
    prefs.default_range, prefs.chart_type, prefs.indicators = body.default_range, body.chart_type, body.indicators
    db.commit()
    return PreferencesOut.model_validate(prefs)


@router.get("/history", response_model=list[HistoryItemOut], summary="Recently analysed stocks")
def history(user: CurrentUser, db: DbSession, limit: int = 20) -> list[HistoryItemOut]:
    limit = max(1, min(limit, 100))
    rows = db.execute(
        select(AnalysisHistory.ticker, AnalysisHistory.analyzed_at)
        .where(AnalysisHistory.user_id == user.id)
        .order_by(AnalysisHistory.analyzed_at.desc())
        .limit(limit)
    ).all()
    return [HistoryItemOut(ticker=t, analyzed_at=a) for t, a in rows]


@router.get("/ml-history", response_model=list[MlHistoryItemOut], summary="Stored ML analysis metadata")
def ml_history(user: CurrentUser, db: DbSession, limit: int = 20) -> list[MlHistoryItemOut]:
    limit = max(1, min(limit, 100))
    rows = db.scalars(
        select(MlAnalysis).where(MlAnalysis.user_id == user.id).order_by(MlAnalysis.analyzed_at.desc()).limit(limit)
    ).all()
    return [
        MlHistoryItemOut(
            ticker=r.ticker, model_version=r.model_version, regime=r.regime, confidence=r.confidence,
            volatility_regime=r.volatility_regime, anomaly_detected=bool(r.anomaly_detected),
            data_source=r.data_source, analyzed_at=r.analyzed_at,
        )
        for r in rows
    ]
