import type { QuoteResponse } from '../../types/api'
import { fmtDateTime, fmtPrice, fmtSigned, tone } from '../../utils/format'
import { ChangeBadge, Chip, DataSourceBadge } from '../ui/Badges'
import { WatchlistButton } from '../watchlist/WatchlistButton'

export function StockHeader({ quote }: { quote: QuoteResponse }) {
  const t = tone(quote.change)
  return (
    <header className="card flex flex-wrap items-start justify-between gap-x-8 gap-y-4 p-5 sm:p-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-oak-900">{quote.ticker}</h1>
          <Chip>{quote.exchange || 'N/A'}</Chip>
          <Chip tone={quote.is_market_open ? 'bull' : 'neutral'}>
            <span className={`size-1.5 rounded-full ${quote.is_market_open ? 'bg-oak-500' : 'bg-muted'}`} aria-hidden="true" />
            {quote.is_market_open ? 'MARKET OPEN' : 'MARKET CLOSED'}
          </Chip>
        </div>
        <p className="mt-1 text-muted">{quote.name}</p>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="tabular font-display text-4xl font-semibold text-ink">{fmtPrice(quote.price, quote.currency)}</span>
          <span className={`tabular text-lg font-semibold ${t === 'up' ? 'text-up' : t === 'down' ? 'text-down' : 'text-muted'}`}>
            {fmtSigned(quote.change)}
          </span>
          <ChangeBadge value={quote.change_percent} size="lg" />
        </div>
        <p className="mt-2 text-xs text-muted">
          Last updated {fmtDateTime(quote.as_of)}
          {quote.previous_close != null && <> · Previous close {fmtPrice(quote.previous_close, quote.currency)}</>}
        </p>
      </div>

      <div className="flex flex-col items-start gap-3 sm:items-end">
        <WatchlistButton ticker={quote.ticker} />
        <DataSourceBadge meta={quote.meta} />
        <dl className="tabular grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted">
          <dt>Day range</dt>
          <dd className="text-right font-medium text-ink">{fmtPrice(quote.low)} – {fmtPrice(quote.high)}</dd>
          <dt>52-wk range</dt>
          <dd className="text-right font-medium text-ink">{fmtPrice(quote.fifty_two_week_low)} – {fmtPrice(quote.fifty_two_week_high)}</dd>
        </dl>
      </div>
    </header>
  )
}
