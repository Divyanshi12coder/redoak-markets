import { ColorType, CrosshairMode, type ChartOptions, type DeepPartial } from 'lightweight-charts'

// Chart colours come from the RedOak palette (see index.css).
export const C = {
  up: '#1d5d3f',
  down: '#9a2639',
  upSoft: 'rgba(29, 93, 63, 0.35)',
  downSoft: 'rgba(154, 38, 57, 0.35)',
  ink: '#0d1a13',
  muted: '#55665b',
  grid: '#ecebe5',
  border: '#d9d7cf',
  sma20: '#2b7550',
  sma50: '#b53a4d',
  sma200: '#0d1a13',
  ema20: '#4f956f',
  ema50: '#cb5a6b',
  band: '#86b79c',
  rsi: '#164a32',
}

export const COMPARE_COLORS = ['#1d5d3f', '#9a2639', '#0d1a13', '#86b79c'] as const

export const FONT = '"Inter Variable", ui-sans-serif, system-ui, sans-serif'

const ET = 'America/New_York'
const timeFmt = new Intl.DateTimeFormat('en-US', { timeZone: ET, hour: 'numeric', minute: '2-digit' })
const dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: ET, month: 'short', day: 'numeric' })
const fullFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' })
const fullIntraFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: ET, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
})

export function formatChartTime(t: number, intraday: boolean): string {
  const d = new Date(t * 1000)
  return intraday ? `${fullIntraFmt.format(d)} ET` : fullFmt.format(d)
}

export function baseChartOptions(intraday: boolean): DeepPartial<ChartOptions> {
  return {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: '#ffffff' },
      textColor: C.muted,
      fontFamily: FONT,
      fontSize: 12,
      panes: { separatorColor: C.border, enableResize: true },
    },
    grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
    rightPriceScale: { borderVisible: false },
    timeScale: {
      borderVisible: false,
      timeVisible: intraday,
      secondsVisible: false,
      rightOffset: 4,
      tickMarkFormatter: (time: number) => (intraday ? timeFmt.format(new Date(time * 1000)) : dayFmt.format(new Date(time * 1000))),
    },
    crosshair: { mode: CrosshairMode.Normal },
    localization: { timeFormatter: (time: number) => formatChartTime(time, intraday) },
    handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
    kineticScroll: { touch: true, mouse: false },
  }
}
