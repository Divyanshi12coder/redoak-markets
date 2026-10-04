import clsx from 'clsx'
import type { MlAnalysisResponse } from '../../../types/api'
import { fmtNumber } from '../../../utils/format'

function Tile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'bull' | 'bear' | 'warn' | 'neutral' }) {
  return (
    <div className="rounded-xl border border-stone bg-paper/60 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p
        className={clsx(
          'mt-1 font-display text-2xl font-semibold',
          tone === 'bull' && 'text-up',
          tone === 'bear' && 'text-down',
          tone === 'warn' && 'text-wine-700',
          (!tone || tone === 'neutral') && 'text-ink',
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted">{sub}</p>
    </div>
  )
}

/** "Current market regime" - every value is computed from features / model output, none are static. */
export function RegimeDashboard({ ml }: { ml: MlAnalysisResponse }) {
  const r = ml.regime
  const trendTone = ml.classification.regime === 'bullish' ? 'bull' : ml.classification.regime === 'bearish' ? 'bear' : 'neutral'
  const momentumTone = r.momentum.direction === 'Positive' ? 'bull' : r.momentum.direction === 'Negative' ? 'bear' : 'neutral'
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Current market regime</h3>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="Trend"
          value={r.trend.label}
          tone={trendTone}
          sub={`${r.character.label}${r.character.efficiency_ratio != null ? ` · efficiency ${fmtNumber(r.character.efficiency_ratio, 2)}` : ''}`}
        />
        <Tile
          label="Momentum"
          value={r.momentum.label}
          tone={r.momentum.label === 'Weak' ? 'neutral' : momentumTone}
          sub={`${r.momentum.direction} · z = ${fmtNumber(r.momentum.z_score, 2)}`}
        />
        <Tile
          label="Volatility"
          value={r.volatility.label}
          tone={r.volatility.label === 'High' ? 'warn' : 'neutral'}
          sub={`${fmtNumber(r.volatility.annualised * 100, 1)}% annualised${r.volatility.percentile != null ? ` · ${fmtNumber(r.volatility.percentile, 0)}th pct` : ''}`}
        />
        <Tile label="Volume" value={r.volume.label} sub={`${fmtNumber(r.volume.ratio_to_20d_avg, 2)}× its 20-day average`} />
      </div>
    </div>
  )
}

/** Three-segment bar of the model's class probabilities. */
export function ProbabilityBar({ ml }: { ml: MlAnalysisResponse }) {
  const p = ml.classification.probabilities
  const segments = [
    { key: 'bearish', colour: 'bg-wine-600', value: p.bearish },
    { key: 'neutral', colour: 'bg-stone', value: p.neutral },
    { key: 'bullish', colour: 'bg-oak-600', value: p.bullish },
  ] as const
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">Model classification</h3>
        <p className="text-sm">
          <b className="font-display text-lg capitalize">{ml.classification.regime}</b>{' '}
          <span className="tabular text-muted">(class probability {fmtNumber(ml.classification.confidence, 2)})</span>
        </p>
      </div>
      <div
        className="mt-2 flex h-3 overflow-hidden rounded-full bg-mist"
        role="img"
        aria-label={`Class probabilities: bearish ${fmtNumber(p.bearish, 2)}, neutral ${fmtNumber(p.neutral, 2)}, bullish ${fmtNumber(p.bullish, 2)}`}
      >
        {segments.map((s) => (
          <div key={s.key} className={clsx(s.colour, 'h-full transition-[width] duration-700')} style={{ width: `${s.value * 100}%` }} />
        ))}
      </div>
      <div className="tabular mt-1.5 flex justify-between text-xs text-muted">
        {segments.map((s) => (
          <span key={s.key} className="capitalize">{s.key} {fmtNumber(s.value * 100, 0)}%</span>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">{ml.classification.confidence_note}</p>
    </div>
  )
}
