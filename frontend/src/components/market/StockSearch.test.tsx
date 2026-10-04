import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StockSearch } from './StockSearch'

const results = {
  query: 'app',
  meta: { source: 'demo', source_label: 'Demo', data_note: '', stale: false, fetched_at: null },
  results: [
    { ticker: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', country: 'United States', instrument_type: 'Common Stock', currency: 'USD', price: 214.3, change_percent: 1.2 },
    { ticker: 'APP', name: 'AppLovin', exchange: 'NASDAQ', country: 'United States', instrument_type: 'Common Stock', currency: 'USD', price: null, change_percent: null },
  ],
}

function Where() {
  return <p data-testid="loc">{useLocation().pathname}</p>
}

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Routes>
          <Route path="*" element={<><StockSearch /><Where /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => vi.restoreAllMocks())

describe('StockSearch', () => {
  it('shows price and change for results and opens the analyzer on click', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(results), { status: 200 }))
    setup()
    await userEvent.type(screen.getByRole('combobox'), 'app')
    const option = await screen.findByRole('option', { name: /AAPL/ }, { timeout: 10000 })
    expect(option).toHaveTextContent('Apple Inc.')
    expect(option).toHaveTextContent('$214.30')
    expect(option).toHaveTextContent('+1.20%')
    await userEvent.click(option)
    expect(screen.getByTestId('loc')).toHaveTextContent('/analyze/AAPL')
  })

  it('supports keyboard selection', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(results), { status: 200 }))
    setup()
    await userEvent.type(screen.getByRole('combobox'), 'app')
    await screen.findByRole('option', { name: /AAPL/ }, { timeout: 10000 })
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(screen.getByTestId('loc')).toHaveTextContent('/analyze/APP')
  })

  it('shows a friendly error when the API fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'provider_error', message: 'Provider down' } }), { status: 502 }),
    )
    setup()
    await userEvent.type(screen.getByRole('combobox'), 'zzz')
    expect(await screen.findByRole('alert', {}, { timeout: 10000 })).toHaveTextContent(/Provider down/)
  })
})
