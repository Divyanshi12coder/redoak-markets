import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../context/AuthContext'
import AuthPage, { validate } from './AuthPage'

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

function setup(mode: 'login' | 'signup') {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <AuthProvider>
          <AuthPage mode={mode} />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AuthPage', () => {
  it('validates fields', () => {
    expect(validate('signup', { name: '', email: 'x', password: 'short' })).toMatchObject({
      name: expect.any(String),
      email: expect.any(String),
      password: expect.any(String),
    })
    expect(validate('login', { name: '', email: 'a@b.co', password: 'x' })).toEqual({})
  })

  it('announces validation errors accessibly and does not call the API', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    setup('login')
    await userEvent.click(screen.getByRole('button', { name: /log in/i }))
    expect(await screen.findByText('Enter a valid email address.')).toHaveAttribute('role', 'alert')
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(spy).not.toHaveBeenCalled()
  })

  it('shows the server error for bad credentials', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'http_error', message: 'Incorrect email or password.' } }), { status: 401 }),
    )
    setup('login')
    await userEvent.type(screen.getByLabelText('Email'), 'dia@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password')
    await userEvent.click(screen.getByRole('button', { name: /log in/i }))
    expect(await screen.findByText('Incorrect email or password.')).toBeInTheDocument()
  })
})
