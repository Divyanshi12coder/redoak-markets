import { useQueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChartSection } from '../components/analysis/ChartSection'
import { IndicatorPanel, RuleList } from '../components/analysis/IndicatorPanel'
import { SignalMeter } from '../components/analysis/SignalMeter'
import { StockHeader } from '../components/analysis/StockHeader'
import { Reveal } from '../components/ui/Reveal'
import { CardSkeleton, LoadingRegion, Skeleton } from '../components/ui/Skeleton'
import { EmptyState, ErrorState } from '../components/ui/States'
import { useAuth } from '../context/AuthContext'
import { useAnalysis, useQuote } from '../hooks/queries'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { normaliseTicker } from '../utils/ticker'

const DiaPanel = lazy(() => import('../components/analysis/ml/DiaPanel').then((m) => ({ default: m.DiaPanel })))

export default function AnalyzerPage() {
  const params = useParams()
  const ticker = useMemo(() => normaliseTicker(params.ticker ?? ''), [params.ticker])
  useDocumentTitle(ticker ? `${ticker} analysis` : 'Analyzer')

  if (!ticker) {
    return (
      <div className="container-page py-12">
        <EmptyState
          icon="alert"
          title="That doesn’t look like a ticker symbol"
          description={`“${params.ticker}” is not a valid symbol. Tickers are 1-10 letters or digits, e.g. AAPL or BRK.B.`}
          action={<Link className="btn btn-primary" to="/analyze">Search again</Link>}
        />
      </div>
    )
  }
  return <AnalyzerContent key={ticker} ticker={ticker} />
}

function AnalyzerContent({ ticker }: { ticker: string }) {
  const quote = useQuote(ticker)
  const analysis = useAnalysis(ticker) // the API records this visit for signed-in users
  const { isAuthenticated } = useAuth()
  const qc = useQueryClient()

  // Refresh "recently analysed" on the dashboard after a successful visit.
  useEffect(() => {
    if (analysis.isSuccess && isAuthenticated) void qc.invalidateQueries({ queryKey: ['profile'] })
  }, [analysis.isSuccess, isAuthenticated, qc])

  return (
    <div className="container-page space-y-6 py-8">
      {quote.isPending ? (
        <LoadingRegion label="Loading quote">
          <div className="card p-6">
            <Skeleton className="mb-3 h-8 w-40" />
            <Skeleton className="h-12 w-64" />
          </div>
        </LoadingRegion>
      ) : quote.isError ? (
        <>
          <ErrorState error={quote.error} onRetry={() => quote.refetch()} />
          <p className="text-center text-sm">
            <Link className="font-semibold text-oak-700 underline" to="/analyze">Search for another stock</Link>
          </p>
        </>
      ) : (
        <Reveal><StockHeader quote={quote.data} /></Reveal>
      )}

      {!quote.isError && (
        <>
          <ChartSection ticker={ticker} />

          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              {analysis.isPending ? (
                <LoadingRegion label="Calculating technical signals"><CardSkeleton lines={5} className="h-72" /></LoadingRegion>
              ) : analysis.isError ? (
                <ErrorState error={analysis.error} onRetry={() => analysis.refetch()} />
              ) : (
                <Reveal><SignalMeter analysis={analysis.data} /></Reveal>
              )}
            </div>
            <div className="lg:col-span-2">
              {analysis.data && (
                <Reveal delay={0.05}><IndicatorPanel analysis={analysis.data} /></Reveal>
              )}
            </div>
          </div>

          {analysis.data && <Reveal><RuleList rules={analysis.data.rules} /></Reveal>}

          <Suspense fallback={<CardSkeleton lines={6} className="h-96" />}>
            <DiaPanel ticker={ticker} />
          </Suspense>
        </>
      )}
    </div>
  )
}
