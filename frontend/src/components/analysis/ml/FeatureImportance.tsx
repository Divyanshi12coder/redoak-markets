import clsx from 'clsx'
import { motion, useReducedMotion } from 'framer-motion'
import { useState } from 'react'
import type { ImportanceRow, MlAnalysisResponse } from '../../../types/api'
import { fmtNumber } from '../../../utils/format'

type Mode = 'global' | 'local'

/**
 * "What influenced this analysis?"
 *  - Overall: impurity-based importance of each feature in the random forest.
 *  - This analysis: how much each feature moved *this* classification (occlusion test).
 */
export function FeatureImportance({ ml }: { ml: MlAnalysisResponse }) {
  const [mode, setMode] = useState<Mode>('global')
  const [expanded, setExpanded] = useState(false)
  const [focused, setFocused] = useState<string | null>(null)
  const reduce = useReducedMotion()

  const all: ImportanceRow[] = ml.feature_importance[mode]
  const rows = expanded ? all : all.slice(0, 8)
  const valueOf = (r: ImportanceRow) => (mode === 'global' ? (r.importance ?? 0) : (r.contribution ?? 0))
  const max = Math.max(...all.map((r) => Math.abs(valueOf(r))), 1e-9)
  const active = all.find((r) => r.key === focused) ?? rows[0]

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">What influenced this analysis?</h3>
        <div role="group" aria-label="Importance view" className="inline-flex rounded-lg bg-mist p-0.5 text-xs font-semibold">
          {(['global', 'local'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={clsx('rounded-md px-3 py-1.5 transition', mode === m ? 'bg-white text-oak-800 shadow-card' : 'text-muted hover:text-ink')}
            >
              {m === 'global' ? 'Overall model' : 'This analysis'}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-xs text-muted">
        {mode === 'global'
          ? 'How much the model relies on each feature across everything it learned from this stock’s history.'
          : `How much each feature’s current value pushed the model towards “${ml.classification.regime}” (green) or away from it (red).`}
      </p>

      <ul className="mt-3 space-y-1.5">
        {rows.map((r, i) => {
          const v = valueOf(r)
          const width = Math.max(2, (Math.abs(v) / max) * 100)
          const negative = mode === 'local' && v < 0
          return (
            <li key={r.key}>
              <button
                type="button"
                onMouseEnter={() => setFocused(r.key)}
                onFocus={() => setFocused(r.key)}
                aria-describedby="fi-detail"
                className={clsx(
                  'group grid w-full grid-cols-[minmax(6rem,10rem)_1fr_3.5rem] items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-oak-50 focus-visible:bg-oak-50',
                  active?.key === r.key && 'bg-oak-50',
                )}
              >
                <span className="truncate font-medium">{r.label}</span>
                <span className="h-2.5 rounded-full bg-mist" aria-hidden="true">
                  <motion.span
                    className={clsx('block h-full rounded-full', negative ? 'bg-wine-500' : 'bg-oak-600')}
                    initial={reduce ? false : { width: 0 }}
                    animate={{ width: `${width}%` }}
                    transition={{ duration: 0.6, delay: i * 0.04, ease: 'easeOut' }}
                  />
                </span>
                <span className="tabular text-right text-xs text-muted">
                  {mode === 'global' ? `${fmtNumber(v * 100, 1)}%` : `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmtNumber(Math.abs(v) * 100, 1)}pp`}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {all.length > 8 && (
        <button type="button" onClick={() => setExpanded((e) => !e)} className="mt-2 text-xs font-semibold text-oak-700 underline-offset-2 hover:underline">
          {expanded ? 'Show top 8' : `Show all ${all.length} features`}
        </button>
      )}

      {active && (
        <p id="fi-detail" className="mt-3 rounded-lg bg-paper px-3 py-2 text-xs leading-relaxed text-muted" aria-live="polite">
          <b className="text-ink">{active.label}</b> - {active.description} Current value: <b className="tabular text-ink">{fmtNumber(active.value, 3)}</b>
        </p>
      )}
    </div>
  )
}
