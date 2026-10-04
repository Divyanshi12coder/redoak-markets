import clsx from 'clsx'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useWatchlist, useWatchlistMutations } from '../../hooks/queries'
import { Icon } from '../ui/Icon'

/** Add / remove a ticker. Signed-out users are sent to log in (the list is stored per account). */
export function WatchlistButton({ ticker, className }: { ticker: string; className?: string }) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  const { data } = useWatchlist(isAuthenticated)
  const { add, remove } = useWatchlistMutations()

  if (!isAuthenticated) {
    return (
      <Link to="/login" state={{ from: location.pathname }} className={clsx('btn btn-secondary btn-sm', className)}>
        <Icon name="star" size={15} /> Log in to watch
      </Link>
    )
  }

  const watching = data?.items.some((i) => i.ticker === ticker) ?? false
  const busy = add.isPending || remove.isPending
  const error = (add.error ?? remove.error) as Error | null

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        aria-pressed={watching}
        disabled={busy || !data}
        onClick={() => (watching ? remove.mutate(ticker) : add.mutate(ticker))}
        className={clsx('btn btn-sm', watching ? 'btn-primary' : 'btn-secondary', className)}
      >
        <Icon name={watching ? 'check' : 'star'} size={15} />
        {watching ? 'In watchlist' : 'Add to watchlist'}
      </button>
      {error && (
        <span role="alert" className="mt-1 text-xs text-wine-700">
          {error.message}
        </span>
      )}
    </span>
  )
}
