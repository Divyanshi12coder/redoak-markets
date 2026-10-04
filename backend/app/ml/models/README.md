# Model artifacts

This directory holds trained model artifacts (`<source>_<TICKER>.joblib`) written by
`ModelRegistry` the first time a ticker is analysed, or by:

```bash
python -m app.ml.train AAPL MSFT
```

* Artifacts are **git-ignored** - they are reproducible from market data and the training code,
  and are small (a few hundred KB) but would go stale with every new trading day.
* A cached artifact is reused only while the latest bar date and the model signature
  (feature list, hyper-parameters, target definition) match; otherwise the model is retrained.
* `joblib` uses `pickle`. Only load artifacts produced by this application from a directory
  you control.
* To disable persistence (e.g. read-only file systems) set `ML_PERSIST_MODELS=false`; models are
  then trained on first use and held in memory.
