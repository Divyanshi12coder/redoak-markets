"""Time-aware splitting, training, evaluation, inference, anomalies, regime."""
import numpy as np
import pandas as pd
import pytest

from app.ml import anomaly
from app.ml.evaluate import CLASSES, chronological_split, compute_metrics, walk_forward_evaluate, walk_forward_splits
from app.ml.predict import ModelRegistry, feature_importance, local_contributions, predict_latest
from app.ml.preprocessing import clean_ohlcv
from app.ml.regime import describe_regime, efficiency_ratio
from app.ml.train import HORIZON, build_dataset, make_model, train_model
from app.utils.errors import InsufficientDataError
from tests.conftest import make_ohlcv


# ---------------------------------------------------------------- splitting --
def test_walk_forward_splits_are_chronological_with_embargo():
    splits = list(walk_forward_splits(500, n_splits=4, gap=HORIZON))
    assert len(splits) == 4
    prev_test_end = -1
    for train, test in splits:
        assert train.max() + HORIZON < test.min()  # embargo gap respected
        assert train.min() == 0  # expanding window
        assert np.all(np.diff(train) == 1) and np.all(np.diff(test) == 1)  # never shuffled
        assert test.min() > prev_test_end  # test windows move forward in time
        prev_test_end = test.max()


def test_chronological_split_never_overlaps():
    train, test = chronological_split(100, 0.2, gap=5)
    assert train.max() < test.min() - 5 + 1
    assert len(train) == 80 and test.min() == 85


# --------------------------------------------------------------- evaluation --
def test_compute_metrics_perfect_and_confusion_matrix():
    y = np.array([-1, 0, 1, 1, 0, -1])
    proba = np.eye(3)[[CLASSES.index(c) for c in y]]
    m = compute_metrics(y, y, proba)
    assert m["accuracy"] == 1.0 and m["f1_macro"] == 1.0 and m["roc_auc_ovr"] == 1.0
    assert np.trace(np.array(m["confusion_matrix"]["matrix"])) == len(y)


def test_walk_forward_evaluate_reports_baseline_and_is_deterministic():
    X, y, _ = build_dataset(clean_ohlcv(make_ohlcv(n=900, seed=5)))
    a = walk_forward_evaluate(X, y, make_model, n_splits=3, gap=HORIZON)
    b = walk_forward_evaluate(X, y, make_model, n_splits=3, gap=HORIZON)
    assert a == b
    assert 0 <= a["accuracy"] <= 1 and 0 <= a["baseline_accuracy"] <= 1
    assert a["n_folds"] == 3 and len(a["fold_accuracy"]) == 3
    assert "walk-forward" in a["validation"]


def test_random_walk_does_not_pretend_to_have_an_edge():
    """On pure noise the validated model must not claim to beat the naive baseline by much."""
    X, y, _ = build_dataset(clean_ohlcv(make_ohlcv(n=1000, seed=11, drift=0.0)))
    m = walk_forward_evaluate(X, y, make_model, n_splits=4, gap=HORIZON)
    assert m["accuracy"] - m["baseline_accuracy"] < 0.12


# ------------------------------------------------------------ train/predict --
@pytest.fixture(scope="module")
def trained():
    raw = make_ohlcv(n=900, seed=2)
    return raw, train_model(raw, "TEST", "demo")


def test_train_model_metadata(trained):
    raw, tm = trained
    assert tm.version.startswith("rf-v1-")
    assert tm.trained_through == raw.index[-1].strftime("%Y-%m-%d")
    assert abs(sum(tm.importance.values()) - 1.0) < 1e-6
    assert tm.n_samples > 300 and set(tm.class_distribution) == {"bearish", "neutral", "bullish"}
    assert tm.description["horizon_days"] == HORIZON


def test_training_requires_enough_history():
    with pytest.raises(InsufficientDataError):
        train_model(make_ohlcv(n=250), "TINY", "demo")


def test_predict_latest_returns_valid_distribution(trained):
    raw, tm = trained
    pred = predict_latest(tm, raw)
    assert pred["regime"] in {"bullish", "bearish", "neutral"}
    assert sum(pred["probabilities"].values()) == pytest.approx(1.0, abs=1e-3)
    assert pred["confidence"] == max(pred["probabilities"].values())


def test_inference_is_deterministic(trained):
    raw, tm = trained
    assert predict_latest(tm, raw)["probabilities"] == predict_latest(tm, raw)["probabilities"]


def test_predict_requires_complete_features():
    raw = make_ohlcv(n=900, seed=2)
    tm = train_model(raw, "TEST", "demo")
    with pytest.raises(InsufficientDataError):
        predict_latest(tm, raw.iloc[:100])  # no SMA200 -> cannot build a full feature row


def test_feature_importance_and_local_contributions(trained):
    raw, tm = trained
    pred = predict_latest(tm, raw)
    glob = feature_importance(tm, pred["features"])
    assert glob == sorted(glob, key=lambda r: r["importance"], reverse=True)
    assert {"key", "label", "description", "importance", "value"} <= glob[0].keys()
    local = local_contributions(tm, pred["features"], pred["regime"])
    assert len(local) == len(glob)
    assert [abs(r["contribution"]) for r in local] == sorted((abs(r["contribution"]) for r in local), reverse=True)


def test_registry_reuses_and_persists_models(tmp_path):
    raw = make_ohlcv(n=700, seed=4)
    reg = ModelRegistry(tmp_path, persist=True)
    first = reg.get("PERSIST", raw, "demo")
    assert reg.get("PERSIST", raw, "demo") is first  # in-memory reuse
    assert (tmp_path / "demo_PERSIST.joblib").exists()
    fresh = ModelRegistry(tmp_path, persist=True).get("PERSIST", raw, "demo")  # loaded from disk
    assert fresh.version == first.version and fresh.trained_through == first.trained_through
    # a new bar invalidates the cached model
    longer = make_ohlcv(n=701, seed=4)
    assert ModelRegistry(tmp_path, persist=True).get("PERSIST", longer, "demo").trained_through != first.trained_through


# ------------------------------------------------------------------ anomaly --
def test_anomaly_detects_volume_spike_and_price_shock():
    df = make_ohlcv(n=500, seed=9)
    df.iloc[-1, df.columns.get_loc("volume")] *= 40
    result = anomaly.detect_anomalies(clean_ohlcv(df))
    assert result["detected"] and "volume" in result["kinds"]
    assert result["headline"].startswith("Unusual")

    shock = make_ohlcv(n=500, seed=9)
    shock.iloc[-1, shock.columns.get_loc("close")] = shock["close"].iloc[-2] * 1.35
    shock["high"] = shock[["high", "close"]].max(axis=1)
    out = anomaly.detect_anomalies(clean_ohlcv(shock))
    assert "price" in out["kinds"]


def test_anomaly_quiet_series_reports_none():
    result = anomaly.detect_anomalies(clean_ohlcv(make_ohlcv(n=500, seed=21)))
    assert result["available"] and result["detected"] is False
    assert result["headline"] == "No Significant Anomaly Detected"
    assert "not indicate" in result["note"]


def test_anomaly_baseline_excludes_current_bar():
    """A spike must not hide itself by inflating its own baseline (look-ahead)."""
    df = make_ohlcv(n=300, seed=1)
    z_before = anomaly.anomaly_frame(clean_ohlcv(df))["z_volume"].iloc[-1]
    spiked = df.copy()
    spiked.iloc[-1, spiked.columns.get_loc("volume")] *= 100
    z_after = anomaly.anomaly_frame(clean_ohlcv(spiked))["z_volume"].iloc[-1]
    assert z_after > z_before + 5


def test_anomaly_needs_history():
    out = anomaly.detect_anomalies(clean_ohlcv(make_ohlcv(n=50)))
    assert out["available"] is False and out["detected"] is False


# ------------------------------------------------------------------- regime --
def test_efficiency_ratio_extremes():
    straight = pd.Series(np.arange(1.0, 40.0))
    chop = pd.Series([1.0, 2.0] * 20)
    assert efficiency_ratio(straight) == pytest.approx(1.0)
    assert efficiency_ratio(chop) < 0.1


def test_regime_description_comes_from_calculated_values(trained):
    raw, tm = trained
    pred = predict_latest(tm, raw)
    reg = describe_regime(pred["clean"], pred["feature_frame"], pred["regime"])
    assert reg["trend"]["label"] == pred["regime"].capitalize()
    assert reg["volatility"]["label"] in {"Low", "Moderate", "High"}
    assert reg["volume"]["label"] in {"Above average", "Average", "Below average"}
    assert reg["momentum"]["label"] in {"Weak", "Moderate", "Strong"}
    assert reg["character"]["label"] in {"Trending", "Sideways"}
