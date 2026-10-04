import { LineSeries, LineStyle, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts'
import { useEffect, useRef, useState } from 'react'
import type { CompareResponse } from '../types/api'
import { fmtNumber } from '../utils/format'
import { baseChartOptions, COMPARE_COLORS, formatChartTime } from './theme'

/** Multi-line performance chart, every series rebased to 100 at the first shared date. */
export function CompareChart({ data, height = 380 }: { data: CompareResponse; height?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map())
  const timesRef = useRef<number[]>([])
  const [hover, setHover] = useState<{ t: number; values: Record<string, number> } | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const chart = createChart(ref.current, baseChartOptions(false))
    chartRef.current = chart
    chart.subscribeCrosshairMove((param) => {
      if (!param.time) return setHover(null)
      const values: Record<string, number> = {}
      seriesRef.current.forEach((s, ticker) => {
        const d = param.seriesData.get(s) as { value?: number } | undefined
        if (d?.value != null) values[ticker] = d.value
      })
      setHover({ t: param.time as number, values })
    })
    return () => {
      chart.remove()
      chartRef.current = null
      seriesRef.current.clear()
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    seriesRef.current.forEach((s) => chart.removeSeries(s))
    seriesRef.current.clear()
    timesRef.current = data.t
    data.tickers.forEach((ticker, i) => {
      const s = chart.addSeries(LineSeries, {
        color: COMPARE_COLORS[i % COMPARE_COLORS.length],
        lineWidth: 2,
        lineStyle: i === 3 ? LineStyle.Dashed : LineStyle.Solid,
        priceLineVisible: false,
        title: ticker,
        priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(1) },
      })
      s.setData(
        data.t.flatMap((t, idx) => {
          const v = data.performance[ticker][idx]
          return v == null ? [] : [{ time: t as UTCTimestamp, value: v }]
        }),
      )
      seriesRef.current.set(ticker, s)
    })
    chart.timeScale().fitContent()
  }, [data])

  const lastIdx = data.t.length - 1
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm" aria-live="off">
        {data.tickers.map((t, i) => {
          const value = hover?.values[t] ?? data.performance[t][lastIdx]
          return (
            <span key={t} className="tabular inline-flex items-center gap-2">
              <span className="inline-block h-0.5 w-5 rounded" style={{ background: COMPARE_COLORS[i % COMPARE_COLORS.length] }} aria-hidden="true" />
              <b>{t}</b>
              <span className="text-muted">{fmtNumber(value, 1)}</span>
            </span>
          )
        })}
        <span className="ml-auto text-xs text-muted">{hover ? formatChartTime(hover.t, false) : 'Rebased to 100 at start'}</span>
      </div>
      <div
        ref={ref}
        style={{ height }}
        className="w-full"
        role="img"
        aria-label={`Relative performance of ${data.tickers.join(', ')} over ${data.range}, rebased to 100.`}
      />
    </div>
  )
}
