import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Skeleton } from '../ui/Skeleton'

/** Route guard: redirects to /login (remembering where the user was headed). */
export function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="container-page py-12" role="status" aria-busy="true">
        <span className="sr-only">Checking your session</span>
        <Skeleton className="mb-4 h-10 w-72" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}
