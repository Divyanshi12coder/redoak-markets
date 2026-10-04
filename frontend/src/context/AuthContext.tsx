import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../api/endpoints'
import { ApiError, tokenStore, UNAUTHORIZED_EVENT } from '../api/client'
import type { Preferences, Profile, TokenResponse, User } from '../types/api'

interface AuthState {
  user: User | null
  preferences: Preferences | null
  recentTickers: string[]
  isAuthenticated: boolean
  /** True while a stored token is being validated against the API. */
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
  savePreferences: (prefs: Preferences) => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [token, setToken] = useState<string | null>(() => tokenStore.get())

  const profile = useQuery({
    queryKey: ['profile', token],
    queryFn: api.profile,
    enabled: !!token,
    staleTime: 5 * 60_000,
    retry: (count, err) => !(err instanceof ApiError && err.status === 401) && count < 1,
  })

  const clearSession = useCallback(() => {
    tokenStore.clear()
    setToken(null)
    qc.removeQueries({ queryKey: ['profile'] })
    qc.removeQueries({ queryKey: ['watchlist'] })
  }, [qc])

  // The API client fires this when a stored token is rejected (expired / revoked).
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, clearSession)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, clearSession)
  }, [clearSession])

  const startSession = useCallback(
    (res: TokenResponse) => {
      tokenStore.set(res.access_token)
      setToken(res.access_token)
      qc.removeQueries({ queryKey: ['watchlist'] })
    },
    [qc],
  )

  const value = useMemo<AuthState>(() => {
    const data: Profile | undefined = profile.data
    return {
      user: data?.user ?? null,
      preferences: data?.preferences ?? null,
      recentTickers: data?.recent_tickers ?? [],
      isAuthenticated: !!token && !profile.isError,
      isLoading: !!token && profile.isPending,
      login: async (email, password) => startSession(await api.login({ email, password })),
      register: async (name, email, password) => startSession(await api.register({ name, email, password })),
      logout: clearSession,
      savePreferences: async (prefs) => {
        const saved = await api.savePreferences(prefs)
        qc.setQueryData<Profile>(['profile', token], (old) => (old ? { ...old, preferences: saved } : old))
      },
    }
  }, [token, profile.data, profile.isError, profile.isPending, startSession, clearSession, qc])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
