import { describe, expect, it } from 'vitest'
import { fmtCompact, fmtPct, fmtPrice, tone } from './format'
import { normaliseTicker } from './ticker'

describe('format helpers', () => {
  it('signs percentages and handles missing values', () => {
    expect(fmtPct(1.234)).toBe('+1.23%')
    expect(fmtPct(-0.4)).toBe('-0.40%')
    expect(fmtPct(0)).toBe('0.00%')
    expect(fmtPct(null)).toBe('--')
  })
  it('formats prices and compact volume', () => {
    expect(fmtPrice(1234.5)).toBe('$1,234.50')
    expect(fmtPrice(undefined)).toBe('--')
    expect(fmtCompact(1_250_000)).toBe('1.25M')
  })
  it('derives tone, treating tiny moves as flat', () => {
    expect(tone(1)).toBe('up')
    expect(tone(-1)).toBe('down')
    expect(tone(0.001)).toBe('flat')
    expect(tone(null)).toBe('flat')
  })
  it('validates tickers', () => {
    expect(normaliseTicker(' aapl ')).toBe('AAPL')
    expect(normaliseTicker('BRK.B')).toBe('BRK.B')
    expect(normaliseTicker('bad ticker!')).toBeNull()
    expect(normaliseTicker('')).toBeNull()
  })
})
