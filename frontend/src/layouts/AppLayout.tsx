import { Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Footer } from '../components/layout/Footer'
import { Nav } from '../components/layout/Nav'
import { useHealth } from '../hooks/queries'
import { Skeleton } from '../components/ui/Skeleton'

function DemoBanner() {
  const { data } = useHealth()
  if (!data?.market_data.synthetic) return null
  return (
    <div role="note" className="bg-wine-800 px-4 py-1.5 text-center text-xs font-medium text-wine-50">
      <strong className="tracking-wide">DEMO DATA</strong> · Prices in this environment are synthetic and generated for demonstration. They are not real market data.
    </div>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 })
  }, [pathname])
  return null
}

function PageFallback() {
  return (
    <div className="container-page py-12" role="status" aria-busy="true">
      <span className="sr-only">Loading page</span>
      <Skeleton className="mb-4 h-10 w-64" />
      <Skeleton className="h-72 w-full" />
    </div>
  )
}

export function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-ink focus:shadow-lift"
      >
        Skip to content
      </a>
      <DemoBanner />
      <Nav />
      <ScrollToTop />
      <main id="main" className="flex-1">
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
