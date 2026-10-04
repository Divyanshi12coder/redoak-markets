import clsx from 'clsx'
import { lazy, Suspense, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { StockSearch } from '../components/market/StockSearch'
import { ChangeBadge, DataSourceBadge } from '../components/ui/Badges'
import { Disclaimer } from '../components/ui/Disclaimer'
import { Icon } from '../components/ui/Icon'
import { LoadingRegion, Skeleton } from '../components/ui/Skeleton'
import { EmptyState, ErrorState } from '../components/ui/States'
import { useCompare } from '../hooks/queries'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { COMPARE_RANGES, type CompareResponse, type CompareRow, type Range } from '../types/api'
import { COMPARE_COLORS } from '../charts/theme'
import { fmtCompact, fmtNumber, fmtPct, fmtPrice } from '../utils/format'
import { normaliseTicker } from '../utils/ticker'

const CompareChart = lazy(() => import('../charts/CompareChart').then((m) => ({ default: m.CompareChart })))

const DEFAULT = ['AAPL', 'MSFT', 'NVDA']
const MAX = 4

const ROWS: { label: string; render: (r: CompareRow) => React.ReactNode; best?: (r: CompareRow) => number | null }[] = [
  { label: 'Price', render: (r) => fmtPrice(r.price) },
  { label: 'Daily change', render: (r) => <ChangeBadge value={r.change_percent} size="sm" /> },
  { label: 'Period return', render: (r) => <ChangeBadge value={r.range_return_percent} size="sm" />, best: (r) => r.range_return_percent },
  { label: 'Volatility (ann.)', render: (r) => (r.volatility == null ? '--' : `${fmtNumber(r.volatility * 100, 1)}%`) },
  { label: 'Max drawdown', render: (r) => fmtPct(r.max_drawdown_percent) },
  { label: 'Volume', render: (r) => fmtCompact(r.volume) },
  { label: 'Avg volume', render: (r) => fmtCompact(r.average_volume) },
  { label: 'RSI (14)', render: (r) => fmtNumber(r.rsi14, 1) },
  { label: 'SMA 20', render: (r) => fmtPrice(r.sma20) },
  { label: 'SMA 50', render: (r) => fmtPrice(r.sma50) },
  { label: 'SMA 200', render: (r) => fmtPrice(r.sma200) },
  { label: 'EMA 20', render: (r) => fmtPrice(r.ema20) },
  { label: 'EMA 50', render: (r) => fmtPrice(r.ema50) },
  { label: 'Technical signal', render: (r) => r.signal },
]

function parseTickers(raw: string | null): string[] {
  if (raw === null) return DEFAULT
  const list = raw.split(',').map((t) => normaliseTicker(t)).filter((t): t is string => !!t)
  return [...new Set(list)].slice(0, MAX)
}

export default function ComparePage() {
  useDocumentTitle('Compare')
  const [params, setParams] = useSearchParams()
  const tickers = useMemo(() => parseTickers(params.get('t')), [params])
  const range = (COMPARE_RANGES.includes(params.get('range') as Range) ? params.get('range') : '1Y') as Range
  const { data, isPending, isError, error, refetch, isPlaceholderData, fetchStatus } = useCompare(tickers, range)

  const update = (next: string[], r: Range = range) => setParams({ t: next.join(','), range: r }, { replace: true })
  const add = (t: string) => tickers.length < MAX && !tickers.includes(t) && update([...tickers, t])
  const remove = (t: string) => update(tickers.filter((x) => x !== t))

  return (
    <div className="container-page space-y-8 py-10">
      <header>
        <p className="eyebrow">Compare</p>
        <h1 className="font-display text-4xl font-semibold text-oak-900 sm:text-5xl">Compare stocks side by side</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Select two to four stocks. Performance is rebased to 100 at the first shared date so different price levels are comparable.
        </p>
      </header>

      <section className="card p-4 sm:p-5" aria-label="Choose stocks">
        <div className="flex flex-wrap items-center gap-2">
          {tickers.map((t, i) => (
            <span key={t} className="inline-flex items-center gap-2 rounded-full border border-stone bg-white py-1 pl-3 pr-1 text-sm font-semibold shadow-card">
              <span className="size-2.5 rounded-full" style={{ background: COMPARE_COLORS[i] }} aria-hidden="true" />
              {t}
              <button type="button" onClick={() => remove(t)} className="grid size-7 place-items-center rounded-full text-muted hover:bg-wine-50 hover:text-wine-700" aria-label={`Remove ${t}`}>
                <Icon name="close" size={14} />
              </button>
            </span>
          ))}
          {tickers.length === 0 && <span className="text-sm text-muted">No stocks selected.</span>}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
          {tickers.length < MAX ? (
            <StockSearch variant="page" onSelect={add} placeholder="Add a stock to compare…" />
          ) : (
            <p className="rounded-xl bg-mist px-4 py-3 text-sm text-muted">Maximum of {MAX} stocks selected. Remove one to add another.</p>
          )}
          <div role="radiogroup" aria-label="Time range" className="inline-flex rounded-xl bg-mist p-1">
            {COMPARE_RANGES.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={range === r}
                onClick={() => update(tickers, r)}
                className={clsx('min-h-10 rounded-lg px-3.5 text-xs font-semibold transition', range === r ? 'bg-white text-oak-800 shadow-card' : 'text-muted hover:text-ink')}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </section>

      {tickers.length < 2 ? (
        <EmptyState
          icon="chart"
          title="Pick at least two stocks"
          description="Add another ticker above to see rebased performance, indicators and a side-by-side table."
          action={
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => update(DEFAULT)}>
                Compare AAPL, MSFT &amp; NVDA
              </button>
            </div>
          }
        />
      ) : isPending && fetchStatus !== 'idle' ? (
        <LoadingRegion label="Loading comparison" className="space-y-4">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-64 w-full" />
        </LoadingRegion>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data ? (
        <Result data={data} dimmed={isPlaceholderData} />
      ) : null}

      <Disclaimer />
    </div>
  )
}

function Result({ data, dimmed }: { data: CompareResponse; dimmed: boolean }) {
  const bestReturn = Math.max(...data.table.map((r) => r.range_return_percent))
  return (
    <div className={clsx('space-y-8 transition-opacity', dimmed && 'opacity-60')} aria-busy={dimmed}>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Summary cards">
        {data.table.map((r, i) => (
          <Link
            key={r.ticker}
            to={`/analyze/${r.ticker}`}
            className={clsx('card card-hover block p-5', r.range_return_percent >= 0 ? 'card-up' : 'card-down')}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-bold">
                <span className="size-2.5 rounded-full" style={{ background: COMPARE_COLORS[i] }} aria-hidden="true" />
                {r.ticker}
              </span>
              {r.range_return_percent === bestReturn && <span className="chip bg-oak-100 text-oak-800">BEST {data.range}</span>}
            </div>
            <p className="mt-0.5 truncate text-xs text-muted">{r.name}</p>
            <p className="tabular mt-3 font-display text-2xl font-semibold">{fmtPrice(r.price)}</p>
            <p className="mt-1 flex items-center gap-3 text-xs">
              <ChangeBadge value={r.change_percent} size="sm" /> <span className="text-muted">today</span>
            </p>
            <p className="mt-2 flex items-center gap-3 text-xs">
              <ChangeBadge value={r.range_return_percent} size="sm" /> <span className="text-muted">{data.range}</span>
            </p>
            <p className="mt-3 text-xs font-medium text-ink">{r.signal}</p>
          </Link>
        ))}
      </section>

      <section className="card p-4 sm:p-6" aria-label="Relative performance chart">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl font-semibold text-oak-900">Relative performance ({data.range})</h2>
          <DataSourceBadge meta={data.meta} />
        </div>
        <Suspense fallback={<Skeleton className="h-[380px] w-full" />}>
          <CompareChart data={data} />
        </Suspense>
      </section>

      <section className="card overflow-hidden" aria-label="Comparison table">
        <div className="scrollbar-thin overflow-x-auto">
          <table className="tabular w-full min-w-[34rem] text-sm">
            <caption className="sr-only">Side-by-side comparison of price, performance, volume and technical indicators</caption>
            <thead className="bg-oak-950 text-white">
              <tr>
                <th scope="col" className="sticky left-0 z-10 bg-oak-950 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-oak-200">Metric</th>
                {data.table.map((r, i) => (
                  <th key={r.ticker} scope="col" className="px-4 py-3 text-right">
                    <Link to={`/analyze/${r.ticker}`} className="inline-flex items-center gap-2 font-semibold hover:underline">
                      <span className="size-2 rounded-full" style={{ background: COMPARE_COLORS[i] }} aria-hidden="true" />
                      {r.ticker}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label} className="border-t border-stone/70 odd:bg-paper/50">
                  <th scope="row" className="sticky left-0 z-10 bg-inherit px-4 py-2.5 text-left font-medium text-muted odd:bg-paper">{row.label}</th>
                  {data.table.map((r) => (
                    <td key={r.ticker} className={clsx('px-4 py-2.5 text-right', row.best && row.best(r) === Math.max(...data.table.map((x) => row.best!(x) ?? -Infinity)) && 'font-bold')}>
                      {row.render(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
