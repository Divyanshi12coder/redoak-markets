"""Inference, model registry (cache + joblib persistence) and explainability."""
from __future__ import annotations

import logging
import threading
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from app.ml.evaluate import CLASS_NAMES, CLASSES
from app.ml.features import FEATURE_META, build_features
from app.ml.preprocessing import clean_ohlcv
from app.ml.train import TrainedModel, model_signature, train_model
from app.utils.errors import InsufficientDataError

logger = logging.getLogger(__name__)


class ModelRegistry:
    """Trains a per-ticker model on demand and caches it.

    A model is reused while the latest bar date and the model signature (features, parameters,
    target definition) are unchanged. Artifacts are written to ``model_dir`` with joblib so a
    restart does not retrain; they are git-ignored and are only ever loaded from this
    server-controlled directory (joblib uses pickle - never load untrusted files).
    """

    def __init__(self, model_dir: str | Path, persist: bool = True):
        self.model_dir = Path(model_dir)
        self.persist = persist
        self._models: dict[str, TrainedModel] = {}
        self._locks: dict[str, threading.Lock] = {}
        self._guard = threading.Lock()

    def _lock_for(self, key: str) -> threading.Lock:
        with self._guard:
            return self._locks.setdefault(key, threading.Lock())

    def _path(self, source: str, ticker: str) -> Path:
        return self.model_dir / f"{source}_{ticker}.joblib"

    @staticmethod
    def _is_current(tm: TrainedModel, last_date: str) -> bool:
        return tm.trained_through == last_date and tm.version.endswith(model_signature())

    def get(self, ticker: str, raw: pd.DataFrame, source: str, force: bool = False) -> TrainedModel:
        df = clean_ohlcv(raw, min_rows=50)
        last = df.index[-1]
        last_date = last.strftime("%Y-%m-%d") if hasattr(last, "strftime") else str(last)
        key = f"{source}:{ticker}"

        with self._lock_for(key):
            cached = self._models.get(key)
            if cached and not force and self._is_current(cached, last_date):
                return cached

            if self.persist and not force:
                path = self._path(source, ticker)
                if path.exists():
                    try:
                        loaded = joblib.load(path)
                        if isinstance(loaded, TrainedModel) and self._is_current(loaded, last_date):
                            self._models[key] = loaded
                            return loaded
                    except Exception:  # corrupt / incompatible artifact -> retrain
                        logger.warning("Ignoring unreadable model artifact %s", path, exc_info=True)

            trained = train_model(raw, ticker, source)
            self._models[key] = trained
            if self.persist:
                try:
                    self.model_dir.mkdir(parents=True, exist_ok=True)
                    joblib.dump(trained, self._path(source, ticker), compress=3)
                except OSError:
                    logger.warning("Could not persist model for %s", ticker, exc_info=True)
            return trained


def predict_latest(tm: TrainedModel, raw: pd.DataFrame) -> dict:
    """Classify the most recent session. Returns class, per-class probabilities and the feature row."""
    df = clean_ohlcv(raw)
    feats = build_features(df)
    row = feats.iloc[[-1]]
    if row.isna().any(axis=1).iloc[0]:
        raise InsufficientDataError("Not enough price history to compute every model feature for the latest session.")

    proba = tm.model.predict_proba(row[tm.feature_columns].to_numpy())[0]
    probs = {CLASS_NAMES[c]: 0.0 for c in CLASSES}
    for j, c in enumerate(tm.model.classes_):
        probs[CLASS_NAMES[int(c)]] = round(float(proba[j]), 4)
    regime = max(probs, key=probs.get)
    return {
        "regime": regime,
        "confidence": probs[regime],
        "probabilities": probs,
        "features": row.iloc[0],
        "feature_frame": feats,
        "clean": df,
    }


def feature_importance(tm: TrainedModel, features: pd.Series, top_n: int | None = None) -> list[dict]:
    """Global (impurity-based) importance of every feature, with its current value."""
    total = sum(tm.importance.values()) or 1.0
    rows = [
        {
            "key": k,
            "label": FEATURE_META[k][0],
            "description": FEATURE_META[k][1],
            "importance": round(v / total, 4),
            "value": round(float(features[k]), 4),
        }
        for k, v in tm.importance.items()
    ]
    rows.sort(key=lambda r: r["importance"], reverse=True)
    return rows[:top_n] if top_n else rows


def local_contributions(tm: TrainedModel, features: pd.Series, predicted: str) -> list[dict]:
    """Per-prediction explanation by occlusion.

    Each feature is replaced in turn by its training-set median ("neutralised") and we measure
    how much the probability of the predicted class changes. A positive contribution means
    the feature's current value pushed the model *towards* the predicted class.
    """
    cols = tm.feature_columns
    x = features[cols].to_numpy(dtype=float)
    batch = np.tile(x, (len(cols) + 1, 1))
    for i, c in enumerate(cols):
        batch[i + 1, i] = tm.feature_medians[c]
    proba = tm.model.predict_proba(batch)
    target = [CLASS_NAMES[int(c)] for c in tm.model.classes_].index(predicted)
    base = proba[0, target]
    rows = [
        {
            "key": c,
            "label": FEATURE_META[c][0],
            "description": FEATURE_META[c][1],
            "contribution": round(float(base - proba[i + 1, target]), 4),
            "value": round(float(x[i]), 4),
        }
        for i, c in enumerate(cols)
    ]
    rows.sort(key=lambda r: abs(r["contribution"]), reverse=True)
    return rows
