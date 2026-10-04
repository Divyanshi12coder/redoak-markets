"""Model training.

Target definition (documented in the README):
    For each session t, look ``HORIZON`` sessions ahead. The label is
        bullish  if  forward return >  +K * sigma_t * sqrt(HORIZON)
        bearish  if  forward return <  -K * sigma_t * sqrt(HORIZON)
        neutral  otherwise
    where sigma_t is the *trailing* 20-day daily volatility known at time t. Labels therefore
    adapt to each stock's volatility. The last HORIZON rows have no label and are never used
    for training.

Leakage controls:
    * features are strictly causal (see ``features.py``)
    * chronological splits only - nothing is shuffled
    * an embargo gap of HORIZON rows separates train and test windows
    * the final model is fitted on labelled history only, then applied to the latest row

Command line (fetches data through the configured provider and stores a joblib artifact):
    python -m app.ml.train AAPL MSFT
"""
from __future__ import annotations

import hashlib
import json
import logging
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier

from app.indicators import core
from app.ml.evaluate import CLASS_NAMES, CLASSES, walk_forward_evaluate
from app.ml.features import FEATURE_COLUMNS, build_features
from app.ml.preprocessing import clean_ohlcv
from app.utils.errors import InsufficientDataError

logger = logging.getLogger(__name__)

SCHEMA_VERSION = "1"
HORIZON = 10
K = 0.5
N_SPLITS = 4
MIN_TRAINING_ROWS = 300  # labelled, fully-warmed-up rows required to train and validate
RF_PARAMS = dict(
    n_estimators=150,
    max_depth=5,
    min_samples_leaf=15,
    max_features="sqrt",
    class_weight="balanced_subsample",
    random_state=42,
    n_jobs=1,
)


def make_model() -> RandomForestClassifier:
    return RandomForestClassifier(**RF_PARAMS)


def model_signature() -> str:
    """Short hash of everything that defines the model: features, params, target."""
    blob = json.dumps(
        {"features": FEATURE_COLUMNS, "params": RF_PARAMS, "h": HORIZON, "k": K, "schema": SCHEMA_VERSION},
        sort_keys=True,
    )
    return hashlib.sha1(blob.encode()).hexdigest()[:7]


@dataclass
class TrainedModel:
    ticker: str
    source: str
    model: RandomForestClassifier
    feature_columns: list[str]
    trained_through: str
    n_samples: int
    metrics: dict
    importance: dict[str, float]
    feature_medians: dict[str, float]
    version: str
    class_distribution: dict[str, float]
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    @property
    def description(self) -> dict:
        return {
            "version": self.version,
            "algorithm": "RandomForestClassifier",
            "hyperparameters": {k: v for k, v in RF_PARAMS.items() if k not in ("n_jobs", "random_state")},
            "trained_through": self.trained_through,
            "n_training_samples": self.n_samples,
            "horizon_days": HORIZON,
            "target_definition": (
                f"Class of the {HORIZON}-session forward return relative to +/-{K} x trailing volatility "
                f"x sqrt({HORIZON})."
            ),
            "n_features": len(self.feature_columns),
            "class_distribution": self.class_distribution,
            "created_at": self.created_at,
        }


def make_labels(close: pd.Series, horizon: int = HORIZON, k: float = K) -> pd.Series:
    """Volatility-adjusted forward-return class: -1 bearish, 0 neutral, +1 bullish, NaN unknown.

    The label deliberately uses *future* prices (that is what is being classified); it must
    only ever be used as a target, never as an input feature.
    """
    daily_vol = core.log_returns(close).rolling(20, min_periods=20).std(ddof=1)
    fwd = close.shift(-horizon) / close - 1.0
    threshold = k * daily_vol * np.sqrt(horizon)
    y = pd.Series(np.nan, index=close.index, dtype=float)
    valid = fwd.notna() & threshold.notna()
    y[valid & (fwd > threshold)] = 1.0
    y[valid & (fwd < -threshold)] = -1.0
    y[valid & (fwd.abs() <= threshold)] = 0.0
    return y


def build_dataset(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series, pd.DataFrame]:
    """Return (X, y, all_features). ``X``/``y`` contain only fully-warmed, labelled rows."""
    feats = build_features(df)
    labels = make_labels(df["close"])
    mask = feats.notna().all(axis=1) & labels.notna()
    return feats[mask], labels[mask].astype(int), feats


def train_model(raw: pd.DataFrame, ticker: str, source: str) -> TrainedModel:
    df = clean_ohlcv(raw)
    X, y, _ = build_dataset(df)
    if len(X) < MIN_TRAINING_ROWS:
        raise InsufficientDataError(
            f"{ticker} has {len(X)} usable historical rows; at least {MIN_TRAINING_ROWS} "
            "are needed to train and validate the classifier."
        )

    metrics = walk_forward_evaluate(X, y, make_model, n_splits=N_SPLITS, gap=HORIZON)

    model = make_model()
    model.fit(X.to_numpy(), y.to_numpy())

    dist = y.map(CLASS_NAMES).value_counts(normalize=True)
    importance = dict(zip(FEATURE_COLUMNS, (float(v) for v in model.feature_importances_)))
    trained_through = df.index[-1]
    trained_through = trained_through.strftime("%Y-%m-%d") if hasattr(trained_through, "strftime") else str(trained_through)
    return TrainedModel(
        ticker=ticker,
        source=source,
        model=model,
        feature_columns=list(FEATURE_COLUMNS),
        trained_through=trained_through,
        n_samples=int(len(X)),
        metrics=metrics,
        importance=importance,
        feature_medians={c: float(X[c].median()) for c in FEATURE_COLUMNS},
        version=f"rf-v{SCHEMA_VERSION}-{model_signature()}",
        class_distribution={CLASS_NAMES[c]: round(float(dist.get(CLASS_NAMES[c], 0.0)), 4) for c in CLASSES},
    )


def main(argv: list[str]) -> int:  # pragma: no cover - thin CLI wrapper
    from app.services.container import get_market_service, get_model_registry

    if not argv:
        print("usage: python -m app.ml.train TICKER [TICKER ...]")
        return 2
    market, registry = get_market_service(), get_model_registry()
    for ticker in argv:
        daily = market.daily(ticker.upper())
        tm = registry.get(ticker.upper(), daily.value, market.source, force=True)
        m = tm.metrics
        print(
            f"{tm.ticker}: {tm.version} through {tm.trained_through} | "
            f"acc={m['accuracy']} baseline={m['baseline_accuracy']} f1={m['f1_macro']} "
            f"beats_baseline={m['beats_baseline']}"
        )
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main(sys.argv[1:]))
