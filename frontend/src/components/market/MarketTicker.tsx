import clsx from 'clsx'
import { Link } from 'react-router-dom'
import { useOverview } from '../../hooks/queries'
import type { Quote } from '../../types/api'
import { arrow, fmtPct, fmtPrice, tone } from '../../utils/format'

function Item({ q, tabbable }: { q: Quote; tabbable: boolean }) {
  const t = tone(q.change_percent)
  return (
    <li>
      <Link
        to={`/analyze/${q.ticker}`}
        tabIndex={tabbable ? 0 : -1}
        className="tabular flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm hover:bg-white/10"
      >
        <b className="text-white">{q.ticker}</b>
        <span className="text-oak-200">{fmtPrice(q.price)}</span>
        <span className={clsx('font-semibold', t === 'up' ? 'text-up-dark' : t === 'down' ? 'text-down-dark' : 'text-oak-200')}>
          <span aria-hidden="true">{arrow(t)}</span> {fmtPct(q.change_percent)}
          <span className="sr-only">{t === 'up' ? ' up' : t === 'down' ? ' down' : ' unchanged'}</span>
        </span>
      </Link>
    </li>
  )
}

/** Continuously scrolling market-movers strip, driven by real overview data. Pauses on hover/focus. */
export function MarketTicker() {
  const { data, isPending, isError } = useOverview()

  if (isError) return null // the hero must not break because market data is unavailable
  if (isPending) {
    return (
      <div className="h-11 border-y border-white/10 bg-oak-900/60" role="status" aria-label="Loading market movers">
        <div className="container-page flex h-full items-center gap-6" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => <span key={i} className="skeleton !bg-white/10 h-3 w-24" />)}
        </div>
      </div>
    )
  }
  const items = data.movers
  if (items.length === 0) return null

  return (
    <section aria-label="Market movers" className="group relative overflow-hidden border-y border-white/10 bg-oak-900/70">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-oak-950 to-transparent" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-oak-950 to-transparent" aria-hidden="true" />
      <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused] motion-reduce:animate-none">
        <ul className="flex shrink-0">
          {items.map((q) => <Item key={q.ticker} q={q} tabbable />)}
        </ul>
        <ul className="flex shrink-0" aria-hidden="true">
          {items.map((q) => <Item key={q.ticker} q={q} tabbable={false} />)}
        </ul>
      </div>
    </section>
  )
}
