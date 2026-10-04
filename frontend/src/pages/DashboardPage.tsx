import { Link } from 'react-router-dom'
import { StockSearch } from '../components/market/StockSearch'
import { IndexCard } from '../components/market/Cards'
import { ChangeBadge, Chip, DataSourceBadge } from '../components/ui/Badges'
import { Disclaimer } from '../components/ui/Disclaimer'
import { Reveal } from '../components/ui/Reveal'
import { CardSkeleton, LoadingRegion, Skeleton } from '../components/ui/Skeleton'
import { EmptyState, ErrorState } from '../components/ui/States'
import { useAuth } from '../context/AuthContext'
import { useMlHistory, useOverview, useWatchlist } from '../hooks/queries'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { fmtDateTime, fmtNumber, fmtPrice } from '../utils/format'

export default function DashboardPage() {
  useDocumentTitle('Dashboard')
  const { user, recentTickers, preferences } = useAuth()
  const watchlist = useWatchlist(true)
  const overview = useOverview()
  const mlHistory = useMlHistory(true)

  const items = watchlist.data?.items ?? []
  const priced = items.filter((i) => i.quote)
  const best = [...priced].sort((a, b) => b.quote!.change_percent - a.quote!.change_percent)[0]
  const worst = [...priced].sort((a, b) => a.quote!.change_percent - b.quote!.change_percent)[0]

  return (
    <div className="container-page space-y-10 py-10">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">Your dashboard</p>
          <h1 className="font-display text-4xl font-semibold text-oak-900 sm:text-5xl">
            Welcome back{user ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <p className="mt-2 text-muted">
            Your watchlist, recent analyses and the market at a glance.
            {preferences && <> Default chart view: <b>{preferences.chart_type}</b>, <b>{preferences.default_range}</b>.</>}
          </p>
        </div>
        <StockSearch variant="page" className="w-full sm:w-96" />
      </header>

      <section aria-label="Market snapshot">
        {overview.isPending ? (
          <LoadingRegion label="Loading market snapshot" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <CardSkeleton key={i} />)}
          </LoadingRegion>
        ) : overview.isError ? (
          <ErrorState error={overview.error} onRetry={() => overview.refetch()} compact />
        ) : (
          <Reveal>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {overview.data.indices.map((q) => <IndexCard key={q.ticker} q={q} label={q.name} />)}
            </div>
          </Reveal>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 sm:p-6 lg:col-span-2" aria-labelledby="wl-heading">
          <div className="flex items-center justify-between gap-3">
            <h2 id="wl-heading" className="font-display text-xl font-semibold text-oak-900">Watchlist</h2>
            <Link to="/watchlist" className="text-sm font-semibold text-oak-700 hover:underline">Manage</Link>
          </div>
          {watchlist.isPending ? (
            <LoadingRegion label="Loading watchlist" className="mt-4 space-y-2">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </LoadingRegion>
          ) : watchlist.isError ? (
            <ErrorState error={watchlist.error} onRetry={() => watchlist.refetch()} compact className="mt-4" />
          ) : items.length === 0 ? (
            <EmptyState
              className="mt-4"
              icon="star"
              title="No stocks in your watchlist yet."
              description="Add stocks from the analyzer or the watchlist page."
              action={<Link to="/watchlist" className="btn btn-primary btn-sm">Add your first stock</Link>}
            />
          ) : (
            <>
              {best && worst && items.length > 1 && (
                <p className="mt-2 text-sm text-muted">
                  Today’s strongest: <Link className="font-semibold text-ink hover:underline" to={`/analyze/${best.ticker}`}>{best.ticker}</Link>{' '}
                  <ChangeBadge value={best.quote!.change_percent} size="sm" /> · weakest:{' '}
                  <Link className="font-semibold text-ink hover:underline" to={`/analyze/${worst.ticker}`}>{worst.ticker}</Link>{' '}
                  <ChangeBadge value={worst.quote!.change_percent} size="sm" />
                </p>
              )}
              <ul className="mt-3 divide-y divide-stone/70">
                {items.slice(0, 7).map((i) => (
                  <li key={i.ticker}>
                    <Link to={`/analyze/${i.ticker}`} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-oak-50">
                      <span className="min-w-0">
                        <b className="block text-sm">{i.ticker}</b>
                        <span className="block truncate text-xs text-muted">{i.quote?.name ?? 'Price unavailable'}</span>
                      </span>
                      <span className="tabular shrink-0 text-right">
                        <span className="block text-sm font-semibold">{i.quote ? fmtPrice(i.quote.price) : '--'}</span>
                        {i.quote && <ChangeBadge value={i.quote.change_percent} size="sm" />}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="mt-3"><DataSourceBadge meta={watchlist.data?.meta} /></div>
        </section>

        <section className="card p-5 sm:p-6" aria-labelledby="recent-heading">
          <h2 id="recent-heading" className="font-display text-xl font-semibold text-oak-900">Recently analyzed</h2>
          {recentTickers.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Stocks you open in the analyzer will appear here.</p>
          ) : (
            <ul className="mt-4 flex flex-wrap gap-2">
              {recentTickers.map((t) => (
                <li key={t}><Link to={`/analyze/${t}`} className="btn btn-secondary btn-sm">{t}</Link></li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card p-5 sm:p-6" aria-labelledby="ml-history-heading">
        <h2 id="ml-history-heading" className="font-display text-xl font-semibold text-oak-900">Your model analysis history</h2>
        <p className="mt-1 text-sm text-muted">Each time you open Dia’s analysis, the model version and its output are stored in the database. These are model outputs, not recommendations.</p>
        {mlHistory.isPending ? (
          <Skeleton className="mt-4 h-24 w-full" />
        ) : mlHistory.isError ? (
          <ErrorState error={mlHistory.error} onRetry={() => mlHistory.refetch()} compact className="mt-4" />
        ) : mlHistory.data.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No model analyses yet - open a stock in the analyzer to generate one.</p>
        ) : (
          <div className="scrollbar-thin mt-4 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <caption className="sr-only">Stored model analyses</caption>
              <thead className="text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-semibold">Stock</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Classification</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Class prob.</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Volatility</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Model</th>
                  <th scope="col" className="py-2 font-semibold">When</th>
                </tr>
              </thead>
              <tbody>
                {mlHistory.data.slice(0, 8).map((m) => (
                  <tr key={`${m.ticker}-${m.analyzed_at}`} className="border-t border-stone/70">
                    <td className="py-2.5 pr-4"><Link className="font-bold hover:underline" to={`/analyze/${m.ticker}`}>{m.ticker}</Link></td>
                    <td className="py-2.5 pr-4"><Chip tone={m.regime === 'bullish' ? 'bull' : m.regime === 'bearish' ? 'bear' : 'neutral'}>{m.regime.toUpperCase()}</Chip></td>
                    <td className="tabular py-2.5 pr-4">{fmtNumber(m.confidence, 2)}</td>
                    <td className="py-2.5 pr-4">{m.volatility_regime}</td>
                    <td className="tabular max-w-40 truncate py-2.5 pr-4 text-xs text-muted" title={m.model_version}>{m.model_version}</td>
                    <td className="py-2.5 text-xs text-muted">{fmtDateTime(m.analyzed_at)}{m.data_source === 'demo' ? ' · demo data' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Disclaimer />
    </div>
  )
}
