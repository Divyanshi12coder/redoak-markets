/**
 * Captures README screenshots from the running application.
 *
 *   1. start the API (demo provider is fine) and the frontend
 *   2. node scripts/screenshots.mjs
 *
 * Environment:
 *   APP_URL   frontend URL                 (default http://localhost:5173)
 *   API_URL   backend URL, used for login  (default http://localhost:8000)
 *   OUT_DIR   output directory             (default ../docs/assets)
 *   BROWSER   chromium executable path or channel (default: msedge channel)
 *
 * Uses playwright-core with an already-installed Chromium-based browser (no download).
 */
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const here = path.dirname(fileURLToPath(import.meta.url))
const APP = process.env.APP_URL ?? 'http://localhost:5173'
const API = process.env.API_URL ?? 'http://localhost:8000'
const OUT = process.env.OUT_DIR ?? path.resolve(here, '../../docs/assets')
const EMAIL = 'dia@redoak.dev'
const PASSWORD = 'DiaDemo2025!'

async function api(pathname, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${API}${pathname}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok && res.status !== 409) throw new Error(`${method} ${pathname} -> ${res.status} ${await res.text()}`)
  return res.status === 204 ? null : res.json().catch(() => null)
}

async function loginDemoUser() {
  let session
  try {
    session = await api('/api/auth/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD } })
  } catch {
    session = await api('/api/auth/register', { method: 'POST', body: { name: 'Dia', email: EMAIL, password: PASSWORD } })
  }
  const token = session.access_token
  for (const t of ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN']) {
    await api('/api/watchlist', { method: 'POST', body: { ticker: t }, token }).catch(() => {})
  }
  for (const t of ['NVDA', 'AAPL', 'MSFT']) {
    await api(`/api/stocks/${t}/analysis`, { token })
    await api(`/api/stocks/${t}/ml-analysis`, { token })
  }
  return token
}

async function settle(page, ms = 1800) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(ms)
  // scroll through the page so scroll-reveal sections and lazy cards are rendered
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 120))
    }
    window.scrollTo(0, 0)
  })
  await page.waitForTimeout(900)
}

const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER?.includes(path.sep) || process.env.BROWSER?.includes('/')
    ? { executablePath: process.env.BROWSER }
    : { channel: process.env.BROWSER ?? 'msedge' }),
})

try {
  await mkdir(OUT, { recursive: true })
  const token = await loginDemoUser()

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  await context.addInitScript((t) => localStorage.setItem('redoak.token', t), token)
  const page = await context.newPage()
  page.on('pageerror', (e) => console.error('page error:', e.message))

  const shots = [
    { file: 'home.png', url: '/', wait: 3200, full: false },
    { file: 'markets.png', url: '/markets', wait: 2500, full: true },
    { file: 'dashboard.png', url: '/dashboard', wait: 2500, full: true },
    { file: 'analyzer.png', url: '/analyze/NVDA', wait: 6000, full: true },
    { file: 'comparison.png', url: '/compare?t=AAPL,MSFT,NVDA&range=1Y', wait: 3500, full: true },
    { file: 'watchlist.png', url: '/watchlist', wait: 2500, full: true },
  ]
  for (const s of shots) {
    await page.goto(`${APP}${s.url}`)
    await settle(page, s.wait)
    await page.screenshot({ path: path.join(OUT, s.file), fullPage: s.full })
    console.log('saved', s.file)
  }

  // mobile views
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await mobile.addInitScript((t) => localStorage.setItem('redoak.token', t), token)
  const mp = await mobile.newPage()
  for (const s of [
    { file: 'mobile-home.png', url: '/', wait: 3000 },
    { file: 'mobile-analyzer.png', url: '/analyze/AAPL', wait: 5000 },
  ]) {
    await mp.goto(`${APP}${s.url}`)
    await settle(mp, s.wait)
    const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    console.log(s.file, 'horizontal overflow px:', overflow)
    await mp.screenshot({ path: path.join(OUT, s.file), fullPage: false })
  }
} finally {
  await browser.close()
}
