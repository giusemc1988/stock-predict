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
  type ISeriesMarkersPluginApi,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { Candle, Prediction, Signal, Timeframe } from '../types'
import { fmtCompact, fmtPrice, fmtTime, tone } from '../lib/format'
import { barBuyVolume, hasRealBuyVolume } from '../lib/orderflow'
import { RobotIcon } from './RobotIcon'

const COLORS = {
  up: '#0ecb81',
  down: '#f6465d',
  grid: 'rgba(42, 49, 61, 0.45)',
  text: '#8a93a6',
  emaFast: '#f0b90b',
  emaSlow: '#a78bfa',
  forecast: '#4fd1ff',
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
}

const ts = (t: number) => t as UTCTimestamp

export function ChartPanel(props: Props) {
  const { symbol, tf, candles, signals, prediction, emaFast, emaSlow, showEmas, showForecast, showRobots } = props
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
    markers: ISeriesMarkersPluginApi<Time>
  } | null>(null)
  const loaded = useRef<{ key: string; len: number; first: number }>({ key: '', len: 0, first: 0 })
  const robotEls = useRef(new Map<number, HTMLDivElement>())
  const candlesRef = useRef(candles)
  candlesRef.current = candles
  const [hover, setHover] = useState<Candle | null>(null)

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
          return d.getHours() === 0 && d.getMinutes() === 0
            ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
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
    if (L.key === key && L.first === candles[0].time && (candles.length === L.len || candles.length === L.len + 1)) {
      s.candle.update({ time: ts(last.time), open: last.open, high: last.high, low: last.low, close: last.close })
      s.volume.update(vol(last))
      s.buyVol.update(buy(last))
    } else {
      s.candle.setData(candles.map((c) => ({ time: ts(c.time), open: c.open, high: c.high, low: c.low, close: c.close })))
      s.volume.setData(candles.map(vol))
      s.buyVol.setData(candles.map(buy))
      const d = last.close < 1 ? 6 : last.close < 10 ? 4 : 2
      s.candle.applyOptions({ priceFormat: { type: 'price', precision: d, minMove: 1 / 10 ** d } })
      if (L.key !== key) {
        chart.current?.timeScale().setVisibleLogicalRange({ from: Math.max(0, candles.length - 160), to: candles.length + 14 })
      }
    }
    loaded.current = { key, len: candles.length, first: candles[0].time }
  }, [candles, symbol, tf])

  // overlays: EMAs, forecast cone, arrow markers
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
    s.markers.setMarkers(
      signals.map((sig) => ({
        time: ts(sig.time),
        position: sig.side === 'buy' ? 'belowBar' : 'aboveBar',
        shape: sig.side === 'buy' ? 'arrowUp' : 'arrowDown',
        color: sig.side === 'buy' ? COLORS.up : COLORS.down,
        size: 0.6,
      })),
    )
  }, [candles, emaFast, emaSlow, prediction, signals, showEmas, showForecast])

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
                <b>{sig.side === 'buy' ? 'Bluechip BUY' : 'Bluechip SELL'}</b>
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
