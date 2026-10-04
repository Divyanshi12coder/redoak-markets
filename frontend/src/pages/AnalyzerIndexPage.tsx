import { Link } from 'react-router-dom'
import { StockSearch, POPULAR } from '../components/market/StockSearch'
import { Reveal } from '../components/ui/Reveal'
import { useAuth } from '../context/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export default function AnalyzerIndexPage() {
  useDocumentTitle('Analyzer')
  const { recentTickers, isAuthenticated } = useAuth()
  return (
    <div className="container-page py-14">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="eyebrow">Stock analyzer</p>
        <h1 className="mt-2 font-display text-4xl font-semibold text-oak-900 sm:text-5xl">Analyze a stock</h1>
        <p className="mx-auto mt-3 max-w-xl text-muted">
          Search by ticker or company name to open price charts, technical indicators, rule-based signals and Dia’s model-backed market analysis.
        </p>
        <div className="mt-8 text-left">
          <StockSearch variant="page" autoFocus />
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm">
          <span className="text-muted">Try:</span>
          {POPULAR.map((t) => (
            <Link key={t} to={`/analyze/${t}`} className="btn btn-secondary btn-sm">{t}</Link>
          ))}
        </div>
        {isAuthenticated && recentTickers.length > 0 && (
          <div className="mt-10">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Recently analyzed by you</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {recentTickers.map((t) => (
                <Link key={t} to={`/analyze/${t}`} className="btn btn-ghost btn-sm border border-stone">{t}</Link>
              ))}
            </div>
          </div>
        )}
      </Reveal>
    </div>
  )
}
