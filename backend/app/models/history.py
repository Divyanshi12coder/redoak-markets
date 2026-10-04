from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, utcnow


class AnalysisHistory(Base):
    """One row each time a signed-in user opens the analyzer for a ticker."""

    __tablename__ = "analysis_history"
    __table_args__ = (Index("ix_analysis_history_user_time", "user_id", "analyzed_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    ticker: Mapped[str] = mapped_column(String(12))
    analyzed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class MlAnalysis(Base):
    """Model-output metadata for each ML analysis a signed-in user requested.

    Only metadata is stored (which model, what it classified, how it scored on its own
    hold-out folds) - not raw feature matrices or the serialised model.
    """

    __tablename__ = "ml_analysis"
    __table_args__ = (Index("ix_ml_analysis_user_time", "user_id", "analyzed_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    ticker: Mapped[str] = mapped_column(String(12))
    model_version: Mapped[str] = mapped_column(String(80))
    regime: Mapped[str] = mapped_column(String(16))
    # Probability the model assigns to the predicted class (NOT a probability of profit).
    confidence: Mapped[float] = mapped_column(Float)
    volatility_regime: Mapped[str] = mapped_column(String(16))
    anomaly_detected: Mapped[int] = mapped_column(Integer, default=0)
    holdout_accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    baseline_accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    data_source: Mapped[str] = mapped_column(String(16))
    analyzed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
