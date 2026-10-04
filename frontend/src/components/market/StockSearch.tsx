import clsx from 'clsx'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useSearch } from '../../hooks/queries'
import { fmtPrice } from '../../utils/format'
import { ChangeBadge } from '../ui/Badges'
import { Icon } from '../ui/Icon'
import { Skeleton } from '../ui/Skeleton'
import { ErrorState } from '../ui/States'

const TICKER_RE = /^[A-Za-z][A-Za-z0-9.-]{0,9}$/
export const POPULAR = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN']

interface Props {
  variant?: 'hero' | 'nav' | 'page'
  autoFocus?: boolean
  onNavigate?: () => void
  /** When given, picking a result calls this instead of opening the analyzer (used as a ticker picker). */
  onSelect?: (ticker: string) => void
  placeholder?: string
  className?: string
}

/** WAI-ARIA combobox: search by ticker or company name, pick with mouse or keyboard. */
export function StockSearch({ variant = 'page', autoFocus, onNavigate, onSelect, placeholder, className }: Props) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const debounced = useDebouncedValue(q.trim(), 300)
  const { data, isFetching, isError, error, refetch } = useSearch(debounced)

  const results = q.trim() ? (data?.results ?? []) : []
  const showSuggestions = open && q.trim() === ''
  const showResults = open && q.trim() !== ''

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  useEffect(() => {
    setActive(-1)
  }, [debounced])

  function go(ticker: string) {
    setOpen(false)
    setQ('')
    if (onSelect) return onSelect(ticker.toUpperCase())
    onNavigate?.()
    navigate(`/analyze/${ticker.toUpperCase()}`)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (active >= 0 && results[active]) go(results[active].ticker)
      else if (TICKER_RE.test(q.trim())) go(q.trim())
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const dark = variant === 'nav'
  const loading = isFetching && results.length === 0

  return (
    <div ref={wrapRef} className={clsx('relative', className)}>
      <label htmlFor={`${listId}-input`} className="sr-only">
        Search stocks by ticker or company name
      </label>
      <div
        className={clsx(
          'flex items-center gap-2 rounded-xl border transition focus-within:ring-2',
          variant === 'hero' && 'h-14 border-white/20 bg-white px-4 shadow-lift focus-within:ring-oak-300',
          variant === 'page' && 'h-12 border-stone bg-white px-3.5 shadow-card focus-within:ring-oak-500',
          dark && 'h-10 border-white/15 bg-white/10 px-3 focus-within:bg-white/15 focus-within:ring-oak-300',
        )}
      >
        <Icon name="search" size={18} className={dark ? 'text-oak-200' : 'text-muted'} />
        <input
          id={`${listId}-input`}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-opt-${active}` : undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          spellCheck={false}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder ?? 'Search ticker or company, e.g. NVDA'}
          maxLength={40}
          className={clsx(
            'min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/80',
            variant === 'hero' && 'text-base text-ink',
            dark && 'text-white placeholder:text-oak-200/80',
            !dark && 'text-ink',
          )}
        />
        {isFetching && q.trim() && <span className="size-4 animate-spin rounded-full border-2 border-oak-300 border-t-oak-700" aria-hidden="true" />}
      </div>

      {(showResults || showSuggestions) && (
        <div
          className={clsx(
            'absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-xl border border-stone bg-white text-ink shadow-lift',
            dark && 'min-w-[22rem] lg:left-auto lg:right-0 lg:w-[26rem]',
          )}
        >
          {showSuggestions && (
            <div className="p-3">
              <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-muted">Popular tickers</p>
              <div className="flex flex-wrap gap-2">
                {POPULAR.map((t) => (
                  <button key={t} type="button" onClick={() => go(t)} className="btn btn-secondary btn-sm">
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showResults && (
            <ul id={listId} role="listbox" aria-label="Search results" className="max-h-96 overflow-y-auto py-1">
              {loading &&
                [0, 1, 2].map((i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-4 py-3" aria-hidden="true">
                    <div className="space-y-2">
                      <Skeleton className="h-3.5 w-16" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </li>
                ))}
              {results.map((r, i) => (
                <li
                  key={`${r.ticker}-${r.exchange}`}
                  id={`${listId}-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => go(r.ticker)}
                  className={clsx(
                    'flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 transition-colors',
                    i === active ? 'bg-oak-50' : 'hover:bg-oak-50/60',
                  )}
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      {r.ticker}
                      <span className="rounded bg-mist px-1.5 py-0.5 text-[10px] font-medium text-muted">{r.exchange || 'N/A'}</span>
                    </p>
                    <p className="truncate text-xs text-muted">{r.name}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {r.price != null ? (
                      <>
                        <p className="tabular text-sm font-semibold">{fmtPrice(r.price, r.currency ?? 'USD')}</p>
                        <ChangeBadge value={r.change_percent} size="sm" />
                      </>
                    ) : (
                      <span className="text-xs text-muted">Price unavailable</span>
                    )}
                  </div>
                </li>
              ))}
              {!loading && !isError && results.length === 0 && debounced !== '' && (
                <li className="px-4 py-6 text-center text-sm text-muted" role="presentation">
                  No matches for “{debounced}”. Try a ticker like <strong>AAPL</strong> or part of a company name.
                </li>
              )}
              {isError && (
                <li role="presentation" className="p-3">
                  <ErrorState error={error} onRetry={() => refetch()} compact />
                </li>
              )}
            </ul>
          )}
          <p className="sr-only" role="status" aria-live="polite">
            {showResults && !loading ? `${results.length} results` : ''}
          </p>
        </div>
      )}
    </div>
  )
}
