import { motion, useReducedMotion } from 'framer-motion'

// Deterministic pseudo-random walk so the illustration is identical on every render.
function buildCandles(count: number) {
  let seed = 11
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
  let price = 250
  return Array.from({ length: count }, (_, i) => {
    const drift = i < 9 ? -3 : i < 14 ? 1 : 6 // a dip, a base, then a recovery
    const open = price
    const close = price + drift + (rnd() - 0.5) * 22
    const high = Math.max(open, close) + rnd() * 12
    const low = Math.min(open, close) - rnd() * 12
    price = close
    return { open, close, high, low, volume: 14 + rnd() * 26 + Math.abs(close - open) * 0.5 }
  })
}

const CANDLES = buildCandles(26)
const W = 560
const H = 400
const PAD = { l: 18, r: 18, t: 24, b: 78 }

const lows = CANDLES.map((c) => c.low)
const highs = CANDLES.map((c) => c.high)
const minP = Math.min(...lows)
const maxP = Math.max(...highs)
const x = (i: number) => PAD.l + ((i + 0.5) / CANDLES.length) * (W - PAD.l - PAD.r)
const y = (p: number) => PAD.t + (1 - (p - minP) / (maxP - minP)) * (H - PAD.t - PAD.b)
const step = (W - PAD.l - PAD.r) / CANDLES.length

// Moving-average style line over the closes
const MA = CANDLES.map((_, i) => {
  const from = Math.max(0, i - 4)
  const slice = CANDLES.slice(from, i + 1)
  return slice.reduce((a, c) => a + c.close, 0) / slice.length
})
const maPath = MA.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p).toFixed(1)}`).join(' ')

export function HeroVisual() {
  const reduce = useReducedMotion()
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-[radial-gradient(60%_60%_at_60%_40%,rgba(43,117,80,0.35),transparent)]" aria-hidden="true" />
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded-3xl border border-white/10 bg-oak-900/70 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] backdrop-blur"
        role="img"
        aria-label="Illustration of a candlestick price chart with a moving average line and volume bars"
      >
        <defs>
          <linearGradient id="hv-glow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#dd8b97" />
            <stop offset="0.45" stopColor="#f7f5f0" />
            <stop offset="1" stopColor="#86b79c" />
          </linearGradient>
          <filter id="hv-blur" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        {/* grid */}
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={`h${i}`} x1={PAD.l} x2={W - PAD.r} y1={PAD.t + (i * (H - PAD.t - PAD.b)) / 4} y2={PAD.t + (i * (H - PAD.t - PAD.b)) / 4} stroke="white" strokeOpacity="0.06" />
        ))}
        {Array.from({ length: 7 }).map((_, i) => (
          <line key={`v${i}`} y1={PAD.t} y2={H - PAD.b + 40} x1={PAD.l + (i * (W - PAD.l - PAD.r)) / 6} x2={PAD.l + (i * (W - PAD.l - PAD.r)) / 6} stroke="white" strokeOpacity="0.04" />
        ))}

        {/* volume */}
        {CANDLES.map((c, i) => {
          const up = c.close >= c.open
          const h = c.volume * 1.15
          return (
            <motion.rect
              key={`vol${i}`}
              x={x(i) - step * 0.32}
              width={step * 0.64}
              y={H - 22 - h}
              height={h}
              rx={1.5}
              fill={up ? '#2b7550' : '#9a2639'}
              fillOpacity={0.55}
              initial={reduce ? false : { scaleY: 0, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              style={{ transformBox: 'fill-box', transformOrigin: 'bottom' }}
              transition={{ delay: 0.5 + i * 0.03, duration: 0.5, ease: 'easeOut' }}
            />
          )
        })}

        {/* candles */}
        {CANDLES.map((c, i) => {
          const up = c.close >= c.open
          const colour = up ? '#4f956f' : '#cb5a6b'
          return (
            <motion.g
              key={i}
              initial={reduce ? false : { opacity: 0, scaleY: 0.3 }}
              animate={{ opacity: 1, scaleY: 1 }}
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
              transition={{ delay: 0.15 + i * 0.045, duration: 0.45, ease: 'easeOut' }}
            >
              <line x1={x(i)} x2={x(i)} y1={y(c.high)} y2={y(c.low)} stroke={colour} strokeWidth={1.6} strokeLinecap="round" />
              <rect
                x={x(i) - step * 0.3}
                width={step * 0.6}
                y={Math.min(y(c.open), y(c.close))}
                height={Math.max(3, Math.abs(y(c.open) - y(c.close)))}
                rx={2}
                fill={colour}
              />
            </motion.g>
          )
        })}

        {/* moving-average line with soft glow */}
        <motion.path
          d={maPath}
          fill="none"
          stroke="url(#hv-glow)"
          strokeWidth={6}
          strokeOpacity={0.45}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#hv-blur)"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.9, duration: 2.2, ease: 'easeInOut' }}
        />
        <motion.path
          d={maPath}
          fill="none"
          stroke="url(#hv-glow)"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.9, duration: 2.2, ease: 'easeInOut' }}
        />
      </svg>

      <div className="pointer-events-none absolute -left-3 top-10 hidden animate-float rounded-xl border border-white/15 bg-oak-950/80 px-3 py-2 text-xs text-oak-100 backdrop-blur sm:block" aria-hidden="true">
        <span className="mr-1.5 inline-block size-2 rounded-full bg-oak-300" />SMA 50
      </div>
      <div className="pointer-events-none absolute -right-2 top-1/3 hidden animate-float rounded-xl border border-white/15 bg-oak-950/80 px-3 py-2 text-xs text-oak-100 backdrop-blur [animation-delay:1.5s] sm:block" aria-hidden="true">
        <span className="mr-1.5 inline-block size-2 rounded-full bg-wine-300" />RSI 14
      </div>
      <div className="pointer-events-none absolute -top-4 right-12 hidden animate-float rounded-xl border border-white/15 bg-oak-950/80 px-3 py-2 text-xs text-oak-100 backdrop-blur [animation-delay:3s] sm:block" aria-hidden="true">
        Regime · Volume · Anomalies
      </div>
      <p className="mt-4 text-center text-[11px] text-oak-300/80">Illustration only - not live data</p>
    </div>
  )
}
