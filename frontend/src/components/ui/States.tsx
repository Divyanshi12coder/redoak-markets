import clsx from 'clsx'
import type { ReactNode } from 'react'
import { ApiError } from '../../api/client'
import { Icon, type IconName } from './Icon'

function describe(error: unknown): { title: string; message: string; hint?: string } {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'rate_limited':
        return {
          title: 'The data provider needs a moment',
          message: error.message,
          hint: error.retryAfter ? `Try again in about ${error.retryAfter}s. Cached results keep showing where available.` : undefined,
        }
      case 'provider_not_configured':
        return { title: 'Market data is not configured', message: error.message }
      case 'symbol_not_found':
        return { title: 'Symbol not found', message: error.message }
      case 'insufficient_data':
        return { title: 'Not enough history', message: error.message }
      case 'network_error':
        return { title: 'Cannot reach the server', message: error.message }
      case 'provider_error':
        return { title: 'Market data is unavailable right now', message: error.message }
      default:
        return { title: 'Something went wrong', message: error.message }
    }
  }
  return { title: 'Something went wrong', message: 'An unexpected error occurred. Please try again.' }
}

export function ErrorState({
  error,
  onRetry,
  compact,
  className,
}: {
  error: unknown
  onRetry?: () => void
  compact?: boolean
  className?: string
}) {
  const { title, message, hint } = describe(error)
  return (
    <div
      role="alert"
      className={clsx(
        'rounded-2xl border border-wine-200 bg-wine-50 text-wine-900',
        compact ? 'p-4' : 'p-8 text-center',
        className,
      )}
    >
      <div className={clsx('flex gap-3', compact ? 'items-start' : 'flex-col items-center')}>
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-wine-100 text-wine-700">
          <Icon name="alert" />
        </span>
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm text-wine-800">{message}</p>
          {hint && <p className="mt-1 text-xs text-wine-700">{hint}</p>}
          {onRetry && (
            <button type="button" onClick={onRetry} className="btn btn-secondary btn-sm mt-3">
              <Icon name="refresh" size={14} /> Try again
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
  icon = 'chart',
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  icon?: IconName
  className?: string
}) {
  return (
    <div className={clsx('rounded-2xl border border-dashed border-stone bg-white/60 p-10 text-center', className)}>
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-oak-50 text-oak-600">
        <Icon name={icon} size={22} />
      </span>
      <p className="mt-4 font-display text-lg font-semibold text-oak-900">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}
