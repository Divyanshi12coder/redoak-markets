import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { LogoMark } from '../components/brand/Logo'
import { Disclaimer } from '../components/ui/Disclaimer'
import { Icon } from '../components/ui/Icon'
import { useAuth } from '../context/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface Errors {
  name?: string
  email?: string
  password?: string
  form?: string
}

export function validate(mode: 'login' | 'signup', v: { name: string; email: string; password: string }): Errors {
  const e: Errors = {}
  if (mode === 'signup' && !v.name.trim()) e.name = 'Enter your name.'
  if (!EMAIL_RE.test(v.email.trim())) e.email = 'Enter a valid email address.'
  if (!v.password) e.password = 'Enter your password.'
  else if (mode === 'signup' && v.password.length < 8) e.password = 'Use at least 8 characters.'
  else if (new TextEncoder().encode(v.password).length > 72) e.password = 'Passwords can be at most 72 bytes.'
  return e
}

export default function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  useDocumentTitle(mode === 'login' ? 'Log in' : 'Sign up')
  const { login, register, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'

  const [values, setValues] = useState({ name: '', email: '', password: '' })
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState(false)
  const [showPw, setShowPw] = useState(false)

  if (isAuthenticated) return <Navigate to={from} replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const found = validate(mode, values)
    setErrors(found)
    if (Object.keys(found).length) {
      document.getElementById(`field-${Object.keys(found)[0]}`)?.focus()
      return
    }
    setBusy(true)
    try {
      if (mode === 'login') await login(values.email.trim(), values.password)
      else await register(values.name.trim(), values.email.trim(), values.password)
      navigate(from, { replace: true })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'
      setErrors({ form: message })
    } finally {
      setBusy(false)
    }
  }

  const field = (id: 'name' | 'email' | 'password', label: string, type: string, autoComplete: string) => (
    <div>
      <label htmlFor={`field-${id}`} className="mb-1.5 block text-sm font-semibold">{label}</label>
      <div className="relative">
        <input
          id={`field-${id}`}
          name={id}
          type={id === 'password' && showPw ? 'text' : type}
          autoComplete={autoComplete}
          value={values[id]}
          onChange={(e) => setValues((v) => ({ ...v, [id]: e.target.value }))}
          aria-invalid={!!errors[id]}
          aria-describedby={errors[id] ? `err-${id}` : undefined}
          className="h-12 w-full rounded-xl border border-stone bg-white px-4 text-base outline-none transition focus:border-oak-500 focus:ring-2 focus:ring-oak-200 aria-[invalid=true]:border-wine-500 aria-[invalid=true]:ring-wine-100"
        />
        {id === 'password' && (
          <button
            type="button"
            onClick={() => setShowPw((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1.5 text-xs font-semibold text-oak-700 hover:bg-oak-50"
            aria-pressed={showPw}
          >
            {showPw ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {errors[id] && (
        <p id={`err-${id}`} role="alert" className="mt-1.5 flex items-center gap-1.5 text-sm text-wine-700">
          <Icon name="alert" size={14} /> {errors[id]}
        </p>
      )}
    </div>
  )

  return (
    <div className="container-page grid min-h-[70vh] place-items-center py-12">
      <div className="card w-full max-w-md p-7 sm:p-9">
        <div className="flex flex-col items-center text-center">
          <LogoMark size={48} />
          <h1 className="mt-4 font-display text-3xl font-semibold text-oak-900">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {mode === 'login' ? 'Log in to open your watchlist and analysis history.' : 'Save a watchlist and keep your analysis history.'}
          </p>
        </div>

        <form onSubmit={onSubmit} noValidate className="mt-7 space-y-4">
          {errors.form && (
            <p role="alert" className="flex items-start gap-2 rounded-xl border border-wine-200 bg-wine-50 px-4 py-3 text-sm text-wine-800">
              <Icon name="alert" size={16} className="mt-0.5 shrink-0" /> {errors.form}
            </p>
          )}
          {mode === 'signup' && field('name', 'Name', 'text', 'name')}
          {field('email', 'Email', 'email', 'email')}
          {field('password', 'Password', 'password', mode === 'login' ? 'current-password' : 'new-password')}
          <button type="submit" disabled={busy} className="btn btn-primary w-full !min-h-12">
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          {mode === 'login' ? (
            <>New to RedOak? <Link to="/signup" state={location.state} className="font-semibold text-oak-700 hover:underline">Create an account</Link></>
          ) : (
            <>Already have an account? <Link to="/login" state={location.state} className="font-semibold text-oak-700 hover:underline">Log in</Link></>
          )}
        </p>
        {import.meta.env.DEV && mode === 'login' && (
          <p className="mt-3 rounded-lg bg-oak-50 px-3 py-2 text-center text-xs text-oak-800">
            Local demo: run <code>python -m app.scripts.seed</code> in <code>backend/</code> to create the demo user <b>Dia</b> (dia@redoak.dev).
          </p>
        )}
        <Disclaimer className="mt-6" />
      </div>
    </div>
  )
}
