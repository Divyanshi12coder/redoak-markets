import clsx from 'clsx'
import type { ReactNode } from 'react'
import type { Badge as BadgeData, DataMeta } from '../../types/api'
import { arrow, fmtPct, tone as toneOf } from '../../utils/format'

const CHIP_TONES: Record<BadgeData['tone'], string> = {
  bull: 'bg-oak-100 text-oak-800 ring-1 ring-oak-200',
  bear: 'bg-wine-100 text-wine-800 ring-1 ring-wine-200',
  neutral: 'bg-mist text-ink ring-1 ring-stone',
  warn: 'bg-wine-50 text-wine-700 ring-1 ring-wine-200',
}

export function Chip({ tone = 'neutral', children, className }: { tone?: BadgeData['tone']; children: ReactNode; className?: string }) {
  return <span className={clsx('chip', CHIP_TONES[tone], className)}>{children}</span>
}

/** Colour is never the only signal: an arrow and a sign accompany it. */
export function ChangeBadge({
  value,
  className,
  dark,
  size = 'md',
}: {
  value: number | null | undefined
  className?: string
  dark?: boolean
  size?: 'sm' | 'md' | 'lg'
}) {
  const t = toneOf(value)
  const colour =
    t === 'up' ? (dark ? 'text-up-dark' : 'text-up') : t === 'down' ? (dark ? 'text-down-dark' : 'text-down') : dark ? 'text-oak-200' : 'text-muted'
  const label = t === 'up' ? 'up' : t === 'down' ? 'down' : 'unchanged'
  return (
    <span
      className={clsx(
        'tabular inline-flex items-center gap-1 font-semibold',
        size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-lg' : 'text-sm',
        colour,
        className,
      )}
    >
      <span aria-hidden="true" className="text-[0.7em]">
        {arrow(t)}
      </span>
      {fmtPct(value)}
      <span className="sr-only"> {label}</span>
    </span>
  )
}

/** Honest data labelling: says whether data is synthetic demo data or provider data. */
export function DataSourceBadge({ meta, className }: { meta: DataMeta | undefined; className?: string }) {
  if (!meta) return null
  const demo = meta.source === 'demo'
  return (
    <span className={clsx('inline-flex flex-wrap items-center gap-1.5', className)}>
      <span
        title={meta.data_note}
        className={clsx(
          'chip cursor-help',
          demo ? 'bg-wine-100 text-wine-800 ring-1 ring-wine-300' : 'bg-oak-50 text-oak-800 ring-1 ring-oak-200',
        )}
      >
        {demo ? 'DEMO DATA · SYNTHETIC' : `${meta.source_label.toUpperCase()} · MAY BE DELAYED`}
      </span>
      {meta.stale && (
        <span className="chip bg-mist text-muted ring-1 ring-stone" title="The provider could not be reached, so the last cached result is shown.">
          CACHED
        </span>
      )}
    </span>
  )
}
