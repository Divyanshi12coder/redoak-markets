import clsx from 'clsx'
import type { AnalysisResponse, SignalRule } from '../../types/api'
import { fmtNumber, fmtPrice } from '../../utils/format'

function RsiGauge({ value }: { value: number | null }) {
  if (value == null) return null
  const pct = Math.min(100, Math.max(0, value))
  const state = value >= 70 ? 'Potentially overbought' : value <= 30 ? 'Potentially oversold' : 'Neutral range'
  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">RSI (14)</p>
        <p className="tabular font-display text-2xl font-semibold">{fmtNumber(value, 1)}</p>
      </div>
      <div
        role="meter"
        aria-label="RSI 14"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={`${fmtNumber(value, 1)} - ${state}`}
        className="relative mt-3 h-2.5 overflow-hidden rounded-full"
        style={{ background: 'linear-gradient(90deg,#b6d5c3 0%,#b6d5c3 30%,#ecebe5 30%,#ecebe5 70%,#ebbbc2 70%,#ebbbc2 100%)' }}
      >
        <span className="absolute top-0 h-full w-1 -translate-x-1/2 rounded bg-ink transition-[left] duration-700" style={{ left: `${pct}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted" aria-hidden="true">
        <span>0</span><span>30</span><span>70</span><span>100</span>
      </div>
      <p className="mt-1 text-xs font-medium text-ink">{state}</p>
    </div>
  )
}

function LevelRow({ label, value, price }: { label: string; value: number | null; price: number | null }) {
  if (value == null) {
    return (
      <tr className="border-t border-stone/70">
        <th scope="row" className="py-2 pr-3 text-left font-medium">{label}</th>
        <td className="py-2 text-right text-muted" colSpan={2}>Not enough history</td>
      </tr>
    )
  }
  const above = price != null && price >= value
  return (
    <tr className="border-t border-stone/70">
      <th scope="row" className="py-2 pr-3 text-left font-medium">{label}</th>
      <td className="tabular py-2 text-right">{fmtPrice(value)}</td>
      <td className={clsx('py-2 pl-3 text-right text-xs font-semibold', above ? 'text-up' : 'text-down')}>
        <span aria-hidden="true">{above ? '▲' : '▼'}</span> price {above ? 'above' : 'below'}
      </td>
    </tr>
  )
}

export function IndicatorPanel({ analysis }: { analysis: AnalysisResponse }) {
  const l = analysis.latest
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <RsiGauge value={l.rsi14 ?? null} />
      <div className="card p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Moving averages vs price</p>
        <table className="mt-2 w-full text-sm">
          <caption className="sr-only">Latest moving-average values and the price position relative to each</caption>
          <tbody>
            <LevelRow label="SMA 20" value={l.sma20 ?? null} price={l.price ?? null} />
            <LevelRow label="SMA 50" value={l.sma50 ?? null} price={l.price ?? null} />
            <LevelRow label="SMA 200" value={l.sma200 ?? null} price={l.price ?? null} />
            <LevelRow label="EMA 20" value={l.ema20 ?? null} price={l.price ?? null} />
            <LevelRow label="EMA 50" value={l.ema50 ?? null} price={l.price ?? null} />
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function RuleList({ rules }: { rules: SignalRule[] }) {
  if (!rules.length) return null
  return (
    <section aria-labelledby="rules-heading" className="card p-5 sm:p-6">
      <h2 id="rules-heading" className="font-display text-xl font-semibold text-oak-900">Why this signal?</h2>
      <p className="mt-1 text-sm text-muted">Every rule that contributed, in plain English. Signals describe current conditions - they do not predict outcomes.</p>
      <ul className="mt-4 divide-y divide-stone/70">
        {rules.map((r) => {
          const t = r.score > 0.1 ? 'up' : r.score < -0.1 ? 'down' : 'flat'
          return (
            <li key={r.key} className="flex items-start gap-3 py-3">
              <span
                aria-hidden="true"
                className={clsx(
                  'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[10px]',
                  t === 'up' && 'bg-oak-100 text-oak-700',
                  t === 'down' && 'bg-wine-100 text-wine-700',
                  t === 'flat' && 'bg-mist text-muted',
                )}
              >
                {t === 'up' ? '▲' : t === 'down' ? '▼' : '■'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{r.label}</p>
                <p className="text-sm text-muted">{r.detail}</p>
              </div>
              <span className="tabular shrink-0 text-xs text-muted">{r.score > 0 ? '+' : ''}{r.score.toFixed(1)}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
