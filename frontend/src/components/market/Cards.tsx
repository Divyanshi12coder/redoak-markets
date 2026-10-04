import clsx from 'clsx'
import { Link } from 'react-router-dom'
import { useCountUp } from '../../hooks/useCountUp'
import type { OverviewResponse, Quote } from '../../types/api'
import { fmtCompact, fmtNumber, fmtPrice, fmtSigned, tone } from '../../utils/format'
import { ChangeBadge, Chip } from '../ui/Badges'

export function IndexCard({ q, label }: { q: Quote; label: string }) {
  const t = tone(q.change_percent)
  return (
    <Link
      to={`/analyze/${q.ticker}`}
      className={clsx('card card-hover block p-5', t === 'down' ? 'card-down' : 'card-up')}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-xs text-muted">{q.ticker} · ETF proxy</p>
        </div>
        <span
          aria-hidden="true"
          className={clsx('size-2.5 rounded-full', t === 'up' ? 'bg-oak-500' : t === 'down' ? 'bg-wine-500' : 'bg-stone')}
        />
      </div>
      <p className="tabular mt-4 font-display text-3xl font-semibold">{fmtPrice(q.price)}</p>
      <p className="mt-1 flex items-center gap-2">
        <ChangeBadge value={q.change_percent} />
        <span className="tabular text-xs text-muted">{fmtSigned(q.change)}</span>
      </p>
      <p className="tabular mt-3 text-xs text-muted">Vol {fmtCompact(q.volume)}</p>
    </Link>
  )
}

export function MoverList({
  title,
  items,
  empty,
}: {
  title: string
  items: Quote[]
  empty: string
}) {
  return (
    <section className="card p-5" aria-label={title}>
      <h3 className="font-display text-lg font-semibold text-oak-900">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{empty}</p>
      ) : (
        <ol className="mt-3 divide-y divide-stone/70">
          {items.map((q, i) => (
            <li key={q.ticker}>
              <Link
                to={`/analyze/${q.ticker}`}
                className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-oak-50"
              >
                <span className="w-4 text-xs text-muted">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <b className="block text-sm">{q.ticker}</b>
                  <span className="block truncate text-xs text-muted">{q.name}</span>
                </span>
                <span className="text-right">
                  <span className="tabular block text-sm font-semibold">{fmtPrice(q.price)}</span>
                  {title === 'Most active' ? (
                    <span className="tabular block text-xs text-muted">Vol {fmtCompact(q.volume)}</span>
                  ) : (
                    <ChangeBadge value={q.change_percent} size="sm" />
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

export function MarketStatusCard({ data }: { data: OverviewResponse }) {
  const volume = useCountUp(data.total_volume)
  const total = data.advancers + data.decliners || 1
  return (
    <section className="card p-5" aria-label="Market status">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-oak-900">Market status</h3>
        <Chip tone={data.market_open ? 'bull' : 'neutral'}>
          <span className={clsx('size-1.5 rounded-full', data.market_open ? 'bg-oak-500' : 'bg-muted')} aria-hidden="true" />
          {data.market_open ? 'OPEN' : 'CLOSED'}
        </Chip>
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted">Tracked-universe volume</p>
      <p className="tabular font-display text-3xl font-semibold">{volume == null ? '--' : fmtCompact(volume)}</p>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted">Advancers vs decliners</p>
      <div
        className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-mist"
        role="img"
        aria-label={`${data.advancers} advancing, ${data.decliners} declining`}
      >
        <span className="bg-oak-600 transition-[width] duration-700" style={{ width: `${(data.advancers / total) * 100}%` }} />
        <span className="bg-wine-500 transition-[width] duration-700" style={{ width: `${(data.decliners / total) * 100}%` }} />
      </div>
      <p className="tabular mt-1.5 flex justify-between text-xs text-muted">
        <span>▲ {data.advancers} up</span>
        <span>{data.decliners} down ▼</span>
      </p>
      <p className="mt-4 text-xs text-muted">
        Based on {fmtNumber(data.universe_size, 0)} tracked large-cap symbols - not the whole market.
      </p>
    </section>
  )
}
