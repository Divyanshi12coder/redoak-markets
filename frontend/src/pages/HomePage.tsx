import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { HeroVisual } from '../components/brand/HeroVisual'
import { MarketTicker } from '../components/market/MarketTicker'
import { POPULAR, StockSearch } from '../components/market/StockSearch'
import { Disclaimer } from '../components/ui/Disclaimer'
import { Icon, type IconName } from '../components/ui/Icon'
import { Reveal } from '../components/ui/Reveal'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'chart',
    title: 'Interactive charts',
    body: 'Candles, line and area charts across seven ranges, with zoom, crosshair tooltips and toggleable SMA, EMA, Bollinger, RSI and MACD layers.',
  },
  {
    icon: 'layers',
    title: 'Transparent signals',
    body: 'Every bullish, bearish or neutral reading comes from a published rule - price vs moving averages, crossovers, RSI thresholds - and you can see which rules fired.',
  },
  {
    icon: 'brain',
    title: 'Dia, your analyst',
    body: 'A walk-forward-validated classifier, anomaly detection and feature importance, explained in plain English. Dia describes what the data shows and never predicts prices.',
  },
  {
    icon: 'star',
    title: 'Watchlist & compare',
    body: 'Save stocks to your account, reorder them, and compare up to four on rebased performance, RSI, moving averages and volume.',
  },
]

const STEPS = [
  { n: '01', title: 'Fetch', body: 'The FastAPI backend pulls market data from the provider, caches it and handles rate limits.' },
  { n: '02', title: 'Calculate', body: 'Pandas computes indicators and a leak-free feature set from price and volume history.' },
  { n: '03', title: 'Classify', body: 'A random forest, validated walk-forward against a naive baseline, labels the current regime.' },
  { n: '04', title: 'Explain', body: 'Dia turns the calculated numbers into a grounded, plain-English summary.' },
]

export default function HomePage() {
  useDocumentTitle()
  const reduce = useReducedMotion()
  const rise = (delay: number) =>
    reduce ? {} : { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const } }

  return (
    <>
      {/* ---------------------------------------------------------------- hero */}
      <section className="on-dark relative isolate overflow-hidden bg-oak-950 text-white">
        <div
          className="absolute inset-0 -z-10 opacity-70"
          aria-hidden="true"
          style={{
            backgroundImage:
              'radial-gradient(900px 500px at 85% 10%, rgba(29,93,63,0.45), transparent 60%), radial-gradient(700px 500px at 0% 100%, rgba(95,22,35,0.5), transparent 60%)',
          }}
        />
        <div
          className="absolute inset-0 -z-10 opacity-[0.07]"
          aria-hidden="true"
          style={{
            backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
            backgroundSize: '44px 44px',
            maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          }}
        />
        <div className="container-page grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div>
            <motion.p {...rise(0)} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold tracking-wide text-oak-200">
              <span className="size-1.5 rounded-full bg-wine-300" aria-hidden="true" /> Market data · Indicators · Explainable ML
            </motion.p>
            <motion.h1 {...rise(0.08)} className="mt-5 font-display text-[2.6rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Understand the market <span className="text-oak-300">before</span> you chase it.
            </motion.h1>
            <motion.p {...rise(0.16)} className="mt-5 max-w-xl text-lg leading-relaxed text-oak-100/90">
              RedOak Markets brings market data, technical indicators, interactive charts and model-backed analysis into one place - so you can see
              what the numbers say, and just as importantly, how sure they are.
            </motion.p>
            <motion.div {...rise(0.24)} className="mt-8 flex flex-wrap gap-3">
              <Link to="/markets" className="btn btn-crimson !min-h-12 !px-6 text-base">
                Explore Markets
              </Link>
              <Link to="/analyze" className="btn btn-on-dark !min-h-12 !px-6 text-base">
                Analyze a Stock <Icon name="chevron" size={16} />
              </Link>
            </motion.div>
            <motion.div {...rise(0.32)} className="mt-8 max-w-lg">
              <StockSearch variant="hero" />
              <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-oak-300">
                Try
                {POPULAR.map((t) => (
                  <Link key={t} to={`/analyze/${t}`} className="rounded-md bg-white/10 px-2 py-1 font-semibold text-white hover:bg-white/20">
                    {t}
                  </Link>
                ))}
              </p>
            </motion.div>
          </div>
          <motion.div {...rise(0.2)}>
            <HeroVisual />
          </motion.div>
        </div>
        <MarketTicker />
      </section>

      {/* ------------------------------------------------------------ features */}
      <section className="container-page py-20" aria-labelledby="features-heading">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Why RedOak Markets</p>
          <h2 id="features-heading" className="mt-2 font-display text-3xl font-semibold text-oak-900 sm:text-4xl">
            A market workspace built around honesty
          </h2>
          <p className="mt-3 text-muted">
            Most dashboards show numbers. RedOak shows where each number came from, how it was validated and what it cannot tell you.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.07}>
              <article className="card card-hover card-up h-full p-6">
                <span className="grid size-11 place-items-center rounded-xl bg-oak-900 text-oak-200">
                  <Icon name={f.icon} />
                </span>
                <h3 className="mt-5 font-display text-xl font-semibold text-oak-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------- how it works */}
      <section className="bg-oak-50/70 py-20" aria-labelledby="how-heading">
        <div className="container-page">
          <Reveal className="max-w-2xl">
            <p className="eyebrow">How it works</p>
            <h2 id="how-heading" className="mt-2 font-display text-3xl font-semibold text-oak-900 sm:text-4xl">
              From raw prices to a readable analysis
            </h2>
          </Reveal>
          <ol className="mt-10 grid gap-5 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.08}>
                <li className="relative h-full rounded-2xl border border-oak-200 bg-white p-6">
                  <span className="font-display text-4xl font-semibold text-wine-600/80">{s.n}</span>
                  <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.body}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ----------------------------------------------------------------- Dia */}
      <section className="container-page py-20" aria-labelledby="dia-teaser">
        <Reveal>
          <div className="on-dark overflow-hidden rounded-3xl bg-oak-950 p-8 text-white sm:p-12">
            <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-wine-300">Meet Dia</p>
                <h2 id="dia-teaser" className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
                  An analyst that shows its working - and its doubts
                </h2>
                <p className="mt-4 leading-relaxed text-oak-100/90">
                  Dia reads the calculated indicators, the regime classifier and the anomaly detector, then explains them in plain English. If the model
                  fails to beat a naive baseline on a stock, Dia says so. No fabricated confidence scores, no promises about the future.
                </p>
                <Link to="/analyze/AAPL" className="btn btn-crimson mt-6">See Dia’s analysis</Link>
              </div>
              <blockquote className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm leading-relaxed text-oak-100">
                <p className="font-display text-lg text-white">“Price is above its 50-day average, RSI sits inside its neutral range and volume is above its 20-day average.”</p>
                <p className="mt-3 text-oak-300">
                  …and then: “the classifier did not beat a naive baseline here, so treat its label with low weight.” - the kind of sentence Dia is built to write.
                </p>
                <footer className="mt-3 text-xs text-oak-300">Example of tone. Real analyses are generated from calculated data.</footer>
              </blockquote>
            </div>
          </div>
        </Reveal>
        <Disclaimer className="mx-auto mt-8 max-w-3xl justify-center text-center" />
      </section>
    </>
  )
}
