import clsx from 'clsx'
import { motion, useReducedMotion } from 'framer-motion'
import type { AnalysisResponse, SignalScore } from '../../types/api'
import { fmtSigned } from '../../utils/format'
import { Disclaimer } from '../ui/Disclaimer'

const COMPONENTS: { key: 'rsi' | 'moving_average' | 'momentum'; title: string }[] = [
  { key: 'rsi', title: 'RSI condition' },
  { key: 'moving_average', title: 'Moving averages' },
  { key: 'momentum', title: 'Momentum' },
]

function signalTone(label: string): 'bull' | 'bear' | 'neutral' {
  if (/bullish|strengthening|oversold/i.test(label)) return 'bull'
  if (/bearish|weakening|overbought/i.test(label)) return 'bear'
  return 'neutral'
}

const TONE_TEXT = { bull: 'text-up', bear: 'text-down', neutral: 'text-ink' } as const
const TONE_MARK = { bull: '▲', bear: '▼', neutral: '■' } as const

/** Horizontal technical-signal meter, driven entirely by the rule-based composite score. */
export function SignalMeter({ analysis }: { analysis: AnalysisResponse }) {
  const reduce = useReducedMotion()
  const { signal } = analysis
  const position = Math.min(1, Math.max(0, signal.position ?? 0.5))
  const tone = signalTone(signal.label)
  const hasData = signal.label !== 'Insufficient data'

  return (
    <section aria-labelledby="signal-heading" className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p id="signal-heading" className="eyebrow">Technical signal</p>
          <p className={clsx('mt-1 font-display text-3xl font-semibold', TONE_TEXT[tone])}>
            <span aria-hidden="true" className="mr-1.5 text-xl">{TONE_MARK[tone]}</span>
            {signal.label}
          </p>
        </div>
        <p className="tabular text-right text-xs text-muted">
          Composite score
          <br />
          <b className="text-base text-ink">{fmtSigned(signal.score)}</b> <span>(−1 to +1)</span>
        </p>
      </div>

      <div className="mt-8 px-2">
        <div
          role="meter"
          aria-label="Technical signal from bearish to bullish"
          aria-valuemin={-1}
          aria-valuemax={1}
          aria-valuenow={signal.score}
          aria-valuetext={`${signal.label}, composite score ${fmtSigned(signal.score)}`}
          className="relative h-3 rounded-full"
          style={{
            background:
              'linear-gradient(90deg, #7d1d2d 0%, #b53a4d 22%, #dd8b97 38%, #ecebe5 50%, #86b79c 62%, #2b7550 78%, #164a32 100%)',
          }}
        >
          {[25, 50, 75].map((p) => (
            <span key={p} className="absolute top-0 h-full w-px bg-white/70" style={{ left: `${p}%` }} aria-hidden="true" />
          ))}
          {hasData && (
            <motion.span
              className="absolute top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-[5px] border-ink bg-white shadow-lift"
              initial={reduce ? false : { left: '50%' }}
              animate={{ left: `${position * 100}%` }}
              transition={{ type: 'spring', stiffness: 90, damping: 16, delay: 0.15 }}
            />
          )}
        </div>
        <div className="mt-2 flex justify-between text-[11px] font-semibold uppercase tracking-widest" aria-hidden="true">
          <span className="text-down">Bearish</span>
          <span className="text-muted">Neutral</span>
          <span className="text-up">Bullish</span>
        </div>
      </div>

      <ul className="mt-6 grid gap-3 sm:grid-cols-3">
        {COMPONENTS.map(({ key, title }) => (
          <ComponentTile key={key} title={title} comp={analysis.components[key]} />
        ))}
      </ul>

      <details className="mt-5 rounded-xl bg-oak-50 px-4 py-3 text-sm">
        <summary className="cursor-pointer font-semibold text-oak-800">How is this calculated?</summary>
        <p className="mt-2 text-muted">
          Each rule below scores between −1 (bearish) and +1 (bullish); the composite is their weighted average. Nothing here is a forecast - it
          describes the current state of widely used indicators.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          {analysis.rule_catalogue.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </details>

      <Disclaimer className="mt-4" />
    </section>
  )
}

function ComponentTile({ title, comp }: { title: string; comp: SignalScore | undefined }) {
  if (!comp) return null
  const tone = signalTone(comp.label)
  return (
    <li className="rounded-xl border border-stone bg-paper/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</p>
      <p className={clsx('mt-1 flex items-center gap-1.5 font-semibold', TONE_TEXT[tone])}>
        <span aria-hidden="true" className="text-xs">{TONE_MARK[tone]}</span>
        {comp.label}
      </p>
      {comp.detail && <p className="mt-1.5 text-xs leading-relaxed text-muted">{comp.detail}</p>}
    </li>
  )
}
