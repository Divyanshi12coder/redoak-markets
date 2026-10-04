import {
  AreaSeries,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type UTCTimestamp,
} from 'lightweight-charts'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Candle, HistoryResponse, IndicatorsResponse } from '../types/api'
import { fmtCompact, fmtNumber, fmtPct, tone } from '../utils/format'
import { baseChartOptions, C, formatChartTime } from './theme'

export type ChartType = 'candles' | 'line' | 'area'
export type OverlayId = 'sma20' | 'sma50' | 'sma200' | 'ema20' | 'ema50' | 'bollinger' | 'volume' | 'rsi' | 'macd'

interface Props {
  history: HistoryResponse
  indicators?: IndicatorsResponse
  chartType: ChartType
  enabled: ReadonlySet<string>
  height?: number
  dimmed?: boolean
}

const time = (t: number) => t as UTCTimestamp

const LINE_STYLES: Record<string, { color: string; dashed?: boolean }> = {
  sma20: { color: C.sma20 },
  sma50: { color: C.sma50 },
  sma200: { color: C.sma200 },
  ema20: { color: C.ema20, dashed: true },
  ema50: { color: C.ema50, dashed: true },
}

function lineData(times: number[], values: (number | null)[]) {
  const out: { time: UTCTimestamp; value: number }[] = []
  for (let i = 0; i < times.length; i++) {
    const v = values[i]
    if (v != null) out.push({ time: time(times[i]), value: v })
  }
  return out
}

/** Interactive price chart: candles / line / area, indicator overlays, RSI & MACD panes, zoom. */
export function PriceChart({ history, indicators, chartType, enabled, height = 440, dimmed }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<SeriesType>[]>([])
  const lastKey = useRef('')
  const [hover, setHover] = useState<Candle | null>(null)

  const intraday = history.interval !== '1day'
  const candles = history.candles
  const byTime = useMemo(() => new Map(candles.map((c) => [c.t, c])), [candles])
  const last = candles[candles.length - 1]
  const prev = candles[candles.length - 2]
  const shown = hover ?? last
  const shownPrev = hover ? byTime.get(candles[candles.findIndex((c) => c.t === hover.t) - 1]?.t ?? -1) : prev

  // --- create the chart once ------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, baseChartOptions(false))
    chartRef.current = chart
    chart.subscribeCrosshairMove((param) => {
      setHover(param.time ? (lookupRef.current.get(param.time as number) ?? null) : null)
    })
    return () => {
      chart.remove()
      chartRef.current = null
      seriesRef.current = []
    }
  }, [])

  // keep a ref so the (once-registered) crosshair callback sees fresh data
  const lookupRef = useRef(byTime)
  lookupRef.current = byTime

  // --- sync data & options ----------------------------------------------------
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    // reset series and extra panes
    seriesRef.current.forEach((s) => {
      try {
        chart.removeSeries(s)
      } catch {
        /* already removed with its pane */
      }
    })
    seriesRef.current = []
    for (let i = chart.panes().length - 1; i > 0; i--) chart.removePane(i)

    chart.applyOptions(baseChartOptions(intraday))
    const track = <T extends SeriesType>(s: ISeriesApi<T>) => {
      seriesRef.current.push(s as unknown as ISeriesApi<SeriesType>)
      return s
    }

    // main series
    const valid = candles.filter((c) => c.o != null && c.h != null && c.l != null && c.c != null)
    if (chartType === 'candles') {
      const s = track(
        chart.addSeries(CandlestickSeries, {
          upColor: C.up, downColor: C.down, borderUpColor: C.up, borderDownColor: C.down,
          wickUpColor: C.up, wickDownColor: C.down, priceLineVisible: true,
        }),
      )
      s.setData(valid.map((c) => ({ time: time(c.t), open: c.o!, high: c.h!, low: c.l!, close: c.c! })))
    } else if (chartType === 'line') {
      const s = track(chart.addSeries(LineSeries, { color: C.up, lineWidth: 2, priceLineVisible: true }))
      s.setData(valid.map((c) => ({ time: time(c.t), value: c.c! })))
    } else {
      const up = (valid.at(-1)?.c ?? 0) >= (valid[0]?.c ?? 0)
      const s = track(
        chart.addSeries(AreaSeries, {
          lineColor: up ? C.up : C.down,
          topColor: up ? 'rgba(29, 93, 63, 0.30)' : 'rgba(154, 38, 57, 0.28)',
          bottomColor: 'rgba(255, 255, 255, 0)',
          lineWidth: 2,
        }),
      )
      s.setData(valid.map((c) => ({ time: time(c.t), value: c.c! })))
    }

    // volume
    if (enabled.has('volume')) {
      const v = track(
        chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'volume', lastValueVisible: false, priceLineVisible: false }),
      )
      v.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })
      v.setData(valid.map((c, i) => ({
        time: time(c.t), value: c.v,
        color: (c.c ?? 0) >= (valid[i - 1]?.c ?? c.o ?? 0) ? C.upSoft : C.downSoft,
      })))
    }

    // indicator overlays (daily bars only)
    if (indicators && !intraday) {
      const t = indicators.t
      const s = indicators.series
      ;(['sma20', 'sma50', 'sma200', 'ema20', 'ema50'] as const).forEach((key) => {
        if (!enabled.has(key)) return
        const style = LINE_STYLES[key]
        const line = track(
          chart.addSeries(LineSeries, {
            color: style.color, lineWidth: 2, lineStyle: style.dashed ? LineStyle.Dashed : LineStyle.Solid,
            priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, title: key.toUpperCase(),
          }),
        )
        line.setData(lineData(t, s[key]))
      })

      if (enabled.has('bollinger')) {
        ;(['bb_upper', 'bb_mid', 'bb_lower'] as const).forEach((key) => {
          const line = track(
            chart.addSeries(LineSeries, {
              color: C.band, lineWidth: 1, lineStyle: key === 'bb_mid' ? LineStyle.Dotted : LineStyle.Solid,
              priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
            }),
          )
          line.setData(lineData(t, s[key]))
        })
      }

      let pane = 1
      if (enabled.has('rsi')) {
        const rsi = track(
          chart.addSeries(
            LineSeries,
            {
              color: C.rsi, lineWidth: 2, priceLineVisible: false, title: 'RSI 14',
              autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }),
            },
            pane,
          ),
        )
        rsi.setData(lineData(t, s.rsi14))
        rsi.createPriceLine({ price: 70, color: C.ema50, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: '70' })
        rsi.createPriceLine({ price: 30, color: C.ema20, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: '30' })
        pane++
      }
      if (enabled.has('macd')) {
        const hist = track(chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false, title: 'Hist' }, pane))
        hist.setData(
          t.flatMap((tt, i) => {
            const v = s.macd_hist[i]
            return v == null ? [] : [{ time: time(tt), value: v, color: v >= 0 ? C.upSoft : C.downSoft }]
          }),
        )
        const macdLine = track(chart.addSeries(LineSeries, { color: C.sma20, lineWidth: 2, priceLineVisible: false, lastValueVisible: false, title: 'MACD' }, pane))
        macdLine.setData(lineData(t, s.macd as (number | null)[]))
        const sig = track(chart.addSeries(LineSeries, { color: C.sma50, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, title: 'Signal' }, pane))
        sig.setData(lineData(t, s.macd_signal as (number | null)[]))
        pane++
      }
      const panes = chart.panes()
      if (panes.length > 1) {
        panes[0].setStretchFactor(3)
        for (let i = 1; i < panes.length; i++) panes[i].setStretchFactor(1)
      }
    }

    // Reset the view only when the data set changes (ticker / range), not when toggling indicators.
    const key = `${history.ticker}:${history.range}:${chartType === 'candles' ? 'c' : 'l'}`
    if (key !== lastKey.current) {
      chart.timeScale().fitContent()
      lastKey.current = key
    }
  }, [candles, indicators, chartType, enabled, intraday, history.ticker, history.range])

  function zoom(factor: number) {
    const ts = chartRef.current?.timeScale()
    const r = ts?.getVisibleLogicalRange()
    if (!ts || !r) return
    const mid = (r.from + r.to) / 2
    const half = ((r.to - r.from) / 2) * factor
    ts.setVisibleLogicalRange({ from: mid - half, to: mid + half })
  }

  const chg = shown && shownPrev && shownPrev.c ? ((shown.c ?? 0) / shownPrev.c - 1) * 100 : null
  const t = tone(chg)

  return (
    <div className="relative">
      {/* legend / tooltip */}
      <div className="pointer-events-none absolute left-3 top-2 z-10 max-w-[calc(100%-7rem)] rounded-lg bg-white/90 px-2.5 py-1.5 text-xs shadow-card backdrop-blur">
        {shown ? (
          <p className="tabular flex flex-wrap items-center gap-x-3 gap-y-0.5 text-muted">
            <span className="font-semibold text-ink">{formatChartTime(shown.t, intraday)}</span>
            {chartType === 'candles' ? (
              <>
                <span>O <b className="text-ink">{fmtNumber(shown.o)}</b></span>
                <span>H <b className="text-ink">{fmtNumber(shown.h)}</b></span>
                <span>L <b className="text-ink">{fmtNumber(shown.l)}</b></span>
              </>
            ) : null}
            <span>C <b className="text-ink">{fmtNumber(shown.c)}</b></span>
            <span>Vol <b className="text-ink">{fmtCompact(shown.v)}</b></span>
            {chg != null && <b className={t === 'up' ? 'text-up' : t === 'down' ? 'text-down' : 'text-muted'}>{fmtPct(chg)}</b>}
          </p>
        ) : null}
      </div>

      {/* zoom controls (keyboard / touch friendly alternative to the mouse wheel) */}
      <div className="absolute right-3 top-2 z-10 flex gap-1 rounded-lg bg-white/90 p-1 shadow-card backdrop-blur" role="group" aria-label="Chart zoom">
        <button type="button" className="btn btn-ghost !min-h-8 !min-w-8 !rounded-md !px-2 text-base" aria-label="Zoom in" onClick={() => zoom(0.6)}>
          <span aria-hidden="true">+</span>
        </button>
        <button type="button" className="btn btn-ghost !min-h-8 !min-w-8 !rounded-md !px-2 text-base" aria-label="Zoom out" onClick={() => zoom(1.6)}>
          <span aria-hidden="true">−</span>
        </button>
        <button type="button" className="btn btn-ghost !min-h-8 !rounded-md !px-2 text-xs" onClick={() => chartRef.current?.timeScale().fitContent()}>
          Reset
        </button>
      </div>

      <div
        ref={containerRef}
        style={{ height }}
        className={`w-full transition-opacity duration-300 ${dimmed ? 'opacity-60' : 'opacity-100'}`}
        role="img"
        aria-label={`Interactive ${chartType} price chart for ${history.ticker}, range ${history.range}. ${candles.length} data points.`}
      />
    </div>
  )
}
