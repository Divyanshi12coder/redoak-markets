<div align="center">

<img src="docs/assets/hero-banner.png" alt="RedOak Markets - See the market. Understand the trend." width="100%" />

# RedOak Markets

**See the market. Understand the trend.**

[![Python](https://img.shields.io/badge/Python-3.12-14452d?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-REST-1d5d3f?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-0f3724?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-164a32?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-7d1d2d?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![pandas](https://img.shields.io/badge/pandas-indicators-5f1623?logo=pandas&logoColor=white)](https://pandas.pydata.org/)
[![scikit-learn](https://img.shields.io/badge/scikit--learn-ML-9a2639?logo=scikitlearn&logoColor=white)](https://scikit-learn.org/)
[![Docker](https://img.shields.io/badge/Docker-compose-0a2519?logo=docker&logoColor=white)](https://www.docker.com/)
[![GitHub](https://img.shields.io/badge/GitHub-source-06150e?logo=github&logoColor=white)](https://github.com/Divyanshi12coder/red-oak-markets)
[![License: MIT](https://img.shields.io/badge/License-MIT-430f19.svg)](LICENSE)

</div>

RedOak Markets is a full-stack market-analysis platform. It pulls market data through a FastAPI backend, calculates technical indicators with pandas, classifies the current market regime with a **time-aware, honestly-evaluated** scikit-learn model, flags unusual activity, and has an analyst named **Dia** explain all of it in plain English - without ever predicting prices.

> [!IMPORTANT]
> **RedOak Markets provides educational and analytical information only. Technical indicators and signals are not guarantees of future performance and should not be considered financial advice.**
> The ML output is an experimental classification. It never reports "the stock will go up 93%": it reports a class probability, shows how the model scored out-of-sample against a naive baseline, and says so when it has **no edge**.

<p align="center"><img src="docs/assets/analyzer.png" alt="Stock analyzer with chart, signal meter and Dia's analysis" width="88%" /></p>

## Contents

[Demo](#demo--live-application) · [Screenshots](#screenshots) · [Why RedOak?](#why-redoak-markets) · [Features](#features) · [How it works](#how-it-works) · [Architecture](#system-architecture) · [Tech stack](#tech-stack) · [Technical indicators](#technical-indicators) · [**AI & ML**](#ai--machine-learning) · [API](#api-documentation) · [Database](#database-architecture) · [Structure](#project-structure) · [Install](#installation) · [Env vars](#environment-variables) · [Docker](#docker-setup) · [Testing](#testing) · [Deploy](#deployment) · [Roadmap](#future-improvements) · [Author](#built--created-by)

## Demo / Live application

No hosted instance is bundled with the repository. Run it in two minutes with **synthetic demo data** (no API key needed), or plug in a [Twelve Data](https://twelvedata.com) key for real provider data - see [Installation](#installation).

| Mode | Command | Data |
|---|---|---|
| **Demo** (default) | `MARKET_DATA_PROVIDER=demo` | Seeded random-walk prices. Every API response is tagged `source: "demo"` and the UI shows a permanent **DEMO DATA** banner. |
| **Live provider** | `MARKET_DATA_PROVIDER=twelvedata` + `MARKET_DATA_API_KEY` | Twelve Data quotes / history. Labelled "may be delayed" - never "real-time". |

A local demo user, **Dia**, is created by `python -m app.scripts.seed` (`dia@redoak.dev`, see [Installation](#installation)).

## Screenshots

Captured from the running application (demo data) with `npm run screenshots`.

| Home | Markets |
|---|---|
| ![Home](docs/assets/home.png) | ![Markets](docs/assets/markets.png) |

| Dashboard | Comparison |
|---|---|
| ![Dashboard](docs/assets/dashboard.png) | ![Comparison](docs/assets/comparison.png) |

| Watchlist | Mobile |
|---|---|
| ![Watchlist](docs/assets/watchlist.png) | <img src="docs/assets/mobile-analyzer.png" alt="Mobile analyzer" width="260" /> |

## Why RedOak Markets?

Most hobby dashboards show numbers and a confident-sounding "AI score". RedOak is built around the opposite idea:

| Typical dashboard | RedOak Markets |
|---|---|
| "AI predicts +93%" | Class probability, out-of-sample metrics **and** a naive-baseline comparison |
| Random train/test split on time series | Walk-forward validation with an embargo gap; features proven causal by tests |
| Black-box score | Rule-by-rule signal explanations, global + per-prediction feature importance |
| LLM that can say anything | Dia only paraphrases calculated facts; LLM replies with invented numbers or predictions are rejected |
| Silent fake data | Demo data is labelled everywhere; provider data is labelled "may be delayed" |

## Features

- **Search** by ticker or company name (ARIA combobox, keyboard navigable) with price and daily change.
- **Analyzer** `/analyze/AAPL`: header, 1D-5Y ranges, candles / line / area, zoom, crosshair tooltip, SMA 20/50/200, EMA 20/50, Bollinger, RSI 14 and MACD panes, volume - all toggleable.
- **Technical signal meter** with the exact rules that fired ("Bullish signal", "Potentially overbought", "Momentum strengthening"...).
- **Dia's Market Analysis**: regime dashboard, class probabilities, feature importance (global / this-analysis), anomaly detection, model report card, plain-English summary.
- **Markets** overview: index proxies, gainers, losers, most active, advancers/decliners, one-year performance carousel.
- **Compare** 2-4 stocks: rebased performance chart, summary cards, side-by-side table (shareable URL).
- **Accounts**: sign-up / login, bcrypt hashing, JWT, protected routes, **watchlist persisted in PostgreSQL** (add, remove, drag-and-drop reorder), preferences, recently analysed stocks, stored model-analysis history.
- **Resilience**: skeleton loaders, friendly errors, empty states, server-side caching with stale-on-error, provider rate-limit handling and retries.
- **Accessibility**: semantic landmarks, skip link, focus rings, ARIA meters/comboboxes, colour never the only signal (arrows + signs), `prefers-reduced-motion` respected.

## How it works

1. **Fetch** - the backend asks the market-data provider for quotes and daily bars (cached, rate-limited, retried).
2. **Calculate** - pandas computes indicators and a leak-free feature matrix.
3. **Classify** - a per-stock random forest, validated walk-forward, labels the current regime.
4. **Explain** - Dia turns calculated values into a grounded summary.
5. **Persist** - accounts, watchlists, history and model metadata live in PostgreSQL.

## System architecture

<p align="center"><img src="docs/assets/architecture.png" alt="System architecture" width="100%" /></p>

```text
User → React frontend → FastAPI backend → Market data API
                              │                 ↓
                              │       pandas indicators / ML pipeline → Dia
                              ↓
                         PostgreSQL  (auth · watchlist · history · model metadata)
```

**Authentication & watchlist flow:** `POST /api/auth/register|login` → bcrypt-verified → short-lived JWT returned → sent as `Authorization: Bearer` → `get_current_user` dependency loads the user → watchlist routes read/write `watchlists` / `watchlist_stocks` through SQLAlchemy.

**Design notes**
- Market data is behind a `MarketDataProvider` interface (Twelve Data, demo). Caching, stale-on-error fallback and the credit limiter live in `MarketDataService`, not in routes.
- One daily-bar fetch per ticker feeds history (1M-5Y), indicators (with a 200-bar warm-up so SMA 200 is valid at the left edge), signals, ML and comparison.
- The in-process TTL cache is deliberate for a single instance; a multi-instance deployment would swap it for Redis (see roadmap).

## Tech stack

Only technologies that are actually used in this repository:

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript (strict), Vite, Tailwind CSS v4 (palette locked to RedOak colours), Framer Motion, TanStack Query, React Router, TradingView Lightweight Charts, Vitest + Testing Library |
| **Backend** | Python, FastAPI, Pydantic v2, pandas, NumPy, httpx, PyJWT, bcrypt, pytest |
| **Database** | PostgreSQL (SQLite for tests/local), SQLAlchemy 2, Alembic |
| **AI / ML** | scikit-learn `RandomForestClassifier`, `IsolationForest`, `TimeSeriesSplit` (walk-forward), joblib, optional LLM via the Anthropic Messages API |
| **Infrastructure** | Docker, Docker Compose, nginx, GitHub Actions, Vercel (frontend), Render (backend + PostgreSQL) |

## Technical indicators

All calculated server-side with pandas/NumPy ([`backend/app/indicators/core.py`](backend/app/indicators/core.py)) and unit-tested against hand-computed values.

| Indicator | Definition |
|---|---|
| SMA 20 / 50 / 200 | Rolling mean of closes |
| EMA 20 / 50 | Recursive `α = 2/(n+1)` smoothing |
| RSI 14 | Wilder smoothing (seeded with a simple mean); 100 when no losses, 50 when flat |
| MACD | EMA12 − EMA26, 9-period signal, histogram |
| Bollinger | SMA20 ± 2σ, %B and width |
| ATR 14 | Wilder-smoothed true range (includes overnight gaps) |

**Rule-based signal** ([`signals.py`](backend/app/indicators/signals.py)): price vs SMA 20/50/200, SMA 50/200 relationship and golden/death-cross detection, EMA 20/50 state and recent crossover, MACD histogram, RSI vs 30/70 → weighted composite in [−1, +1]. Thresholds: ≥ +0.25 *Bullish signal*, ≤ −0.25 *Bearish signal*, otherwise *Neutral*.

## AI & Machine Learning

```text
Market Data
     ↓
Data Cleaning                  (ml/preprocessing.py)
     ↓
Feature Engineering            (ml/features.py - 22 causal features)
     ↓
Technical Indicators           (indicators/core.py)
     ↓
ML Model                       (ml/train.py · evaluate.py · predict.py)
     ├── Market Regime         bullish / bearish / neutral + trend / momentum / volatility / volume
     ├── Anomaly Detection     (ml/anomaly.py)
     └── Feature Importance    global + per-prediction
             ↓
        Dia AI Analyst         (services/dia.py)
             ↓
      Human-readable Analysis
```

### 1. Data collection
Daily OHLCV from the configured provider (~1,500 bars ≈ 6 years), cached for an hour.

### 2. Feature engineering
Returns (1d log, 1/5/10/20d), rolling volatility and its short/long ratio, price/SMA ratios, SMA & EMA relationships, RSI, MACD (normalised), Bollinger %B and width, volume change and ratio to its 20-day average, high-low range, ATR. Everything is **scale-free** (ratios), because raw price levels are non-stationary. Missing values and insufficient history stay `NaN` and those rows are excluded - never imputed. A test recomputes features on truncated and tampered future data and asserts past values are identical.

### 3. Technical indicators
Shared with the UI so the model and the charts can never disagree.

### 4. ML classification
**Target:** for each session, the class of the *next 10 sessions' return* relative to ±0.5 × trailing volatility × √10 → bullish / bearish / neutral. **Model:** a shallow random forest (150 trees, depth 5, `min_samples_leaf=15`, balanced class weights) - lightweight, explainable, and hard to overfit on ~1,000 rows. One model is trained per stock on demand, versioned `rf-v1-<signature>`, cached in memory and persisted with joblib (git-ignored).

> **Time-aware by design.** Financial data is never shuffled. Training always precedes testing; labels look 10 sessions ahead, so a **10-session embargo gap** separates train and test windows so no training label overlaps the test period.

### 5. Anomaly detection
Two complementary detectors: rolling **robust z-scores** (median / MAD of the *previous* 60 sessions, so a spike cannot hide itself) on returns, log-volume and intraday range, plus an **Isolation Forest** fit on history older than the evaluation window. Output: *Unusual Volume Activity Detected*, *Unusual Price Movement Detected* or *No Significant Anomaly Detected*. An anomaly says nothing about direction.

### 6. Model evaluation
Expanding-window **walk-forward** validation (4 folds + embargo) on out-of-sample predictions: accuracy, balanced accuracy, macro precision / recall / F1, one-vs-rest ROC-AUC, confusion matrix, per-fold accuracy - **and a "most frequent class" baseline**. `beats_baseline` is only true if accuracy exceeds the baseline by ≥ 2 pp. On pure noise (and on the synthetic demo data) the app correctly reports **"No historical edge detected"**; a test guards that the model does not claim an edge on a random walk.

**Limitations of historical back-testing** (also shown in the UI): regime changes, news and liquidity shocks are not captured; a single stock's history is a small sample; transaction costs and slippage are ignored; hyper-parameters were not tuned per stock, but metrics can still look better or worse by chance.

### 7. Feature importance
*Overall model:* impurity-based random-forest importance. *This analysis:* an occlusion test - each feature is replaced by its training median and the change in the predicted class's probability is the feature's signed contribution. Both are interactive in the UI.

### 8. Dia's natural-language analysis
Dia receives a structured facts dictionary (price, RSI, SMAs/EMAs, volatility, volume ratio, ML regime, baseline comparison, anomaly headline...) and writes a hedged summary. It **always** has a deterministic template path (no key needed). If `LLM_API_KEY` is set, the LLM receives the *same JSON* and its reply is validated: it is **rejected** if it contains numbers absent from the facts or phrases such as "will rise", "guarantee", "buy now" - the template is shown instead. If the LLM is down, analysis still works.

```json
{ "ticker": "AAPL", "price": 214.3, "rsi": 54.4, "sma_20": 214.24, "sma_50": 208.08,
  "ema_20": 211.58, "volatility": 0.301, "volume_change": 1.4, "ml_regime": "bullish",
  "model_beats_baseline": false, "anomaly": "No Significant Anomaly Detected" }
```

### Model management & prediction history
```text
backend/app/ml/
├── preprocessing.py   cleaning, validation
├── features.py        feature pipeline + metadata
├── train.py           target definition, training, CLI:  python -m app.ml.train AAPL MSFT
├── evaluate.py        walk-forward splits, metrics, baseline
├── predict.py         ModelRegistry, inference, feature importance
├── anomaly.py         robust z-score + Isolation Forest
├── regime.py          trend character / volatility / momentum / volume descriptors
└── models/            artifacts (git-ignored) - see models/README.md
```
Every ML analysis by a signed-in user stores model version, classification, class probability, volatility regime, anomaly flag, hold-out vs baseline accuracy, data source and timestamp in the `ml_analysis` table (metadata only, never raw model output).

## API documentation

Interactive Swagger UI at **`/api/docs`** (ReDoc at `/api/redoc`, schema at `/api/openapi.json`).

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | - | Liveness, DB status, data-provider mode |
| GET | `/api/market/overview` | - | Index proxies, movers, volume |
| GET | `/api/stocks/search?q=` | - | Ticker / company search with prices |
| GET | `/api/stocks/{ticker}` | - | Latest quote |
| GET | `/api/stocks/{ticker}/history?range=` | - | OHLCV (`1D 5D 1M 3M 6M 1Y 5Y`) |
| GET | `/api/stocks/{ticker}/indicators?range=` | - | SMA, EMA, RSI, MACD, Bollinger series |
| GET | `/api/stocks/{ticker}/analysis` | optional | Rule-based signal (records history if signed in) |
| GET | `/api/stocks/{ticker}/ml-analysis` | optional | Full ML + anomaly + Dia analysis |
| GET | `/api/stocks/{ticker}/regime` · `/anomalies` · `/feature-importance` | - | Sub-resources of the ML analysis |
| GET | `/api/compare?tickers=A,B,C&range=` | - | 2-4 stock comparison |
| POST | `/api/auth/register` · `/api/auth/login` | - | Create account / log in (rate limited) |
| GET | `/api/user/profile` | ✔ | User, preferences, recent tickers |
| PUT | `/api/user/preferences` | ✔ | Default chart view |
| GET | `/api/user/history` · `/api/user/ml-history` | ✔ | Analysis history / stored model outputs |
| GET · POST | `/api/watchlist` | ✔ | List (with quotes) / add |
| DELETE | `/api/watchlist/{ticker}` | ✔ | Remove |
| PUT | `/api/watchlist/order` | ✔ | Persist drag-and-drop order |

Errors share one shape: `{"error": {"code": "rate_limited", "message": "...", "retry_after": 30}}`.

## Database architecture

```text
users ──1:1── user_preferences
  │
  ├──1:1── watchlists ──1:N── watchlist_stocks (ticker, position, UNIQUE(watchlist_id, ticker))
  ├──1:N── analysis_history (ticker, analyzed_at)
  └──1:N── ml_analysis (ticker, model_version, regime, confidence, volatility_regime,
                        anomaly_detected, holdout_accuracy, baseline_accuracy, data_source, analyzed_at)
```
Migrations live in `backend/alembic/`. SQL injection is prevented by the ORM (parameterised queries only).

## Project structure

```text
red-oak-markets/
├── backend/
│   ├── app/
│   │   ├── main.py              app factory, CORS, error handlers
│   │   ├── config.py            env-driven settings
│   │   ├── api/                 routers: health, market, stocks, auth, user, watchlist
│   │   ├── auth/                bcrypt + JWT
│   │   ├── database/            engine / session / declarative base
│   │   ├── models/              SQLAlchemy models
│   │   ├── schemas/             Pydantic request / response models
│   │   ├── services/            market data (twelvedata, demo, cache), analysis, dia, container
│   │   ├── indicators/          pandas indicators + rule-based signals
│   │   ├── ml/                  feature pipeline, training, evaluation, inference, anomalies
│   │   ├── scripts/seed.py      demo user "Dia"
│   │   └── utils/               errors, cache, rate limiters, ticker validation
│   ├── alembic/                 migrations
│   ├── tests/                   99 tests
│   ├── Dockerfile · requirements*.txt
├── frontend/
│   ├── src/                     api · charts · components · context · hooks · layouts · pages · types · utils
│   ├── scripts/                 screenshots.mjs · build-docs-assets.mjs
│   ├── Dockerfile · nginx.conf · vercel.json
├── docs/assets/                 banner, architecture, logo, screenshots
├── .github/workflows/ci.yml
├── docker-compose.yml · render.yaml · .env.example
└── LICENSE · README.md
```

## Installation

Requirements: Python 3.11+, Node 20+, PostgreSQL 15+ (optional locally - SQLite works for a quick start).

```bash
git clone https://github.com/Divyanshi12coder/red-oak-markets.git
cd red-oak-markets
```

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp ../.env.example .env              # then edit - see "Environment variables"
```

**PostgreSQL** (recommended):

```bash
createdb redoak                      # or: docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=redoak_dev_password \
                                     #       -e POSTGRES_USER=redoak -e POSTGRES_DB=redoak postgres:16-alpine
# in .env:  DATABASE_URL=postgresql://redoak:redoak_dev_password@localhost:5432/redoak
```
For a zero-setup start use `DATABASE_URL=sqlite:///./dev.db`.

```bash
alembic upgrade head                 # create / upgrade the schema
python -m app.scripts.seed           # optional: demo user "Dia" (dia@redoak.dev / DiaDemo2025!, local only)
uvicorn app.main:app --reload        # http://localhost:8000/api/docs
```

### Frontend

```bash
cd frontend
npm install
npm run dev                          # http://localhost:5173  (proxies /api → http://localhost:8000)
```
If your API runs on another port: `VITE_DEV_PROXY_TARGET=http://localhost:9000 npm run dev`.

### Using real market data

```bash
# backend/.env
MARKET_DATA_PROVIDER=twelvedata
MARKET_DATA_API_KEY=your_key
MARKET_DATA_CREDITS_PER_MINUTE=8     # free plan; raise for paid plans
```
Twelve Data's free plan is credit-limited (one credit per symbol per request). RedOak caches aggressively, waits for credits within a budget, then returns HTTP 429 with `Retry-After`, serving stale cache where it has it.

## Environment variables

See [`.env.example`](.env.example).

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | backend | SQLAlchemy URL (`postgres://` from Render is auto-normalised) |
| `JWT_SECRET` | backend | Signing key - **required (≥ 32 chars) in production** |
| `CORS_ORIGINS` | backend | Comma-separated allowed browser origins |
| `MARKET_DATA_PROVIDER` | backend | `demo` or `twelvedata` |
| `MARKET_DATA_API_KEY` | backend | Provider key (never committed) |
| `LLM_API_KEY` | backend | Optional - enables LLM-assisted Dia summaries |
| `VITE_API_URL` | frontend (build) | API origin in production; empty in dev / docker |
| `VITE_GITHUB_URL` | frontend (build) | Link used by the GitHub button |

## Running locally

Two terminals: `uvicorn app.main:app --reload` in `backend/` and `npm run dev` in `frontend/`. Seed the demo user, open <http://localhost:5173>, log in as **Dia**.

## Docker setup

```bash
cp .env.example .env
docker compose up --build
# app:  http://localhost:5173     API docs: http://localhost:8000/api/docs
```
Services: `db` (PostgreSQL 16, health-checked), `backend` (runs `alembic upgrade head` then uvicorn), `frontend` (nginx serving the build and proxying `/api`). Seed the demo user with `docker compose exec backend python -m app.scripts.seed`.

## Testing

```bash
cd backend  && pytest -q            # 99 tests
cd frontend && npm run typecheck && npm test && npm run build
```

**Backend (99):** indicator maths vs hand-computed values and causality; feature engineering, missing/short/zero-volume data, **no look-ahead**; time-series splits (chronological, embargo); metrics & baseline; training, deterministic inference, registry persistence; anomaly detection; Dia grounding & LLM-output rejection; Twelve Data parsing, retries, error mapping, caching & stale fallback, credit limiter (mocked transport); auth (hashing, JWT forgery/expiry, throttling); watchlist CRUD, ordering, privacy; history persistence; API contracts, CORS, headers.
**Frontend (16):** formatters, API client error handling and session expiry, signal meter accessibility, search combobox (mouse, keyboard, error), auth form validation and server errors.

CI runs both suites plus migrations on every push (`.github/workflows/ci.yml`).

### Verification status

Honest notes on what was and was not exercised while building this:

- ✅ Backend tests, frontend typecheck / tests / production build, migrations on SQLite, and the running app (screenshots in this README are from it).
- ⚠️ **Docker / docker-compose and a live PostgreSQL were not available in the build environment**, so the Docker files and the Postgres path are written to standard practice but untested here. The schema uses portable SQLAlchemy types and the migration is plain `op.create_table`.
- ⚠️ The **Twelve Data integration was tested against a mocked HTTP transport**, not the live API (no key was available). Field names follow Twelve Data's documented responses; if the provider changes a field the parser degrades with a clear error rather than fake data.
- ⚠️ The optional LLM path is tested with a mocked transport only.

## Deployment

**Database & backend - Render.** Use the [`render.yaml`](render.yaml) blueprint (PostgreSQL + Docker web service) or create them manually. Set `ENVIRONMENT=production`, `JWT_SECRET` (generated), `MARKET_DATA_PROVIDER=twelvedata`, `MARKET_DATA_API_KEY`, and `CORS_ORIGINS=https://<your-vercel-domain>`. The container honours `$PORT`, runs migrations on start, and `DATABASE_URL` is normalised from `postgres://`.

**Frontend - Vercel.** Import the repo with root `frontend/`, build `npm run build`, output `dist`, and set `VITE_API_URL=https://<your-render-service>.onrender.com`. [`vercel.json`](frontend/vercel.json) provides the SPA fallback. Nothing is hard-coded to localhost.

Production checklist: strong `JWT_SECRET`, exact `CORS_ORIGINS`, HTTPS only, provider plan matching `MARKET_DATA_CREDITS_PER_MINUTE`.

## Security

bcrypt (cost 12) password hashing with timing equalisation for unknown emails · JWT with required `exp`/`sub`/`typ` claims · login/register rate limiting · Pydantic validation on every input · ticker whitelist regex · ORM-only SQL · explicit CORS allow-list (no wildcard) · security headers · secrets only from the environment, `.env` git-ignored, production refuses to start without a strong `JWT_SECRET`.
*Known trade-off:* the access token is kept in `localStorage` (simple, works cross-origin on Vercel + Render) which is exposed to XSS; an httpOnly-cookie session is on the roadmap.

## Future improvements

- Redis for shared cache / rate limits across instances; background retraining job
- httpOnly cookie sessions + refresh tokens, email verification
- Pooled cross-sectional model and calibration curves; richer backtests with costs
- Intraday indicators and WebSocket streaming where the provider plan allows
- Price alerts, portfolio tracking, dark theme

## Disclaimer

**RedOak Markets provides educational and analytical information only.** Technical indicators and signals are not guarantees of future performance and should not be considered financial advice. Machine-learning outputs are experimental analytical signals based on historical patterns. Demo-mode prices are synthetic. Charts by [TradingView Lightweight Charts™](https://www.tradingview.com/) (Apache-2.0).

## Built & Created By

**Divyanshi**

> Designed, engineered, and created with curiosity, code, and a love for turning complex market data into understandable insights.
