import clsx from 'clsx'
import type { ChartType } from '../../charts/PriceChart'
import { RANGES, type Range } from '../../types/api'

export const INDICATOR_OPTIONS = [
  { id: 'sma20', label: 'SMA 20', swatch: '#2b7550' },
  { id: 'sma50', label: 'SMA 50', swatch: '#b53a4d' },
  { id: 'sma200', label: 'SMA 200', swatch: '#0d1a13' },
  { id: 'ema20', label: 'EMA 20', swatch: '#4f956f' },
  { id: 'ema50', label: 'EMA 50', swatch: '#cb5a6b' },
  { id: 'bollinger', label: 'Bollinger', swatch: '#86b79c' },
  { id: 'rsi', label: 'RSI 14', swatch: '#164a32' },
  { id: 'macd', label: 'MACD', swatch: '#2b7550' },
  { id: 'volume', label: 'Volume', swatch: '#86b79c' },
] as const

const CHART_TYPES: { id: ChartType; label: string }[] = [
  { id: 'candles', label: 'Candles' },
  { id: 'line', label: 'Line' },
  { id: 'area', label: 'Area' },
]

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { id: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl bg-mist p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={clsx(
            'min-h-9 rounded-lg px-3 text-xs font-semibold transition sm:px-3.5',
            value === o.id ? 'bg-white text-oak-800 shadow-card' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function RangeTabs({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return <Segmented label="Time range" options={RANGES.map((r) => ({ id: r, label: r }))} value={value} onChange={onChange} />
}

export function ChartTypeToggle({ value, onChange }: { value: ChartType; onChange: (t: ChartType) => void }) {
  return <Segmented label="Chart type" options={CHART_TYPES} value={value} onChange={onChange} />
}

export function IndicatorToggles({
  enabled,
  onToggle,
  intraday,
}: {
  enabled: ReadonlySet<string>
  onToggle: (id: string) => void
  intraday: boolean
}) {
  return (
    <fieldset>
      <legend className="sr-only">Chart indicators</legend>
      <div className="flex flex-wrap gap-2">
        {INDICATOR_OPTIONS.map((o) => {
          const disabled = intraday && o.id !== 'volume'
          const checked = enabled.has(o.id) && !disabled
          return (
            <label
              key={o.id}
              className={clsx(
                'inline-flex min-h-9 cursor-pointer select-none items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition',
                checked ? 'border-oak-300 bg-oak-50 text-oak-900' : 'border-stone bg-white text-muted hover:border-oak-300',
                disabled && 'cursor-not-allowed opacity-45',
                'focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-oak-500',
              )}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                disabled={disabled}
                onChange={() => onToggle(o.id)}
              />
              <span aria-hidden="true" className="text-sm leading-none">{checked ? '☑' : '☐'}</span>
              <span className="size-2 rounded-full" style={{ background: o.swatch }} aria-hidden="true" />
              {o.label}
            </label>
          )
        })}
      </div>
      {intraday && (
        <p className="mt-2 text-xs text-muted">Indicator overlays are calculated on daily bars, so they are available for ranges of 1M and longer.</p>
      )}
    </fieldset>
  )
}
