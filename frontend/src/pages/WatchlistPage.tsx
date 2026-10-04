import clsx from 'clsx'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { StockSearch } from '../components/market/StockSearch'
import { ChangeBadge, DataSourceBadge } from '../components/ui/Badges'
import { Disclaimer } from '../components/ui/Disclaimer'
import { Icon } from '../components/ui/Icon'
import { LoadingRegion, Skeleton } from '../components/ui/Skeleton'
import { EmptyState, ErrorState } from '../components/ui/States'
import { useWatchlist, useWatchlistMutations } from '../hooks/queries'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import type { WatchlistItem } from '../types/api'
import { fmtCompact, fmtPrice } from '../utils/format'

export default function WatchlistPage() {
  useDocumentTitle('Watchlist')
  const { data, isPending, isError, error, refetch } = useWatchlist(true)
  const { add, remove, reorder } = useWatchlistMutations()
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')

  const items = data?.items ?? []

  function move(ticker: string, to: number) {
    const order = items.map((i) => i.ticker)
    const from = order.indexOf(ticker)
    if (from < 0 || to < 0 || to >= order.length || from === to) return
    order.splice(to, 0, order.splice(from, 1)[0])
    reorder.mutate(order)
    setAnnounce(`${ticker} moved to position ${to + 1} of ${order.length}`)
  }

  return (
    <div className="container-page space-y-8 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Your list</p>
          <h1 className="font-display text-4xl font-semibold text-oak-900 sm:text-5xl">Watchlist</h1>
          <p className="mt-2 max-w-xl text-muted">Saved to your account. Drag the handle, or use the arrows, to reorder.</p>
        </div>
        <DataSourceBadge meta={data?.meta} />
      </header>

      <section className="card p-4 sm:p-5" aria-label="Add a stock">
        <StockSearch
          variant="page"
          placeholder="Add a stock to your watchlist…"
          onSelect={(t) => add.mutate(t)}
        />
        {add.isError && (
          <p role="alert" className="mt-2 text-sm text-wine-700">{(add.error as Error).message}</p>
        )}
      </section>

      {isPending ? (
        <LoadingRegion label="Loading your watchlist" className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </LoadingRegion>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="star"
          title="No stocks in your watchlist yet."
          description="Search above to add your first stock, or open any stock in the analyzer and choose “Add to watchlist”."
          action={<Link to="/markets" className="btn btn-primary">Browse markets</Link>}
        />
      ) : (
        <>
          {data?.quotes_error && (
            <p role="status" className="rounded-xl border border-wine-200 bg-wine-50 px-4 py-3 text-sm text-wine-800">
              Prices are temporarily unavailable ({data.quotes_error}). Your list is intact.
            </p>
          )}
          <ul className="space-y-3" aria-label="Watchlist">
            {items.map((item, idx) => (
              <Row
                key={item.ticker}
                item={item}
                index={idx}
                count={items.length}
                dragging={dragging === item.ticker}
                isOver={over === item.ticker && dragging !== item.ticker}
                onDragStart={() => setDragging(item.ticker)}
                onDragOver={() => setOver(item.ticker)}
                onDrop={() => dragging && move(dragging, idx)}
                onDragEnd={() => { setDragging(null); setOver(null) }}
                onMove={(dir) => move(item.ticker, idx + dir)}
                onRemove={() => remove.mutate(item.ticker)}
              />
            ))}
          </ul>
          <p className="sr-only" role="status" aria-live="polite">{announce}</p>
        </>
      )}

      <Disclaimer />
    </div>
  )
}

function Row({
  item, index, count, dragging, isOver, onDragStart, onDragOver, onDrop, onDragEnd, onMove, onRemove,
}: {
  item: WatchlistItem
  index: number
  count: number
  dragging: boolean
  isOver: boolean
  onDragStart: () => void
  onDragOver: () => void
  onDrop: () => void
  onDragEnd: () => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}) {
  const q = item.quote
  return (
    <li
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart() }}
      onDragOver={(e) => { e.preventDefault(); onDragOver() }}
      onDrop={(e) => { e.preventDefault(); onDrop() }}
      onDragEnd={onDragEnd}
      className={clsx(
        'card card-hover flex flex-wrap items-center gap-x-4 gap-y-3 p-4 transition',
        q && q.change_percent < 0 ? 'card-down' : 'card-up',
        dragging && 'opacity-40',
        isOver && 'ring-2 ring-oak-500',
      )}
    >
      <span className="cursor-grab text-muted active:cursor-grabbing" aria-hidden="true" title="Drag to reorder">
        <Icon name="grip" />
      </span>

      <div className="min-w-0 flex-1 basis-40">
        <Link to={`/analyze/${item.ticker}`} className="text-lg font-bold hover:underline">{item.ticker}</Link>
        <p className="truncate text-xs text-muted">{q?.name ?? 'Price unavailable'}{q?.exchange ? ` · ${q.exchange}` : ''}</p>
      </div>

      <div className="tabular min-w-24 text-right">
        <p className="font-semibold">{q ? fmtPrice(q.price, q.currency) : '--'}</p>
        {q ? <ChangeBadge value={q.change_percent} size="sm" /> : <span className="text-xs text-muted">--</span>}
      </div>
      <p className="tabular hidden min-w-20 text-right text-xs text-muted sm:block">Vol {q ? fmtCompact(q.volume) : '--'}</p>

      <div className="ml-auto flex items-center gap-1">
        <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Move ${item.ticker} up`}>
          <Icon name="up" size={16} />
        </button>
        <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={() => onMove(1)} disabled={index === count - 1} aria-label={`Move ${item.ticker} down`}>
          <Icon name="down" size={16} />
        </button>
        <Link to={`/analyze/${item.ticker}`} className="btn btn-secondary btn-sm">Analyze</Link>
        <button type="button" className="btn btn-ghost btn-sm !px-2 text-wine-700 hover:!bg-wine-50" onClick={onRemove} aria-label={`Remove ${item.ticker} from watchlist`}>
          <Icon name="trash" size={16} />
        </button>
      </div>
    </li>
  )
}
