import { IndexCard, MarketStatusCard, MoverList } from '../components/market/Cards'
import { InsightsCarousel } from '../components/market/InsightsCarousel'
import { PerformanceCarousel } from '../components/market/PerformanceCarousel'
import { DataSourceBadge } from '../components/ui/Badges'
import { Disclaimer } from '../components/ui/Disclaimer'
import { Reveal } from '../components/ui/Reveal'
import { CardSkeleton, LoadingRegion } from '../components/ui/Skeleton'
import { ErrorState } from '../components/ui/States'
import { useOverview } from '../hooks/queries'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { fmtDateTime } from '../utils/format'

function SectionTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="font-display text-2xl font-semibold text-oak-900 sm:text-3xl">{title}</h2>
      </div>
      {children}
    </div>
  )
}

export default function MarketsPage() {
  useDocumentTitle('Markets')
  const { data, isPending, isError, error, refetch } = useOverview()

  return (
    <div className="container-page space-y-12 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Market overview</p>
          <h1 className="font-display text-4xl font-semibold text-oak-900 sm:text-5xl">Markets</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Index proxies, daily movers and activity across a tracked universe of large-cap U.S. symbols. Index values are shown through
            their most-traded ETFs (SPY, QQQ, DIA, IWM), because ETF quotes are what the data provider supplies.
          </p>
        </div>
        <div className="text-right">
          <DataSourceBadge meta={data?.meta} />
          {data && <p className="mt-1 text-xs text-muted">Updated {fmtDateTime(data.generated_at)}</p>}
        </div>
      </header>

      {isPending ? (
        <LoadingRegion label="Loading market overview" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <CardSkeleton key={i} />)}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {[0, 1, 2].map((i) => <CardSkeleton key={i} lines={6} />)}
          </div>
        </LoadingRegion>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <>
          <Reveal>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {data.indices.map((q) => <IndexCard key={q.ticker} q={q} label={q.name} />)}
            </div>
          </Reveal>

          <Reveal>
            <div className="grid gap-4 lg:grid-cols-4">
              <MarketStatusCard data={data} />
              <MoverList title="Top gainers" items={data.gainers} empty="No gainers in the tracked universe today." />
              <MoverList title="Top losers" items={data.losers} empty="No losers in the tracked universe today." />
              <MoverList title="Most active" items={data.most_active} empty="Volume data is unavailable." />
            </div>
          </Reveal>

          <section aria-label="Historical performance">
            <Reveal>
              <SectionTitle eyebrow="History" title="One-year performance" />
              <PerformanceCarousel items={data.indices.map((q) => ({ ticker: q.ticker, name: q.name }))} range="1Y" />
            </Reveal>
          </section>
        </>
      )}

      <section aria-label="Market insights">
        <Reveal>
          <SectionTitle eyebrow="Learn" title="How to read the signals" />
          <InsightsCarousel />
        </Reveal>
      </section>

      <Disclaimer />
    </div>
  )
}
