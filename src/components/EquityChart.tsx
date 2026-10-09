import { useEffect, useRef } from 'react'
import { AreaSeries, ColorType, createChart, type IChartApi, type ISeriesApi, type Time, type UTCTimestamp } from 'lightweight-charts'
import type { EquityPoint } from '../broker/types'
import { fmtTime } from '../lib/format'

export function EquityChart({ points, up }: { points: EquityPoint[]; up: boolean }) {
  const host = useRef<HTMLDivElement>(null)
  const chart = useRef<IChartApi | null>(null)
  const series = useRef<ISeriesApi<'Area'> | null>(null)

  useEffect(() => {
    const c = createChart(host.current!, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#7d8699', fontSize: 11, attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { color: 'rgba(42,49,61,0.4)' } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true },
      localization: { timeFormatter: (t: Time) => fmtTime(t as number) },
      handleScroll: false,
      handleScale: false,
    })
    series.current = c.addSeries(AreaSeries, { lineWidth: 2, priceLineVisible: false })
    chart.current = c
    return () => c.remove()
  }, [])

  useEffect(() => {
    const color = up ? '#0ecb81' : '#f6465d'
    series.current?.applyOptions({ lineColor: color, topColor: up ? 'rgba(14,203,129,0.28)' : 'rgba(246,70,93,0.28)', bottomColor: 'rgba(0,0,0,0)' })
    // dedupe + sort, the chart needs strictly increasing times
    const m = new Map<number, number>()
    for (const p of points) m.set(p.time, p.equity)
    const data = [...m.entries()].sort((a, b) => a[0] - b[0]).map(([t, v]) => ({ time: t as UTCTimestamp, value: v }))
    series.current?.setData(data)
    chart.current?.timeScale().fitContent()
  }, [points, up])

  return <div ref={host} className="equity-chart" />
}
