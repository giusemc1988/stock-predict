import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type ISeriesMarkersPluginApi,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { Candle, Prediction, Signal, Timeframe } from '../types'
import { fmtCompact, fmtPrice, fmtTime, tone } from '../lib/format'
import { barBuyVolume, hasRealBuyVolume } from '../lib/orderflow'
import { RobotIcon } from './RobotIcon'
import { sma, stdev } from '../lib/indicators'
import { loadChartConfig, saveChartConfig, type ChartConfig } from '../lib/chartConfig'
import { useT } from '../lib/i18n'
import type { PracticeEvent } from '../lib/practice'
import { JarvisAvatar } from './JarvisAvatar'

/** Practice-mode trades drawn on the chart: entry/exit markers, open-trade lines, and a flash on each new order. */
export interface PracticeOverlay {
  markers: { time: number; side: 'buy' | 'sell'; text: string }[]
  lines: { price: number; color: string; title: string }[]
  flash: PracticeEvent | null
  flashText: string
}

/** Jarvis "Show me": one step of a guided tour drawn on the chart, with a callout. */
export interface ChartTour {
  key: string
  title: string
  text: string
  index: number
  total: number
  lines: { price: number; color: string; title: string }[]
  focus?: { time: number; price: number }
  marker?: { time: number; side: 'buy' | 'sell'; text: string }
  backLabel: string
  nextLabel: string
  doneLabel: string
  motion: boolean
  onBack: () => void
  onNext: () => void
  onClose: () => void
}

const COLORS = {
  up: '#0ecb81',
  down: '#f6465d',
  grid: 'rgba(42, 49, 61, 0.45)',
  text: '#8a93a6',
  emaFast: '#f0b90b',
  emaSlow: '#a78bfa',
  forecast: '#4fd1ff',
  sma: '#f59e0b',
  bollinger: 'rgba(148, 163, 184, 0.7)',
  practice: '#f0b90b',
}

interface Props {
  symbol: string
  tf: Timeframe
  candles: Candle[]
  signals: Signal[]
  prediction: Prediction | null
  emaFast: (number | null)[]
  emaSlow: (number | null)[]
  showEmas: boolean
  showForecast: boolean
  showRobots: boolean
  practice?: PracticeOverlay | null
  tour?: ChartTour | null
}

const ts = (t: number) => t as UTCTimestamp

/** Caption revealed word by word like a HUD readout. Pure CSS opacity (no layout per frame); instant when motion is off. */
function TypedText({ text, motion }: { text: string; motion: boolean }) {
  if (!motion) return <>{text}</>
  const words = text.split(' ')
  const gap = Math.min(45, 900 / Math.max(1, words.length))
  return (
    <>
      {words.map((w, i) => (
        <span key={i} className="hud-word" style={{ animationDelay: `${Math.round(i * gap)}ms` }}>
          {w}
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </>
  )
}

/** Number input that keeps what the user is typing apart from the saved value.
 *  Only a finite value inside the range is committed; an empty or bad entry is ignored until blur. */
function NumField({ label, value, min, max, step, onCommit }: { label: string; value: number; min: number; max: number; step: number; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  return (
    <label>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          const n = e.target.value.trim() === '' ? NaN : Number(e.target.value)
          if (Number.isFinite(n) && n >= min && n <= max) onCommit(n)
        }}
        onBlur={() => setDraft(String(value))}
      />
    </label>
  )
}

export function ChartPanel(props: Props) {
  const t = useT()
  const { symbol, tf, candles, signals, prediction, emaFast, emaSlow, showEmas, showForecast, showRobots, practice, tour } = props
  const host = useRef<HTMLDivElement>(null)
  const overlay = useRef<HTMLDivElement>(null)
  const chart = useRef<IChartApi | null>(null)
  const series = useRef<{
    candle: ISeriesApi<'Candlestick'>
    volume: ISeriesApi<'Histogram'>
    buyVol: ISeriesApi<'Histogram'>
    fast: ISeriesApi<'Line'>
    slow: ISeriesApi<'Line'>
    fMid: ISeriesApi<'Line'>
    fHi: ISeriesApi<'Line'>
    fLo: ISeriesApi<'Line'>
    sma: ISeriesApi<'Line'>
    bbUp: ISeriesApi<'Line'>
    bbMid: ISeriesApi<'Line'>
    bbLo: ISeriesApi<'Line'>
    markers: ISeriesMarkersPluginApi<Time>
  } | null>(null)
  const loaded = useRef<{ key: string; len: number; first: number }>({ key: '', len: 0, first: 0 })
  const robotEls = useRef(new Map<number, HTMLDivElement>())
  const candlesRef = useRef(candles)
  candlesRef.current = candles
  const [hover, setHover] = useState<Candle | null>(null)
  const [cfg, setCfg] = useState<ChartConfig>(loadChartConfig)
  const [settings, setSettings] = useState(false)
  const updateCfg = (next: ChartConfig) => {
    setCfg(next)
    saveChartConfig(next)
  }

  // create chart once
  useEffect(() => {
    const el = host.current!
    const c = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: COLORS.text, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 11, attributionLogo: false },
      grid: { vertLines: { color: COLORS.grid }, horzLines: { color: COLORS.grid } },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: '#4b5568', labelBackgroundColor: '#2a3140' }, horzLine: { color: '#4b5568', labelBackgroundColor: '#2a3140' } },
      rightPriceScale: { borderColor: '#1e2430', scaleMargins: { top: 0.08, bottom: 0.22 } },
      timeScale: {
        borderColor: '#1e2430',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 14,
        barSpacing: 8,
        tickMarkFormatter: (t: Time) => {
          const d = new Date((t as number) * 1000)
          const hh = d.getHours()
          const mm = d.getMinutes()
          // Show date on day boundaries (midnight) and every 6-hour mark for visibility on intraday charts
          const isStartOfDay = hh === 0 && mm === 0
          const isSixHourMark = (hh === 0 || hh === 6 || hh === 12 || hh === 18) && mm === 0
          if (isStartOfDay) {
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          }
          if (isSixHourMark) {
            return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${hh.toString().padStart(2, '0')}:00`
          }
          return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
        },
      },
      localization: { timeFormatter: (t: Time) => fmtTime(t as number) },
    })
    const candle = c.addSeries(CandlestickSeries, {
      upColor: COLORS.up,
      downColor: COLORS.down,
      borderUpColor: COLORS.up,
      borderDownColor: COLORS.down,
      wickUpColor: COLORS.up,
      wickDownColor: COLORS.down,
      priceLineStyle: LineStyle.Dashed,
    })
    // total volume drawn in red (sellers), buyer volume drawn on top in green: the red part left showing is selling
    const volume = c.addSeries(HistogramSeries, { priceScaleId: 'vol', priceFormat: { type: 'volume' }, color: 'rgba(246,70,93,0.45)', lastValueVisible: false, priceLineVisible: false })
    const buyVol = c.addSeries(HistogramSeries, { priceScaleId: 'vol', priceFormat: { type: 'volume' }, color: 'rgba(14,203,129,0.55)', lastValueVisible: false, priceLineVisible: false })
    c.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 }, visible: false })
    const line = (color: string, width: 1 | 2, style = LineStyle.Solid) =>
      c.addSeries(LineSeries, { color, lineWidth: width, lineStyle: style, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
    series.current = {
      candle,
      volume,
      buyVol,
      fast: line(COLORS.emaFast, 1),
      slow: line(COLORS.emaSlow, 1),
      fMid: line(COLORS.forecast, 2, LineStyle.Dashed),
      fHi: line('rgba(79,209,255,0.45)', 1, LineStyle.Dotted),
      fLo: line('rgba(79,209,255,0.45)', 1, LineStyle.Dotted),
      sma: line(COLORS.sma, 1),
      bbUp: line(COLORS.bollinger, 1, LineStyle.Dotted),
      bbMid: line(COLORS.bollinger, 1),
      bbLo: line(COLORS.bollinger, 1, LineStyle.Dotted),
      markers: createSeriesMarkers(candle, []),
    }
    chart.current = c

    const onMove = (p: MouseEventParams) => {
      const bar = p.time != null ? candlesRef.current.find((x) => x.time === (p.time as number)) : undefined
      setHover(bar ?? null)
    }
    c.subscribeCrosshairMove(onMove)

    // keep robots glued to their bars while panning/zooming/scaling
    let raf = 0
    const place = () => {
      const s = series.current
      if (s) {
        const w = el.clientWidth - (c.priceScale('right').width() || 0)
        for (const [time, node] of robotEls.current) {
          const x = c.timeScale().timeToCoordinate(ts(time))
          const anchor = Number(node.dataset.anchor)
          const y = s.candle.priceToCoordinate(anchor)
          if (x == null || y == null || x < 0 || x > w) {
            node.style.visibility = 'hidden'
            continue
          }
          node.style.visibility = 'visible'
          const below = node.dataset.side === 'buy'
          // flip the hover card so it never leaves the chart
          node.classList.toggle('tip-down', below ? y < el.clientHeight - 260 : y < 230)
          node.classList.toggle('tip-left', x > w - 130)
          node.classList.toggle('tip-right', x < 130)
          node.style.transform = `translate(${x}px, ${y}px) translate(-50%, ${below ? '10px' : 'calc(-100% - 10px)'})`
        }
      }
      raf = requestAnimationFrame(place)
    }
    raf = requestAnimationFrame(place)

    return () => {
      cancelAnimationFrame(raf)
      c.unsubscribeCrosshairMove(onMove)
      c.remove()
      chart.current = null
      series.current = null
      loaded.current = { key: '', len: 0, first: 0 }
    }
  }, [])

  // price + volume data (setData on symbol/timeframe change, incremental update for live ticks)
  useEffect(() => {
    const s = series.current
    if (!s || !candles.length) {
      s?.candle.setData([])
      s?.volume.setData([])
      s?.buyVol.setData([])
      loaded.current = { key: '', len: 0, first: 0 }
      return
    }
    const key = `${symbol}|${tf}`
    const L = loaded.current
    const last = candles[candles.length - 1]
    const vol = (c: Candle) => ({ time: ts(c.time), value: c.volume })
    const buy = (c: Candle) => ({ time: ts(c.time), value: barBuyVolume(c) })

    // Filter candles by timeRange
    const now = last.time
    const getTimeRangeStart = () => {
      const days = cfg.timeRange === '1d' ? 1 : cfg.timeRange === '1w' ? 7 : cfg.timeRange === '1m' ? 30 : cfg.timeRange === '1y' ? 365 : null
      if (!days) return 0
      return now - days * 86400
    }
    const timeRangeStart = getTimeRangeStart()
    const displayCandles = timeRangeStart === 0 ? candles : candles.filter((c) => c.time >= timeRangeStart)
    const displayLast = displayCandles[displayCandles.length - 1] ?? last

    if (L.key === key && L.first === displayCandles[0]?.time && (displayCandles.length === L.len || displayCandles.length === L.len + 1)) {
      s.candle.update({ time: ts(displayLast.time), open: displayLast.open, high: displayLast.high, low: displayLast.low, close: displayLast.close })
      s.volume.update(vol(displayLast))
      s.buyVol.update(buy(displayLast))
    } else {
      s.candle.setData(displayCandles.map((c) => ({ time: ts(c.time), open: c.open, high: c.high, low: c.low, close: c.close })))
      s.volume.setData(displayCandles.map(vol))
      s.buyVol.setData(displayCandles.map(buy))
      const d = displayLast.close < 1 ? 6 : displayLast.close < 10 ? 4 : 2
      s.candle.applyOptions({ priceFormat: { type: 'price', precision: d, minMove: 1 / 10 ** d } })
      if (L.key !== key) {
        chart.current?.timeScale().setVisibleLogicalRange({ from: Math.max(0, displayCandles.length - 160), to: displayCandles.length + 14 })
      }
    }
    loaded.current = { key, len: displayCandles.length, first: displayCandles[0]?.time ?? 0 }
  }, [candles, symbol, tf, cfg.timeRange])

  // overlays: EMAs, forecast cone, arrow markers (practice markers compared by value, not identity)
  const marksKey = JSON.stringify([...(practice?.markers ?? []), ...(tour?.marker ? [{ ...tour.marker, tour: true }] : [])])
  useEffect(() => {
    const s = series.current
    if (!s) return
    const toLine = (arr: (number | null)[]) =>
      showEmas ? candles.flatMap((c, i) => (arr[i] != null ? [{ time: ts(c.time), value: arr[i]! }] : [])) : []
    s.fast.setData(toLine(emaFast))
    s.slow.setData(toLine(emaSlow))
    const fc = showForecast && prediction ? prediction.forecast : []
    s.fMid.setData(fc.map((f) => ({ time: ts(f.time), value: f.value })))
    s.fHi.setData(fc.map((f) => ({ time: ts(f.time), value: f.upper })))
    s.fLo.setData(fc.map((f) => ({ time: ts(f.time), value: f.lower })))
    const barTimes = new Set(candles.map((c) => c.time))
    const practiceMarks = (JSON.parse(marksKey) as (PracticeOverlay['markers'][number] & { tour?: boolean })[])
      .filter((m) => barTimes.has(m.time))
      .map((m) => ({
        time: ts(m.time),
        position: m.side === 'buy' ? ('belowBar' as const) : ('aboveBar' as const),
        shape: m.side === 'buy' ? ('arrowUp' as const) : ('arrowDown' as const),
        color: m.tour ? COLORS.forecast : COLORS.practice,
        text: m.text,
        size: m.tour ? 2 : 1,
      }))
    s.markers.setMarkers(
      [
        ...signals.map((sig) => ({
          time: ts(sig.time),
          position: sig.side === 'buy' ? ('belowBar' as const) : ('aboveBar' as const),
          shape: sig.side === 'buy' ? ('arrowUp' as const) : ('arrowDown' as const),
          color: sig.side === 'buy' ? COLORS.up : COLORS.down,
          size: 0.6,
        })),
        ...practiceMarks,
      ].sort((a, b) => (a.time as number) - (b.time as number)),
    )
  }, [candles, emaFast, emaSlow, prediction, signals, showEmas, showForecast, marksKey])

  // practice mode: entry, stop and target lines for open practice trades
  const practiceLines = useRef<IPriceLine[]>([])
  const linesKey = JSON.stringify(practice?.lines ?? [])
  useEffect(() => {
    const s = series.current
    if (!s) return
    for (const l of practiceLines.current) s.candle.removePriceLine(l)
    practiceLines.current = (JSON.parse(linesKey) as PracticeOverlay['lines']).map((l) =>
      s.candle.createPriceLine({ price: l.price, color: l.color, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: l.title }),
    )
  }, [linesKey, symbol, tf])

  // Jarvis "Show me": bold lines for this step, the chart scrolled to the bar, and a pulsing pointer on the spot
  const tourLines = useRef<IPriceLine[]>([])
  const tourLinesKey = JSON.stringify(tour?.lines ?? [])
  useEffect(() => {
    const s = series.current
    if (!s) return
    for (const l of tourLines.current) s.candle.removePriceLine(l)
    tourLines.current = (JSON.parse(tourLinesKey) as ChartTour['lines']).map((l) =>
      s.candle.createPriceLine({ price: l.price, color: l.color, lineWidth: 2, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: `Jarvis · ${l.title}` }),
    )
  }, [tourLinesKey, symbol, tf])
  // the reticle and guide lines are moved with transforms written straight to the DOM (no React render per frame)
  const hud = useRef<HTMLDivElement>(null)
  const tourKey = tour?.key ?? ''
  const fTime = tour?.focus?.time ?? null
  const fPrice = tour?.focus?.price ?? null
  useEffect(() => {
    const c = chart.current
    const s = series.current
    const f = fTime != null && fPrice != null ? [fTime, fPrice] : null
    const layer = hud.current
    if (!layer) return
    if (!c || !s || !f || !candlesRef.current.length) {
      layer.dataset.on = ''
      return
    }
    const bars = candlesRef.current
    const i = bars.findIndex((b) => b.time >= f[0])
    const idx = i < 0 ? bars.length - 1 : i
    const range = c.timeScale().getVisibleLogicalRange()
    const width = range ? Math.max(40, range.to - range.from) : 120
    if (!range || idx < range.from + 5 || idx > range.to - 5) c.timeScale().setVisibleLogicalRange({ from: idx - width * 0.6, to: idx + width * 0.4 })
    let raf = 0
    const place = () => {
      raf = 0
      const x = c.timeScale().timeToCoordinate(ts(bars[idx].time))
      const y = s.candle.priceToCoordinate(f[1])
      if (x == null || y == null) {
        layer.dataset.on = ''
        return
      }
      layer.dataset.on = '1'
      layer.style.setProperty('--hx', `${x}px`)
      layer.style.setProperty('--hy', `${y}px`)
    }
    // glide to the new point on a step change; follow the chart instantly while it scrolls
    layer.classList.add('sweep')
    const glide = setTimeout(() => layer.classList.remove('sweep'), 500)
    raf = requestAnimationFrame(place)
    const onRange = () => {
      if (!raf) raf = requestAnimationFrame(place)
    }
    c.timeScale().subscribeVisibleLogicalRangeChange(onRange)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(glide)
      c.timeScale().unsubscribeVisibleLogicalRangeChange(onRange)
    }
  }, [tourKey, fTime, fPrice, candles.length, symbol, tf])

  // SMA and Bollinger bands from the chart's own candles; volume bars can be hidden
  useEffect(() => {
    const s = series.current
    if (!s) return
    const close = candles.map((c) => c.close)
    const toLine = (arr: (number | null)[]) => candles.flatMap((c, i) => (arr[i] != null ? [{ time: ts(c.time), value: arr[i]! }] : []))
    s.sma.setData(cfg.sma.on ? toLine(sma(close, cfg.sma.period)) : [])
    if (cfg.bollinger.on) {
      const mid = sma(close, cfg.bollinger.period)
      const sd = stdev(close, cfg.bollinger.period)
      const band = (k: number) => mid.map((m, i) => (m != null && sd[i] != null ? m + k * cfg.bollinger.mult * sd[i]! : null))
      const lower = band(-1)
      s.bbUp.setData(toLine(band(1)))
      s.bbMid.setData(toLine(mid))
      s.bbLo.setData(toLine(lower))
    } else {
      s.bbUp.setData([])
      s.bbMid.setData([])
      s.bbLo.setData([])
    }
    s.volume.applyOptions({ visible: cfg.volume })
    s.buyVol.applyOptions({ visible: cfg.volume })
  }, [candles, cfg])
  const robots = useMemo(() => {
    if (!showRobots) return []
    const byTime = new Map(candles.map((c) => [c.time, c]))
    return signals.flatMap((sig) => {
      const bar = byTime.get(sig.time)
      return bar ? [{ sig, anchor: sig.side === 'buy' ? bar.low : bar.high }] : []
    })
  }, [signals, candles, showRobots])

  const latestSignalTime = signals.length ? signals[signals.length - 1].time : -1
  const shown = hover ?? candles[candles.length - 1]
  const realBuy = hasRealBuyVolume(candles)

  return (
    <div className="chart-wrap">
      <div ref={host} className="chart-host" />
      {practice?.flash && (
        <div key={practice.flash.id} className={`practice-flash ${practice.flash.kind}${practice.flash.kind === 'sell' ? ((practice.flash.pnl ?? 0) >= 0 ? ' win' : ' loss') : ''}`} role="status">
          <b>🎯 {practice.flash.kind === 'buy' ? 'BUY' : 'SELL'} {practice.flash.symbol}</b>
          <span>{practice.flashText}</span>
        </div>
      )}
      {tour && (
        <>
          <div ref={hud} className={`hud-layer${tour.motion ? '' : ' still'}`} aria-hidden>
            <i className="hud-hline" />
            <i className="hud-vline" />
            <div className="hud-reticle">
              <svg key={tour.key} width="56" height="56" viewBox="-28 -28 56 56">
                <circle r="20" className="r-spin" />
                <circle r="9" className="r-core" />
                <path d="M-26 -14 V-26 H-14 M14 -26 H26 V-14 M26 14 V26 H14 M-14 26 H-26 V14" className="r-brackets" />
                <path d="M-6 0 H-2 M2 0 H6 M0 -6 V-2 M0 2 V6" className="r-cross" />
              </svg>
            </div>
          </div>
          <div key={tour.key} className={`tour-callout hud${tour.motion ? '' : ' still'}`} role="dialog" aria-label={tour.title}>
            <i className="hud-scan" aria-hidden />
            <div className="tour-head">
              <JarvisAvatar size={22} mood="speaking" motion={tour.motion} />
              <b className="mono">JARVIS // {tour.title.toUpperCase()}</b>
              <span className="mono">
                {String(tour.index + 1).padStart(2, '0')}/{String(tour.total).padStart(2, '0')}
              </span>
              <button className="tour-x" onClick={tour.onClose} aria-label={tour.doneLabel}>
                ×
              </button>
            </div>
            <p>
              <TypedText text={tour.text} motion={tour.motion} />
            </p>
            <div className="hud-steps" aria-hidden>
              {Array.from({ length: tour.total }, (_, i) => (
                <i key={i} className={i <= tour.index ? 'on' : ''} />
              ))}
            </div>
            <div className="tour-nav">
              <button onClick={tour.onBack} disabled={tour.index === 0}>
                {tour.backLabel}
              </button>
              <button className="primary" onClick={tour.index + 1 < tour.total ? tour.onNext : tour.onClose}>
                {tour.index + 1 < tour.total ? tour.nextLabel : tour.doneLabel}
              </button>
            </div>
          </div>
        </>
      )}
      <div ref={overlay} className="robot-layer">
        {robots.map(({ sig, anchor }) => (
          <div
            key={`${sig.side}-${sig.time}`}
            ref={(n) => {
              if (n) robotEls.current.set(sig.time, n)
              else robotEls.current.delete(sig.time)
            }}
            data-anchor={anchor}
            data-side={sig.side}
            className={`robot-marker ${sig.side} ${sig.time === latestSignalTime ? 'latest' : ''}`}
          >
            {sig.side === 'sell' && <span className="robot-tag">SELL {fmtPrice(sig.price)}</span>}
            <RobotIcon side={sig.side} size={26} />
            {sig.side === 'buy' && <span className="robot-tag">BUY {fmtPrice(sig.price)}</span>}
            <div className="robot-tip">
              <div className="robot-tip-head">
                <RobotIcon side={sig.side} size={16} />
                <b>{sig.side === 'buy' ? 'Arc BUY' : 'Arc SELL'}</b>
                <span>{fmtTime(sig.time)}</span>
              </div>
              <div className="robot-tip-row">
                <span>Trigger</span>
                <b>{fmtPrice(sig.price)}</b>
              </div>
              <div className="robot-tip-row">
                <span>Confidence</span>
                <b>{(sig.confidence * 100).toFixed(0)}%</b>
              </div>
              <ul>
                {sig.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
      <div className="chart-tools">
        {(['1d', '1w', '1m', '1y', 'all'] as const).map((range) => (
          <button
            key={range}
            className={cfg.timeRange === range ? 'on' : ''}
            onClick={() => updateCfg({ ...cfg, timeRange: range })}
          >
            {range === '1d' ? '1D' : range === '1w' ? '1W' : range === '1m' ? '1M' : range === '1y' ? '1Y' : 'All'}
          </button>
        ))}
        <span className="chart-tool-sep" />
        <button className={cfg.sma.on ? 'on' : ''} onClick={() => updateCfg({ ...cfg, sma: { ...cfg.sma, on: !cfg.sma.on } })}>
          SMA {cfg.sma.period}
        </button>
        <button className={cfg.bollinger.on ? 'on' : ''} onClick={() => updateCfg({ ...cfg, bollinger: { ...cfg.bollinger, on: !cfg.bollinger.on } })}>
          Bollinger {cfg.bollinger.period}
        </button>
        <button className={cfg.volume ? 'on' : ''} onClick={() => updateCfg({ ...cfg, volume: !cfg.volume })}>
          {t('volume')}
        </button>
        <button className={settings ? 'on' : ''} onClick={() => setSettings((v) => !v)} aria-label={t('chartSettings')}>
          {t('settings')}
        </button>
        {settings && (
          <div className="chart-settings">
            <NumField label={t('smaPeriod')} value={cfg.sma.period} min={2} max={200} step={1} onCommit={(v) => updateCfg({ ...cfg, sma: { ...cfg.sma, period: v } })} />
            <NumField label={t('bollPeriod')} value={cfg.bollinger.period} min={2} max={200} step={1} onCommit={(v) => updateCfg({ ...cfg, bollinger: { ...cfg.bollinger, period: v } })} />
            <NumField label={t('bollWidth')} value={cfg.bollinger.mult} min={0.5} max={4} step={0.5} onCommit={(v) => updateCfg({ ...cfg, bollinger: { ...cfg.bollinger, mult: v } })} />
            <p className="muted">{t('savedHere')}</p>
          </div>
        )}
      </div>
      {shown && (
        <div className="chart-legend">
          <span className="legend-sym">{symbol}</span>
          <span className="legend-tf">{tf.toUpperCase()}</span>
          {(['open', 'high', 'low', 'close'] as const).map((k) => (
            <span key={k}>
              {k[0].toUpperCase()} <b className={tone(shown.close - shown.open)}>{fmtPrice(shown[k])}</b>
            </span>
          ))}
          <span>
            Vol <b>{fmtCompact(shown.volume)}</b>
          </span>
          <span>
            {realBuy ? '' : '~'}Buy <b className="up">{Math.round((barBuyVolume(shown) / (shown.volume || 1)) * 100)}%</b> / Sell{' '}
            <b className="down">{Math.round((1 - barBuyVolume(shown) / (shown.volume || 1)) * 100)}%</b>
          </span>
          {showEmas && (
            <>
              <span className="legend-ema" style={{ color: COLORS.emaFast }}>EMA 9</span>
              <span className="legend-ema" style={{ color: COLORS.emaSlow }}>EMA 21</span>
            </>
          )}
          {showForecast && prediction && <span className="legend-ema" style={{ color: COLORS.forecast }}>AI forecast ±1σ</span>}
        </div>
      )}
      {!candles.length && <div className="chart-empty">Loading market data…</div>}
      <div className="chart-key">
        {showRobots && (
          <>
            <span>
              <RobotIcon side="buy" size={14} /> AI buy point
            </span>
            <span>
              <RobotIcon side="sell" size={14} /> AI sell point
            </span>
          </>
        )}
        <span>
          <i className="key-vol" /> Volume: green = buyers, red = sellers{realBuy ? '' : ' (est.)'}
        </span>
        {showForecast && prediction && (
          <span>
            <i className="key-fc" /> AI forecast range
          </span>
        )}
      </div>
    </div>
  )
}
