export type Tone = 'up' | 'down' | 'flat'

export function tone(value: number | null | undefined): Tone {
  if (value == null || Math.abs(value) < 0.005) return 'flat'
  return value > 0 ? 'up' : 'down'
}

export function fmtPrice(v: number | null | undefined, currency = 'USD'): string {
  if (v == null || Number.isNaN(v)) return '--'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: v < 1 ? 4 : 2,
  }).format(v)
}

export function fmtNumber(v: number | null | undefined, digits = 2): string {
  if (v == null || Number.isNaN(v)) return '--'
  return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/** Signed percentage, e.g. +1.23% / -0.40% */
export function fmtPct(v: number | null | undefined, digits = 2): string {
  if (v == null || Number.isNaN(v)) return '--'
  const sign = v > 0 ? '+' : v < 0 ? '-' : ''
  return `${sign}${Math.abs(v).toFixed(digits)}%`
}

export function fmtSigned(v: number | null | undefined, digits = 2): string {
  if (v == null || Number.isNaN(v)) return '--'
  const sign = v > 0 ? '+' : v < 0 ? '-' : ''
  return `${sign}${Math.abs(v).toFixed(digits)}`
}

export function fmtCompact(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '--'
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(v)
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '--'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '--'
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '--'
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso)
  if (Number.isNaN(d.getTime())) return '--'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export function arrow(t: Tone): string {
  return t === 'up' ? '▲' : t === 'down' ? '▼' : '■'
}

export const DISCLAIMER =
  'RedOak Markets provides educational and analytical information only. Technical indicators and signals are not guarantees of future performance and should not be considered financial advice.'

export const ML_DISCLAIMER =
  'Machine-learning output is an experimental analytical signal based on historical patterns. It is not a prediction, a recommendation or financial advice.'
