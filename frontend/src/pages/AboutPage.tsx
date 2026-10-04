import { Disclaimer } from '../components/ui/Disclaimer'
import { GithubIcon } from '../components/ui/Icon'
import { Reveal } from '../components/ui/Reveal'
import { GITHUB_URL } from '../components/layout/Nav'
import { useHealth } from '../hooks/queries'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const INDICATORS = [
  ['SMA 20 / 50 / 200', 'Simple moving averages: the mean closing price over 20, 50 and 200 sessions. Smooth the trend, lag the price.'],
  ['EMA 20 / 50', 'Exponential moving averages weight recent prices more heavily (α = 2 / (n + 1)), so they react faster than SMAs.'],
  ['RSI 14', 'Wilder’s Relative Strength Index. Compares average gains and losses over 14 sessions on a 0-100 scale; 70 / 30 are the conventional overbought / oversold lines.'],
  ['MACD', 'EMA 12 minus EMA 26, a 9-period signal line, and their difference (histogram) - a momentum read.'],
  ['Bollinger Bands', '20-day SMA ± 2 standard deviations. %B shows where price sits inside the bands; width gauges volatility.'],
  ['ATR 14', 'Average True Range (Wilder): typical daily trading range including overnight gaps.'],
]

export default function AboutPage() {
  useDocumentTitle('About')
  const { data: health } = useHealth()
  return (
    <div className="container-page py-12">
      <Reveal className="max-w-3xl">
        <p className="eyebrow">About</p>
        <h1 className="font-display text-4xl font-semibold text-oak-900 sm:text-5xl">See the market. Understand the trend.</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          RedOak Markets is an educational market-analysis workspace. It combines market data, transparent technical rules, an experimental
          machine-learning classifier and a plain-English analyst called Dia - and is deliberately candid about what none of it can promise.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-12">
          <Reveal>
            <section aria-labelledby="ind-h">
              <h2 id="ind-h" className="font-display text-2xl font-semibold text-oak-900">Technical indicators</h2>
              <p className="mt-2 text-muted">All indicators are calculated server-side with pandas - nothing is hard-coded or pre-baked.</p>
              <dl className="mt-5 divide-y divide-stone/70 rounded-2xl border border-stone bg-white">
                {INDICATORS.map(([k, v]) => (
                  <div key={k} className="grid gap-1 px-5 py-4 sm:grid-cols-[12rem_1fr] sm:gap-6">
                    <dt className="font-semibold">{k}</dt>
                    <dd className="text-sm leading-relaxed text-muted">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </Reveal>

          <Reveal>
            <section aria-labelledby="ml-h">
              <h2 id="ml-h" className="font-display text-2xl font-semibold text-oak-900">AI &amp; machine learning, honestly</h2>
              <div className="mt-3 space-y-3 leading-relaxed text-muted">
                <p>
                  For each stock, a random-forest classifier is trained on 22 causal features (returns, volatility, moving-average relationships, RSI, MACD,
                  Bollinger metrics, volume and range). The target is whether the next 10 sessions’ return was meaningfully above, below or within a
                  volatility-adjusted band - bullish, bearish or neutral.
                </p>
                <p>
                  <b className="text-ink">Time-aware by design.</b> Financial data is never shuffled. Models are validated with expanding-window
                  walk-forward splits and a 10-session embargo, and scored against a naive “always predict the usual class” baseline. When a model does not
                  beat that baseline, the app says so.
                </p>
                <p>
                  <b className="text-ink">What it is not.</b> The class probability is the model’s confidence in its own label, not the chance a price will
                  rise. Historical back-tests cannot account for regime shifts, news, costs or liquidity, and single-stock histories are small samples.
                </p>
                <p>
                  <b className="text-ink">Dia</b> only paraphrases calculated values. If an optional LLM is configured it receives the same structured
                  numbers, and its reply is rejected if it introduces figures that are not in that data or sounds like a prediction.
                </p>
              </div>
            </section>
          </Reveal>

          <Reveal>
            <section aria-labelledby="data-h">
              <h2 id="data-h" className="font-display text-2xl font-semibold text-oak-900">Where the data comes from</h2>
              <p className="mt-3 leading-relaxed text-muted">
                {health?.market_data.synthetic ? (
                  <>
                    This environment is running with <b className="text-ink">synthetic demo data</b>. Prices are generated by a seeded random walk so the
                    app can be explored without an API key; they are not real market data.
                  </>
                ) : (
                  <>
                    Quotes and price history come from <b className="text-ink">Twelve Data</b> through the RedOak API. Depending on the provider plan the data
                    can be delayed, so RedOak never describes it as real time. Index values are shown through ETF proxies (SPY, QQQ, DIA, IWM), and
                    top gainers/losers/active are computed over a configured universe of large-cap symbols - not the whole market.
                  </>
                )}
              </p>
            </section>
          </Reveal>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <h2 className="font-display text-lg font-semibold">Open source</h2>
            <p className="mt-1 text-sm text-muted">Read the code, the tests and the methodology on GitHub.</p>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-4 w-full">
              <GithubIcon /> View repository
            </a>
          </div>
          <div className="card p-5">
            <h2 className="font-display text-lg font-semibold">Stack</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              React · TypeScript · Vite · Tailwind CSS · Framer Motion · TradingView Lightweight Charts · FastAPI · pandas · NumPy · scikit-learn ·
              PostgreSQL · SQLAlchemy · Alembic · Docker.
            </p>
          </div>
          <Disclaimer ml />
        </aside>
      </div>
    </div>
  )
}
