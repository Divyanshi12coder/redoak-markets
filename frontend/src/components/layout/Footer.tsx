import { Link } from 'react-router-dom'
import { Logo } from '../brand/Logo'
import { Disclaimer } from '../ui/Disclaimer'
import { GITHUB_URL } from './Nav'

export function Footer() {
  return (
    <footer className="on-dark mt-20 bg-oak-950 text-oak-100">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm font-display text-lg text-white">See the market. Understand the trend.</p>
          <Disclaimer dark className="mt-5 max-w-md" />
        </div>
        <nav aria-label="Explore" className="text-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-oak-300">Explore</p>
          <ul className="space-y-2">
            {[['/markets', 'Markets'], ['/analyze', 'Stock analyzer'], ['/compare', 'Compare stocks'], ['/watchlist', 'Watchlist']].map(([to, label]) => (
              <li key={to}>
                <Link to={to} className="hover:text-white">{label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Project" className="text-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-oak-300">Project</p>
          <ul className="space-y-2">
            <li><Link to="/about" className="hover:text-white">About &amp; methodology</Link></li>
            <li><a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white">Source on GitHub</a></li>
            <li>
              <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                Charts by TradingView Lightweight Charts™
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-oak-300">
        © {new Date().getFullYear()} RedOak Markets · Educational project · Not investment advice
      </div>
    </footer>
  )
}
