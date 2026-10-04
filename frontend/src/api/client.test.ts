import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, request, tokenStore, UNAUTHORIZED_EVENT } from './client'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => {
  vi.restoreAllMocks()
  tokenStore.clear()
})

describe('api client', () => {
  it('sends the bearer token and returns parsed JSON', async () => {
    tokenStore.set('abc')
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { ok: true }))
    await expect(request('/api/health')).resolves.toEqual({ ok: true })
    expect((spy.mock.calls[0][1] as RequestInit).headers).toMatchObject({ Authorization: 'Bearer abc' })
  })

  it('normalises API error bodies', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json(429, { error: { code: 'rate_limited', message: 'Slow down', retry_after: 30 } }),
    )
    const err = await request('/x').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 429, code: 'rate_limited', message: 'Slow down', retryAfter: 30, retryable: false })
  })

  it('reports network failures as retryable errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('failed'))
    const err = await request('/x').catch((e) => e)
    expect(err).toMatchObject({ status: 0, code: 'network_error', retryable: true })
  })

  it('announces rejected sessions so the app can log out', async () => {
    tokenStore.set('expired')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(401, { error: { code: 'http_error', message: 'expired' } }))
    const handler = vi.fn()
    window.addEventListener(UNAUTHORIZED_EVENT, handler)
    await request('/api/user/profile').catch(() => {})
    window.removeEventListener(UNAUTHORIZED_EVENT, handler)
    expect(handler).toHaveBeenCalledOnce()
  })
})
