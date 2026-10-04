import { lazy, Suspense, useState } from 'react'
import type { ChartType } from '../../charts/PriceChart'
import { useAuth } from '../../context/AuthContext'
import { useHistory, useIndicators } from '../../hooks/queries'
import type { Range } from '../../types/api'
import { DataSourceBadge } from '../ui/Badges'
import { LoadingRegion, Skeleton } from '../ui/Skeleton'
import { ErrorState } from '../ui/States'
import { ChartTypeToggle, IndicatorToggles, RangeTabs } from './ChartToolbar'

// The charting library is only downloaded when an analyzer / chart view is opened.
const PriceChart = lazy(() => import('../../charts/PriceChart').then((m) => ({ default: m.PriceChart })))

const DEFAULT_INDICATORS = ['sma20', 'sma50', 'ema20', 'volume']

export function ChartSection({ ticker }: { ticker: string }) {
  const { isAuthenticated, preferences, savePreferences } = useAuth()
  const [range, setRange] = useState<Range>(preferences?.default_range ?? '6M')
  const [chartType, setChartType] = useState<ChartType>(preferences?.chart_type ?? 'candles')
  const [enabled, setEnabled] = useState<ReadonlySet<string>>(
    () => new Set(preferences?.indicators?.length ? [...preferences.indicators, 'volume'].filter((v, i, a) => a.indexOf(v) === i) : DEFAULT_INDICATORS),
  )
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const history = useHistory(ticker, range)
  const intraday = range === '1D' || range === '5D'
  const indicators = useIndicators(ticker, range)

  const toggle = (id: string) =>
    setEnabled((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  async function saveDefaults() {
    setSaved('saving')
    try {
      await savePreferences({ default_range: range, chart_type: chartType, indicators: [...enabled] })
      setSaved('saved')
      window.setTimeout(() => setSaved('idle'), 2500)
    } catch {
      setSaved('error')
    }
  }

  return (
    <section aria-label={`${ticker} price chart`} className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RangeTabs value={range} onChange={setRange} />
        <ChartTypeToggle value={chartType} onChange={setChartType} />
      </div>
      <div className="mt-4">
        <IndicatorToggles enabled={enabled} onToggle={toggle} intraday={intraday} />
      </div>

      <div className="mt-4 min-h-[27rem]">
        {history.isPending ? (
          <LoadingRegion label="Loading price chart"><Skeleton className="h-[27rem] w-full" /></LoadingRegion>
        ) : history.isError ? (
          <ErrorState error={history.error} onRetry={() => history.refetch()} />
        ) : history.data.candles.length === 0 ? (
          <ErrorState error={new Error('empty')} />
        ) : (
          <Suspense fallback={<Skeleton className="h-[27rem] w-full" />}>
            <PriceChart
              history={history.data}
              indicators={intraday ? undefined : indicators.data}
              chartType={chartType}
              enabled={enabled}
              dimmed={history.isPlaceholderData}
            />
          </Suspense>
        )}
        {history.data && intraday && history.data.candles.length < 3 && (
          <p className="mt-2 text-xs text-muted">Few intraday bars are available right now (the market may have just opened or be closed).</p>
        )}
        {indicators.isError && !intraday && (
          <p role="alert" className="mt-2 text-xs text-wine-700">Indicator overlays could not be loaded: {(indicators.error as Error).message}</p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-stone/70 pt-3">
        <DataSourceBadge meta={history.data?.meta} />
        {isAuthenticated && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={saveDefaults} disabled={saved === 'saving'}>
            {saved === 'saved' ? 'Saved as your default view' : saved === 'error' ? 'Could not save - retry' : 'Save as my default view'}
          </button>
        )}
      </div>
    </section>
  )
}
