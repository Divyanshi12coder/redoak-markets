import { lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import { RequireAuth } from './components/layout/RequireAuth'
import { AppLayout } from './layouts/AppLayout'

// Route-level code splitting keeps the charting library out of the landing-page bundle.
const HomePage = lazy(() => import('./pages/HomePage'))
const MarketsPage = lazy(() => import('./pages/MarketsPage'))
const AnalyzerIndexPage = lazy(() => import('./pages/AnalyzerIndexPage'))
const AnalyzerPage = lazy(() => import('./pages/AnalyzerPage'))
const ComparePage = lazy(() => import('./pages/ComparePage'))
const WatchlistPage = lazy(() => import('./pages/WatchlistPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const AboutPage = lazy(() => import('./pages/AboutPage'))
const AuthPage = lazy(() => import('./pages/AuthPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="markets" element={<MarketsPage />} />
        <Route path="analyze" element={<AnalyzerIndexPage />} />
        <Route path="analyze/:ticker" element={<AnalyzerPage />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="login" element={<AuthPage mode="login" />} />
        <Route path="signup" element={<AuthPage mode="signup" />} />
        <Route element={<RequireAuth />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="watchlist" element={<WatchlistPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
