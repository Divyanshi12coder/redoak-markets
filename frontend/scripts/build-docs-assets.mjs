/**
 * Generates README artwork: docs/assets/logo.svg, hero-banner.(svg|png), architecture.(svg|png).
 *   node scripts/build-docs-assets.mjs
 * PNGs are rendered with playwright-core using an installed Chromium-based browser (default: msedge).
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const here = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(here, '../../docs/assets')
const SERIF = "Georgia, 'Times New Roman', serif"
const SANS = "'Segoe UI', Inter, Helvetica, Arial, sans-serif"

const mark = (x, y, s) => `
<g transform="translate(${x} ${y}) scale(${s / 64})">
  <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f8a5a"/><stop offset="1" stop-color="#14452d"/></linearGradient></defs>
  <rect width="64" height="64" rx="15" fill="#0a1f15"/>
  <g fill="url(#cg)"><circle cx="32" cy="23" r="13.5"/><circle cx="21.5" cy="31" r="9.5"/><circle cx="42.5" cy="31" r="9.5"/></g>
  <path d="M28.6 53 30.4 37h3.2l1.8 16z" fill="#a82a3b"/><path d="M25 53h14" stroke="#a82a3b" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M16.5 35 24.5 28.5 30 32 38 21 46.5 15.5" fill="none" stroke="#f7f5f0" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="46.5" cy="15.5" r="3" fill="#d8566a" stroke="#0a1f15" stroke-width="1.2"/>
</g>`

// ---------------------------------------------------------------- logo ------
const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 80" width="360" height="80" role="img" aria-label="RedOak Markets">
${mark(8, 8, 64)}
<text x="88" y="44" font-family="${SERIF}" font-size="34" font-weight="700" fill="#0a2519">RedOak</text>
<text x="90" y="64" font-family="${SANS}" font-size="12" font-weight="600" letter-spacing="6" fill="#9a2639">MARKETS</text>
</svg>`

// -------------------------------------------------------------- banner ------
function candles() {
  let seed = 11
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
  let p = 250
  const out = []
  for (let i = 0; i < 34; i++) {
    const drift = i < 12 ? -3 : i < 19 ? 1 : 6
    const open = p
    const close = p + drift + (rnd() - 0.5) * 22
    out.push({ open, close, high: Math.max(open, close) + rnd() * 12, low: Math.min(open, close) - rnd() * 12 })
    p = close
  }
  return out
}
function banner() {
  const W = 1600, H = 520
  const cs = candles()
  const min = Math.min(...cs.map((c) => c.low)), max = Math.max(...cs.map((c) => c.high))
  const x0 = 860, x1 = 1540, y0 = 70, y1 = 440
  const x = (i) => x0 + ((i + 0.5) / cs.length) * (x1 - x0)
  const y = (v) => y0 + (1 - (v - min) / (max - min)) * (y1 - y0)
  const w = ((x1 - x0) / cs.length) * 0.58
  const body = cs.map((c, i) => {
    const col = c.close >= c.open ? '#4f956f' : '#cb5a6b'
    return `<line x1="${x(i)}" x2="${x(i)}" y1="${y(c.high)}" y2="${y(c.low)}" stroke="${col}" stroke-width="2"/>
<rect x="${x(i) - w / 2}" y="${Math.min(y(c.open), y(c.close))}" width="${w}" height="${Math.max(3, Math.abs(y(c.open) - y(c.close)))}" rx="2" fill="${col}"/>`
  }).join('\n')
  const ma = cs.map((_, i) => { const s = cs.slice(Math.max(0, i - 4), i + 1); return s.reduce((a, c) => a + c.close, 0) / s.length })
  const path = ma.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const vols = cs.map((c, i) => `<rect x="${x(i) - w / 2}" y="${H - 44 - (14 + ((i * 37) % 26))}" width="${w}" height="${14 + ((i * 37) % 26)}" rx="2" fill="${c.close >= c.open ? '#2b7550' : '#9a2639'}" opacity=".55"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="RedOak Markets - See the market. Understand the trend.">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#06150e"/><stop offset="0.6" stop-color="#0a2519"/><stop offset="1" stop-color="#10301f"/></linearGradient>
  <radialGradient id="redglow" cx="0" cy="1" r="0.8"><stop offset="0" stop-color="#5f1623" stop-opacity=".85"/><stop offset="1" stop-color="#5f1623" stop-opacity="0"/></radialGradient>
  <linearGradient id="ma" x1="0" x2="1"><stop offset="0" stop-color="#dd8b97"/><stop offset=".5" stop-color="#f7f5f0"/><stop offset="1" stop-color="#86b79c"/></linearGradient>
  <filter id="blur"><feGaussianBlur stdDeviation="5"/></filter>
  <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#fff" stroke-opacity=".05"/></pattern>
</defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/><rect width="${W}" height="${H}" fill="url(#grid)"/><rect width="${W}" height="${H}" fill="url(#redglow)"/>
<rect x="820" y="40" width="740" height="440" rx="26" fill="#0a2519" fill-opacity=".6" stroke="#fff" stroke-opacity=".1"/>
${vols}${body}
<path d="${path}" fill="none" stroke="url(#ma)" stroke-width="8" opacity=".45" filter="url(#blur)"/>
<path d="${path}" fill="none" stroke="url(#ma)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
${mark(80, 96, 84)}
<text x="186" y="150" font-family="${SERIF}" font-size="64" font-weight="700" fill="#fff">RedOak</text>
<text x="190" y="184" font-family="${SANS}" font-size="20" font-weight="600" letter-spacing="11" fill="#86b79c">MARKETS</text>
<text x="80" y="290" font-family="${SERIF}" font-size="40" fill="#f7f5f0">See the market. Understand the trend.</text>
<text x="80" y="338" font-family="${SANS}" font-size="21" fill="#b6d5c3">Market data · Technical indicators · Walk-forward-validated ML · Dia, an analyst</text>
<text x="80" y="368" font-family="${SANS}" font-size="21" fill="#b6d5c3">that explains the numbers and never predicts prices.</text>
${['FastAPI', 'React + TypeScript', 'pandas · scikit-learn', 'PostgreSQL'].map((t, i) => {
  const xs = [80, 196, 408, 614][i], ws = [104, 200, 194, 118][i]
  return `<rect x="${xs}" y="404" width="${ws}" height="34" rx="17" fill="#fff" fill-opacity=".08" stroke="#fff" stroke-opacity=".18"/><text x="${xs + ws / 2}" y="426" text-anchor="middle" font-family="${SANS}" font-size="15" font-weight="600" fill="#f7f5f0">${t}</text>`
}).join('')}
<text x="80" y="486" font-family="${SANS}" font-size="14" fill="#86b79c">Educational and analytical information only - not financial advice.</text>
</svg>`
}

// -------------------------------------------------------- architecture ------
function architecture() {
  const W = 1760, H = 900
  const box = (x, y, w, h, title, lines, fill = '#0a2519', accent = '#4f956f') => `
<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${fill}" stroke="${accent}" stroke-width="2"/>
<text x="${x + w / 2}" y="${y + 38}" text-anchor="middle" font-family="${SERIF}" font-size="24" font-weight="700" fill="#fff">${title}</text>
${lines.map((l, i) => `<text x="${x + w / 2}" y="${y + 70 + i * 24}" text-anchor="middle" font-family="${SANS}" font-size="16" fill="#b6d5c3">${l}</text>`).join('')}`
  const arrow = (x1, y1, x2, y2, label, col = '#86b79c', dash = '') => `
<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="3" ${dash ? `stroke-dasharray="${dash}"` : ''} marker-end="url(#ah-${col.slice(1)})"/>
${label ? `<text x="${(x1 + x2) / 2 + 10}" y="${(y1 + y2) / 2 - 8}" font-family="${SANS}" font-size="15" fill="${col}" stroke="#06150e" stroke-width="6" paint-order="stroke">${label}</text>` : ''}`
  const head = (c) => `<marker id="ah-${c}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#${c}"/></marker>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="RedOak Markets system architecture">
<defs>${head('86b79c')}${head('dd8b97')}<pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#fff" stroke-opacity=".04"/></pattern></defs>
<rect width="${W}" height="${H}" fill="#06150e"/><rect width="${W}" height="${H}" fill="url(#g)"/>
<text x="60" y="70" font-family="${SERIF}" font-size="36" font-weight="700" fill="#fff">RedOak Markets - system architecture</text>
<text x="60" y="102" font-family="${SANS}" font-size="17" fill="#86b79c">Request flow (green) and authentication / watchlist persistence (red)</text>

${box(60, 170, 300, 130, 'User', ['Browser · desktop / tablet / mobile'])}
${box(480, 170, 360, 150, 'React frontend', ['Vite · TypeScript · Tailwind', 'TanStack Query cache', 'Lightweight Charts · Framer Motion'])}
${box(960, 170, 360, 150, 'FastAPI backend', ['REST + OpenAPI (/api/docs)', 'JWT auth · input validation', 'CORS · rate limits'], '#0f3724', '#86b79c')}
${arrow(360, 235, 480, 235, '')}
${arrow(840, 235, 960, 235, 'HTTPS / JSON')}

${box(60, 470, 420, 150, 'Market data provider', ['Twelve Data (quotes, history, search)', 'or labelled synthetic demo provider', 'cache + retry + credit limiter'])}
${box(560, 470, 440, 220, 'Analytics & ML', ['pandas · NumPy · scikit-learn', 'Indicators: SMA · EMA · RSI · MACD · BB · ATR', 'Leak-free features → Random Forest', 'Walk-forward evaluation vs baseline', 'Isolation Forest · feature importance'])}
${box(1100, 470, 400, 150, 'Dia analyst', ['Template summary from calculated facts', 'Optional LLM rewrite (validated)', 'Never predicts prices'], '#430f19', '#dd8b97')}
${arrow(1000, 320, 300, 470, 'fetch OHLCV', '#86b79c')}
${arrow(1060, 320, 780, 470, 'DataFrame', '#86b79c')}
${arrow(1000, 565, 1100, 565, 'facts')}
${arrow(1300, 470, 1260, 322, 'summary', '#86b79c', '8 6')}

${box(1420, 170, 300, 170, 'PostgreSQL', ['SQLAlchemy · Alembic', 'users · user_preferences', 'watchlists · watchlist_stocks', 'analysis_history · ml_analysis'], '#430f19', '#dd8b97')}
${arrow(1320, 255, 1420, 255, 'ORM', '#dd8b97')}
${box(560, 730, 500, 110, 'Model artifacts (joblib, git-ignored)', ['Per-ticker random forest, versioned', 'Reused while latest bar + signature match'], '#0a2519', '#4f956f')}
${arrow(780, 690, 780, 730, 'load / persist')}
<text x="60" y="${H - 24}" font-family="${SANS}" font-size="15" fill="#86b79c">Educational and analytical information only - not financial advice.</text>
</svg>`
}

await mkdir(OUT, { recursive: true })
const files = { 'logo.svg': logo, 'hero-banner.svg': banner(), 'architecture.svg': architecture() }
for (const [name, svg] of Object.entries(files)) await writeFile(path.join(OUT, name), svg, 'utf8')

const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER ?? 'msedge' })
try {
  for (const [svgName, png, w, h] of [['hero-banner.svg', 'hero-banner.png', 1600, 520], ['architecture.svg', 'architecture.png', 1760, 900]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
    await page.setContent(`<body style="margin:0">${files[svgName]}</body>`)
    await page.screenshot({ path: path.join(OUT, png), clip: { x: 0, y: 0, width: w, height: h } })
    await page.close()
    console.log('wrote', png)
  }
} finally {
  await browser.close()
}
