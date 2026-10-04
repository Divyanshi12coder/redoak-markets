import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkline } from '../../charts/Sparkline'
import { useHistory } from '../../hooks/queries'
import type { Range } from '../../types/api'
import { fmtPct, fmtPrice, tone } from '../../utils/format'
import { Carousel, CarouselItem } from '../ui/Carousel'
import { Skeleton } from '../ui/Skeleton'

/** Wait until the card scrolls near the viewport before spending an API call on it. */
function useNearViewport<T extends Element>() {
  const ref = useRef<T>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || near) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [near])
  return [ref, near] as const
}

function PerformanceCard({ ticker, name, range }: { ticker: string; name: string; range: Range }) {
  const [ref, near] = useNearViewport<HTMLAnchorElement>()
  const { data, isPending, isError } = useHistory(ticker, range, near)
  const enabled = near

  const closes = data?.candles.map((c) => c.c).filter((c): c is number => c != null) ?? []
  const ret = closes.length > 1 ? (closes[closes.length - 1] / closes[0] - 1) * 100 : null
  const t = tone(ret)

  return (
    <Link ref={ref} to={`/analyze/${ticker}`} className={clsx('card card-hover block p-5', t === 'down' ? 'card-down' : 'card-up')}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold">{name}</p>
          <p className="text-xs text-muted">{ticker} · {range} performance</p>
        </div>
      </div>
      {!enabled || isPending ? (
        <div role="status" aria-label="Loading performance"><Skeleton className="mt-4 h-16 w-full" /></div>
      ) : isError || closes.length < 2 ? (
        <p className="mt-6 text-sm text-muted">Performance unavailable right now.</p>
      ) : (
        <>
          <p className={clsx('tabular mt-3 font-display text-3xl font-semibold', t === 'up' ? 'text-up' : 'text-down')}>
            <span aria-hidden="true" className="text-lg">{t === 'up' ? '▲' : '▼'}</span> {fmtPct(ret)}
          </p>
          <Sparkline values={closes} width={240} height={56} className="mt-2 h-14 w-full" />
          <p className="tabular mt-1 text-xs text-muted">Latest {fmtPrice(closes[closes.length - 1])}</p>
        </>
      )}
    </Link>
  )
}

export function PerformanceCarousel({ items, range = '1Y' }: { items: { ticker: string; name: string }[]; range?: Range }) {
  if (items.length === 0) return null
  return (
    <Carousel label="historical performance cards">
      {items.map((i) => (
        <CarouselItem key={i.ticker}>
          <PerformanceCard {...i} range={range} />
        </CarouselItem>
      ))}
    </Carousel>
  )
}
