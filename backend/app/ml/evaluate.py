"""Model evaluation: time-aware splitting and classification metrics."""
from __future__ import annotations

from typing import Callable, Iterator

import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import TimeSeriesSplit

CLASSES = [-1, 0, 1]
CLASS_NAMES = {-1: "bearish", 0: "neutral", 1: "bullish"}
# A model must beat the "always predict the training majority class" baseline by at least
# this much accuracy before we describe it as showing any historical edge.
EDGE_MARGIN = 0.02


def walk_forward_splits(n_samples: int, n_splits: int, gap: int) -> Iterator[tuple[np.ndarray, np.ndarray]]:
    """Expanding-window walk-forward splits with an embargo ``gap``.

    Training always precedes testing chronologically (no shuffling). ``gap`` rows are skipped
    between the end of the training window and the start of the test window: labels look
    ``horizon`` bars into the future, so without the gap the last training labels would
    overlap with the first test period.
    """
    yield from TimeSeriesSplit(n_splits=n_splits, gap=gap).split(np.arange(n_samples))


def chronological_split(n_samples: int, test_fraction: float, gap: int) -> tuple[np.ndarray, np.ndarray]:
    """Single chronological train/test split with an embargo gap."""
    split = int(n_samples * (1 - test_fraction))
    return np.arange(0, split), np.arange(split + gap, n_samples)


def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray, proba: np.ndarray | None) -> dict:
    """Classification metrics for 3-class bearish / neutral / bullish predictions.

    ``proba`` columns must be ordered like ``CLASSES``.
    """
    cm = confusion_matrix(y_true, y_pred, labels=CLASSES)
    per_class = {}
    prec = precision_score(y_true, y_pred, labels=CLASSES, average=None, zero_division=0)
    rec = recall_score(y_true, y_pred, labels=CLASSES, average=None, zero_division=0)
    f1 = f1_score(y_true, y_pred, labels=CLASSES, average=None, zero_division=0)
    for i, c in enumerate(CLASSES):
        per_class[CLASS_NAMES[c]] = {
            "precision": round(float(prec[i]), 4),
            "recall": round(float(rec[i]), 4),
            "f1": round(float(f1[i]), 4),
            "support": int((y_true == c).sum()),
        }

    auc = None
    if proba is not None and len(np.unique(y_true)) == len(CLASSES):
        try:
            auc = round(float(roc_auc_score(y_true, proba, multi_class="ovr", average="macro", labels=CLASSES)), 4)
        except ValueError:
            auc = None

    return {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "balanced_accuracy": round(float(balanced_accuracy_score(y_true, y_pred)), 4),
        "precision_macro": round(float(prec.mean()), 4),
        "recall_macro": round(float(rec.mean()), 4),
        "f1_macro": round(float(f1.mean()), 4),
        "roc_auc_ovr": auc,
        "confusion_matrix": {"labels": [CLASS_NAMES[c] for c in CLASSES], "matrix": cm.tolist()},
        "per_class": per_class,
    }


def _align_proba(model, proba: np.ndarray) -> np.ndarray:
    """Re-order predict_proba columns to ``CLASSES`` (a fold may be missing a class)."""
    out = np.zeros((proba.shape[0], len(CLASSES)))
    for j, c in enumerate(model.classes_):
        out[:, CLASSES.index(int(c))] = proba[:, j]
    return out


def walk_forward_evaluate(
    X: pd.DataFrame,
    y: pd.Series,
    make_model: Callable[[], object],
    n_splits: int = 4,
    gap: int = 10,
) -> dict:
    """Out-of-sample evaluation using expanding-window walk-forward validation.

    Predictions from all test folds are concatenated and scored once, so every reported
    number comes from data the corresponding model had never seen.
    """
    Xv, yv = X.to_numpy(), y.to_numpy().astype(int)
    preds, probas, truths, baselines, fold_acc = [], [], [], [], []

    for train_idx, test_idx in walk_forward_splits(len(Xv), n_splits, gap):
        model = make_model()
        model.fit(Xv[train_idx], yv[train_idx])
        p = model.predict(Xv[test_idx])
        preds.append(p)
        probas.append(_align_proba(model, model.predict_proba(Xv[test_idx])))
        truths.append(yv[test_idx])
        values, counts = np.unique(yv[train_idx], return_counts=True)
        majority = values[counts.argmax()]
        baselines.append(np.full(len(test_idx), majority))
        fold_acc.append(round(float(accuracy_score(yv[test_idx], p)), 4))

    y_true, y_pred = np.concatenate(truths), np.concatenate(preds)
    metrics = compute_metrics(y_true, y_pred, np.vstack(probas))
    baseline_acc = float(accuracy_score(y_true, np.concatenate(baselines)))
    metrics.update({
        "baseline_accuracy": round(baseline_acc, 4),
        "beats_baseline": bool(metrics["accuracy"] - baseline_acc >= EDGE_MARGIN),
        "n_folds": n_splits,
        "n_test_samples": int(len(y_true)),
        "fold_accuracy": fold_acc,
        "validation": f"expanding-window walk-forward, {n_splits} folds, {gap}-bar embargo",
    })
    return metrics
