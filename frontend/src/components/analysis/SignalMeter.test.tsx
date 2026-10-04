import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { AnalysisResponse } from '../../types/api'
import { SignalMeter } from './SignalMeter'

const make = (label: string, score: number, position: number): AnalysisResponse => ({
  ticker: 'AAPL',
  as_of: '2025-01-10',
  signal: { score, label, position },
  components: {
    rsi: { score: 0, label: 'Neutral', detail: 'RSI(14) is 54.4, between the oversold (30) and overbought (70) thresholds.' },
    moving_average: { score: 1, label: 'Bullish signal', detail: 'Price is 3.0% above the 50-day SMA.' },
    momentum: { score: -0.5, label: 'Momentum weakening', detail: 'MACD is below its signal line.' },
  },
  rules: [],
  rule_catalogue: ['Price above / below SMA 20, 50 and 200 (trend)'],
  latest: {},
  disclaimer: 'x',
  meta: { source: 'demo', source_label: 'Demo data', data_note: '', stale: false, fetched_at: null },
})

describe('SignalMeter', () => {
  it('exposes the score as an accessible meter with an honest label', () => {
    render(<SignalMeter analysis={make('Bullish signal', 0.6, 0.8)} />)
    const meter = screen.getByRole('meter', { name: /technical signal/i })
    expect(meter).toHaveAttribute('aria-valuenow', '0.6')
    expect(meter).toHaveAttribute('aria-valuetext', expect.stringContaining('Bullish signal'))
    expect(screen.getByText('Moving averages')).toBeInTheDocument()
    expect(screen.getByText('Momentum weakening')).toBeInTheDocument()
  })

  it('always shows the disclaimer and never predicts', () => {
    render(<SignalMeter analysis={make('Neutral', 0, 0.5)} />)
    expect(screen.getByText(/not guarantees of future performance/i)).toBeInTheDocument()
    expect(screen.queryByText(/will rise|guarantee profit/i)).toBeNull()
  })
})
