"""Indicator maths, checked against hand-computed values."""
import numpy as np
import pandas as pd
import pytest

from app.indicators import core
from app.indicators.signals import build_signal_summary


def s(values):
    return pd.Series(values, index=pd.RangeIndex(len(values)), dtype=float)


def test_sma_matches_manual_mean_and_has_nan_warmup():
    out = core.sma(s([1, 2, 3, 4, 5, 6]), 3)
    assert out.iloc[:2].isna().all()
    assert out.iloc[2:].tolist() == [2.0, 3.0, 4.0, 5.0]


def test_ema_recursion_matches_definition():
    close = s([10, 11, 12, 11, 13])
    out = core.ema(close, 3)  # alpha = 0.5
    expected = [10.0]
    for x in close.iloc[1:]:
        expected.append(0.5 * x + 0.5 * expected[-1])
    assert out.iloc[:2].isna().all()
    assert out.iloc[2:].tolist() == pytest.approx(expected[2:])


def test_rsi_wilder_hand_computed():
    # 4 periods, changes: +1 +1 -1 +1 (seed on first 3 changes, then one Wilder step)
    close = s([10, 11, 12, 11, 12])
    out = core.rsi(close, 3)
    # seed: avg gain = (1+1+0)/3, avg loss = (0+0+1)/3 -> RS = 2 -> RSI = 66.667
    assert out.iloc[3] == pytest.approx(100 - 100 / (1 + 2.0))
    # next change +1: gain=(2/3*2+1)/3=7/9, loss=(1/3*2+0)/3=2/9 -> RS=3.5
    assert out.iloc[4] == pytest.approx(100 - 100 / (1 + 3.5))
    assert out.iloc[:3].isna().all()


def test_rsi_bounds_and_extremes():
    rising = core.rsi(s(np.arange(1, 40)), 14)
    assert rising.dropna().eq(100.0).all()
    falling = core.rsi(s(np.arange(40, 1, -1)), 14)
    assert falling.dropna().eq(0.0).all()
    flat = core.rsi(s([5.0] * 30), 14)
    assert flat.dropna().eq(50.0).all()
    rnd = core.rsi(s(np.random.default_rng(1).normal(100, 3, 300)), 14).dropna()
    assert rnd.between(0, 100).all()


def test_macd_components_are_consistent(ohlcv):
    m = core.macd(ohlcv["close"])
    valid = m.dropna()
    assert (valid["macd_hist"] - (valid["macd"] - valid["macd_signal"])).abs().max() < 1e-12
    assert m["macd"].dropna().index[0] == ohlcv.index[25]  # slow EMA warm-up (26 bars)


def test_bollinger_bands_symmetry_and_pct_b():
    close = s(np.linspace(100, 130, 40))
    bb = core.bollinger(close, 20, 2.0)
    v = bb.dropna()
    assert ((v["bb_upper"] - v["bb_mid"]) - (v["bb_mid"] - v["bb_lower"])).abs().max() < 1e-9
    assert (v["bb_upper"] > v["bb_lower"]).all()
    # a steadily rising series closes in the upper half of its bands
    assert (v["bb_pct_b"] > 0.5).all()


def test_atr_true_range_uses_gaps():
    df = pd.DataFrame({"high": [10, 12, 13], "low": [9, 11, 12], "close": [9.5, 11.5, 12.5]})
    tr = core.true_range(df)
    assert tr.tolist() == [1.0, 2.5, 1.5]  # bar 2: |high - prev close| = 2.5 beats high-low = 1


def test_indicators_are_causal(ohlcv):
    """Truncating future data must not change any past indicator value."""
    full = core.compute_indicator_frame(ohlcv)
    cut = core.compute_indicator_frame(ohlcv.iloc[:400])
    pd.testing.assert_frame_equal(full.iloc[:400], cut, check_exact=False, rtol=1e-9, atol=1e-9)


def test_signal_summary_bullish_on_strong_uptrend():
    n = 320
    close = pd.Series(np.linspace(50, 200, n) + np.sin(np.arange(n)), index=pd.bdate_range("2021-01-01", periods=n))
    df = pd.DataFrame({"open": close, "high": close * 1.01, "low": close * 0.99, "close": close, "volume": 1e6})
    summary = build_signal_summary(df, core.compute_indicator_frame(df))
    assert summary["overall"]["label"] == "Bullish signal"
    assert 0.5 < summary["overall"]["position"] <= 1.0
    assert summary["components"]["moving_average"]["label"] == "Bullish signal"


def test_signal_summary_bearish_on_downtrend_and_flags_oversold():
    n = 320
    close = pd.Series(np.linspace(200, 50, n), index=pd.bdate_range("2021-01-01", periods=n))
    df = pd.DataFrame({"open": close, "high": close * 1.01, "low": close * 0.99, "close": close, "volume": 1e6})
    summary = build_signal_summary(df, core.compute_indicator_frame(df))
    assert summary["overall"]["label"] == "Bearish signal"
    assert summary["components"]["rsi"]["label"] == "Potentially oversold"


def test_signal_summary_handles_short_history():
    n = 25
    close = pd.Series(np.linspace(10, 12, n), index=pd.bdate_range("2021-01-01", periods=n))
    df = pd.DataFrame({"open": close, "high": close, "low": close, "close": close, "volume": 1e6})
    summary = build_signal_summary(df, core.compute_indicator_frame(df))
    assert summary["components"]["moving_average"]["label"] in {"Bullish signal", "Neutral", "Bearish signal"}
    assert all(r["key"] != "price_vs_sma200" for r in summary["rules"])
