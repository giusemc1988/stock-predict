import { useEffect, useRef, useState } from 'react'
import { AreaSeries, ColorType, createChart, type IChartApi, type ISeriesApi, type Time, type UTCTimestamp } from 'lightweight-charts'
import type { EquityPoint } from '../broker/types'
import { useAiRules } from '../lib/aiRules'
import { fmtTime, fmtUsd } from '../lib/format'

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * `replay` changes (e.g. the 1D/1M/3M period) draw the line again. With Dashboard cards and motion on,
 * the line draws itself left to right, the fill fades in, and a dark bubble follows the cursor.
 */
export function EquityChart({ points, up, replay = '' }: { points: EquityPoint[]; up: boolean; replay?: string }) {
  const host = useRef<HTMLDivElement>(null)
  const chart = useRef<IChartApi | null>(null)
  const series = useRef<ISeriesApi<'Area'> | null>(null)
  const dash = useAiRules().dashMotion
  const draw = useRef(true)
  const [tip, setTip] = useState<{ x: number; y: number; value: number; time: number } | null>(null)

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
    const s = c.addSeries(AreaSeries, { lineWidth: 2, priceLineVisible: false })
    series.current = s
    chart.current = c
    return () => c.remove()
  }, [])

  // the bubble: only with Dashboard cards and motion
  useEffect(() => {
    const c = chart.current
    if (!c || !dash) return
    const move = (p: Parameters<Parameters<IChartApi['subscribeCrosshairMove']>[0]>[0]) => {
      const d = p.point && p.time != null ? (p.seriesData.get(series.current!) as { value?: number } | undefined) : undefined
      setTip(d?.value != null && p.point ? { x: p.point.x, y: p.point.y, value: d.value, time: p.time as number } : null)
    }
    c.subscribeCrosshairMove(move)
    return () => {
      c.unsubscribeCrosshairMove(move)
      setTip(null)
    }
  }, [dash])

  useEffect(() => {
    draw.current = true
  }, [replay])

  useEffect(() => {
    const s = series.current
    const c = chart.current
    if (!s || !c) return
    const top = up ? [14, 203, 129] : [246, 70, 93]
    const fill = (a: number) => `rgba(${top.join(',')},${(0.28 * a).toFixed(3)})`
    s.applyOptions({ lineColor: up ? '#0ecb81' : '#f6465d', topColor: fill(1), bottomColor: 'rgba(0,0,0,0)' })
    // dedupe + sort, the chart needs strictly increasing times
    const m = new Map<number, number>()
    for (const p of points) m.set(p.time, p.equity)
    const data = [...m.entries()].sort((a, b) => a[0] - b[0]).map(([t, v]) => ({ time: t as UTCTimestamp, value: v }))
    if (!(dash && draw.current && data.length > 2 && !reduced())) {
      s.setData(data)
      c.timeScale().fitContent()
      return
    }
    draw.current = false
    // draw the line left to right over 0.9s with the full range already in view; the fill fades in with it
    s.setData(data)
    c.timeScale().fitContent()
    const range = c.timeScale().getVisibleLogicalRange()
    const t0 = performance.now()
    let raf = 0
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 900)
      const e = 1 - Math.pow(1 - k, 3)
      s.setData(data.slice(0, Math.max(2, Math.ceil(data.length * e))))
      s.applyOptions({ topColor: fill(e) })
      if (range) c.timeScale().setVisibleLogicalRange(range)
      if (k < 1) raf = requestAnimationFrame(step)
      else c.timeScale().fitContent()
    }
    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      s.setData(data)
      s.applyOptions({ topColor: fill(1) })
    }
  }, [points, up, dash, replay])

  return (
    <div className="equity-wrap">
      <div ref={host} className="equity-chart" />
      {tip && (
        <div className="eq-tip" style={{ transform: `translate(${Math.round(tip.x)}px, ${Math.round(tip.y)}px) translate(-50%, calc(-100% - 12px))` }}>
          <b className="mono">{fmtUsd(tip.value)}</b>
          <span>{fmtTime(tip.time)}</span>
        </div>
      )}
    </div>
  )
}
