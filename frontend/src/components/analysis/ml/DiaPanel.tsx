import { useMlAnalysis } from '../../../hooks/queries'
import { fmtDate } from '../../../utils/format'
import { Chip } from '../../ui/Badges'
import { Disclaimer } from '../../ui/Disclaimer'
import { LoadingRegion, Skeleton } from '../../ui/Skeleton'
import { ErrorState } from '../../ui/States'
import { AnomalyCard } from './AnomalyCard'
import { FeatureImportance } from './FeatureImportance'
import { ModelEvaluation } from './ModelEvaluation'
import { ProbabilityBar, RegimeDashboard } from './RegimeDashboard'

export function DiaAvatar({ size = 40 }: { size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-wine-700 font-display font-semibold text-white ring-2 ring-wine-200"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
      aria-hidden="true"
    >
      D
    </span>
  )
}

function PanelSkeleton() {
  return (
    <LoadingRegion label="Dia is analysing this stock. Training the model for the first time can take a few seconds.">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 !rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-72 max-w-full" />
          </div>
        </div>
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <p className="text-sm text-muted">Dia is fitting a model to this stock’s history and validating it walk-forward. The first run for a ticker takes a few seconds.</p>
      </div>
    </LoadingRegion>
  )
}

/** "Dia's Market Analysis": regime, signals, anomalies, feature importance and a plain-English summary. */
export function DiaPanel({ ticker }: { ticker: string }) {
  const { data: ml, isPending, isError, error, refetch } = useMlAnalysis(ticker)

  return (
    <section aria-labelledby="dia-heading" className="card p-5 sm:p-6">
      {isPending ? (
        <PanelSkeleton />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <div className="space-y-7">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <DiaAvatar />
              <div>
                <h2 id="dia-heading" className="font-display text-2xl font-semibold text-oak-900">Dia’s Market Analysis</h2>
                <p className="text-xs text-muted">
                  Analytical assistant · explains calculated signals · as of {fmtDate(ml.as_of)} · model {ml.model.version}
                </p>
              </div>
            </div>
            <Chip tone="warn">EXPERIMENTAL · NOT ADVICE</Chip>
          </header>

          <ul className="flex flex-wrap gap-2" aria-label="Signals">
            {ml.badges.map((b) => (
              <li key={b.label}>
                <Chip tone={b.tone}>{b.label}</Chip>
              </li>
            ))}
          </ul>

          <blockquote className="rounded-2xl border-l-4 border-wine-600 bg-paper px-5 py-4">
            <p className="leading-relaxed text-ink">{ml.dia.summary}</p>
            <footer className="mt-2 text-xs text-muted">
              {ml.dia.source === 'llm'
                ? `Dia, assisted by ${ml.dia.model}. Numbers were checked against the calculated data.`
                : 'Dia, from the calculated indicators and model output.'}
              {ml.dia.note && <> {ml.dia.note}</>}
            </footer>
          </blockquote>

          <RegimeDashboard ml={ml} />
          <ProbabilityBar ml={ml} />

          <div className="grid gap-8 lg:grid-cols-2 [&>*]:min-w-0">
            <FeatureImportance ml={ml} />
            <AnomalyCard anomalies={ml.anomalies} />
          </div>

          <ModelEvaluation ml={ml} />
          <Disclaimer ml />
        </div>
      )}
    </section>
  )
}
