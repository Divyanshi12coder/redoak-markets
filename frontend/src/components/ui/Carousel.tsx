import clsx from 'clsx'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'

/**
 * Scroll-snap carousel. Native overflow scrolling keeps touch swipe, trackpads and keyboard
 * (arrow buttons, focusable cards) working on every device without a heavy dependency.
 */
export function Carousel({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLUListElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    setAtStart(el.scrollLeft <= 4)
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    update()
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [update, children])

  function scrollBy(dir: 1 | -1) {
    const el = ref.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <div className={clsx('relative', className)} role="region" aria-roledescription="carousel" aria-label={label}>
      <div className="mb-3 flex justify-end gap-2">
        <button type="button" className="btn btn-secondary btn-sm !px-2.5" onClick={() => scrollBy(-1)} disabled={atStart} aria-label={`Previous ${label}`}>
          <Icon name="chevron" size={16} className="rotate-180" />
        </button>
        <button type="button" className="btn btn-secondary btn-sm !px-2.5" onClick={() => scrollBy(1)} disabled={atEnd} aria-label={`Next ${label}`}>
          <Icon name="chevron" size={16} />
        </button>
      </div>
      <ul
        ref={ref}
        onScroll={update}
        className="scrollbar-thin -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-3"
      >
        {children}
      </ul>
    </div>
  )
}

export function CarouselItem({ children, className }: { children: ReactNode; className?: string }) {
  return <li className={clsx('w-[17rem] shrink-0 snap-start sm:w-[19rem]', className)}>{children}</li>
}
