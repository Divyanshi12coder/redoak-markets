"""Feature engineering, preprocessing and look-ahead safety."""
import numpy as np
import pandas as pd
import pytest

from app.ml.features import FEATURE_COLUMNS, FEATURE_META, build_features
from app.ml.preprocessing import clean_ohlcv
from app.ml.train import HORIZON, build_dataset, make_labels
from app.utils.errors import InsufficientDataError
from tests.conftest import make_ohlcv


def test_every_feature_has_metadata():
    assert set(FEATURE_COLUMNS) == set(FEATURE_META)
    assert len(FEATURE_COLUMNS) == len(set(FEATURE_COLUMNS))


def test_features_have_expected_shape_and_warmup(ohlcv):
    feats = build_features(clean_ohlcv(ohlcv))
    assert list(feats.columns) == FEATURE_COLUMNS
    assert len(feats) == len(ohlcv)
    # SMA 200 based features are NaN for the first 199 rows and defined afterwards
    assert feats["price_sma200"].iloc[:199].isna().all()
    assert feats["price_sma200"].iloc[199:].notna().all()
    assert np.isfinite(feats.dropna().to_numpy()).all()


def test_features_are_causal_no_lookahead(ohlcv):
    """Changing or removing the future must never alter features computed for the past."""
    df = clean_ohlcv(ohlcv)
    full = build_features(df)
    cut = 450
    truncated = build_features(df.iloc[:cut])
    pd.testing.assert_frame_equal(full.iloc[:cut], truncated, check_exact=False, rtol=1e-9, atol=1e-9)

    tampered = df.copy()
    tampered.iloc[cut:, tampered.columns.get_loc("close")] *= 5  # wildly different future
    tampered["high"] = tampered[["high", "close"]].max(axis=1)
    again = build_features(tampered)
    pd.testing.assert_frame_equal(full.iloc[:cut], again.iloc[:cut], check_exact=False, rtol=1e-9, atol=1e-9)


def test_labels_use_future_but_dataset_excludes_unlabelled_tail(ohlcv):
    df = clean_ohlcv(ohlcv)
    labels = make_labels(df["close"])
    assert labels.iloc[-HORIZON:].isna().all()  # no future -> no label
    X, y, _ = build_dataset(df)
    assert X.index.max() == df.index[-HORIZON - 1]
    assert set(y.unique()) <= {-1, 0, 1}
    assert not X.isna().any().any()


def test_labels_follow_volatility_adjusted_rule():
    # Constant-ish 1% daily vol, then a clear +25% jump 10 days later
    idx = pd.bdate_range("2021-01-01", periods=60)
    rng = np.random.default_rng(3)
    close = pd.Series(100 * np.exp(np.cumsum(rng.normal(0, 0.01, 60))), index=idx)
    close.iloc[40:] *= 1.25
    labels = make_labels(close)
    assert labels.iloc[30] == 1.0  # forward 10 sessions include the jump
    assert make_labels(close * 1).dropna().isin([-1, 0, 1]).all()


def test_clean_ohlcv_repairs_and_validates():
    idx = pd.to_datetime(["2024-01-03", "2024-01-02", "2024-01-02", "2024-01-04", "2024-01-05"])
    raw = pd.DataFrame(
        {"Open": [1, 2, 2, np.nan, 5], "High": [2, 3, 3, 4, 1], "Low": [1, 1, 1, 1, 6],
         "Close": [1.5, 2.5, 2.6, 3.0, 4.0], "Volume": [10, np.nan, 5, -3, 7]},
        index=idx,
    )
    out = clean_ohlcv(raw)
    assert out.index.is_monotonic_increasing and out.index.is_unique
    assert (out["high"] >= out[["open", "close"]].max(axis=1)).all()
    assert (out["low"] <= out[["open", "close"]].min(axis=1)).all()
    assert (out["volume"] >= 0).all() and out["volume"].notna().all()
    assert len(out) == 4


def test_clean_ohlcv_drops_invalid_prices_and_requires_rows():
    raw = pd.DataFrame(
        {"open": [1, 1], "high": [1, 1], "low": [1, 1], "close": [0.0, np.nan], "volume": [1, 1]},
        index=pd.bdate_range("2024-01-01", periods=2),
    )
    with pytest.raises(InsufficientDataError):
        clean_ohlcv(raw, min_rows=1)
    with pytest.raises(InsufficientDataError):
        clean_ohlcv(raw.drop(columns=["volume"]))


def test_short_history_yields_nan_not_fabricated_values():
    feats = build_features(clean_ohlcv(make_ohlcv(n=40)))
    assert feats["price_sma200"].isna().all()
    assert feats["rsi_14"].iloc[-1] == feats["rsi_14"].iloc[-1]  # RSI is available after 15 bars


def test_zero_volume_instruments_do_not_break_features():
    df = make_ohlcv(n=300)
    df["volume"] = 0.0
    feats = build_features(clean_ohlcv(df)).dropna()
    assert (feats["volume_ratio"] == 0).all()
    assert np.isfinite(feats.to_numpy()).all()
