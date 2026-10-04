const TICKER_RE = /^[A-Z0-9][A-Z0-9.-]{0,9}$/

/** Returns the upper-cased ticker, or null if it is not a plausible symbol. */
export function normaliseTicker(raw: string): string | null {
  const t = raw.trim().toUpperCase()
  return TICKER_RE.test(t) ? t : null
}
