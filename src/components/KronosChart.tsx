import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { binanceKlines } from '../data/providers'
import { fmtPct, tone } from '../lib/format'
import { COUNCIL_IDS, dailyVol, forecastPath, type CouncilId, type KronosForecast } from '../lib/kronosView'

const T = {
  all: { en: 'All', vi: 'Tất cả' },
  today: { en: 'Today', vi: 'Hôm nay' },
  plus5: { en: '+5 days', vi: '+5 phiên' },
  noHist: { en: 'Price history arrives after the next Kronos run', vi: 'Đường giá có sau lần chạy Kronos tới' },
  aria: { en: '{s}: last 30 closes, then the Kronos 5-day forecast with its usual range', vi: '{s}: 30 giá đóng cửa gần nhất, rồi dự báo 5 phiên của Kronos kèm biên độ thường gặp' },
}

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const fmtPx = (v: number) => (v >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : v.toFixed(2))

/**
 * One Kronos symbol drawn inside the Atlas card: the last 30 closes, the 7 agents lighting up in
 * turn, then the dashed 5-day forecast with a ±1σ band. Watch only; nothing here trades.
 */
export function KronosChart({ f, recent, vi, label, onAll }: { f: KronosForecast; recent?: number[]; vi: boolean; label: (id: CouncilId) => string; onAll: () => void }) {
  const tr = (k: keyof typeof T, s = '') => (vi ? T[k].vi : T[k].en).replace('{s}', s)
  const sym = f.symbol.replace('-USD', '')
  const crypto = f.symbol.endsWith('-USD')

  // crypto history is free from Binance when the saved run has none yet
  const [fetched, setFetched] = useState<number[] | null>(null)
  useEffect(() => {
    if (recent?.length || !crypto) return
    let live = true
    binanceKlines(`${sym}USDT`, '1d', 31)
      .then((c) => live && setFetched(c.slice(0, -1).map((x) => x.close)))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [recent, crypto, sym])
  const hist = useMemo(() => (recent?.length ? recent : (fetched ?? [])), [recent, fetched])

  // the chips light one by one, then the line draws
  const [lit, setLit] = useState(reduceMotion() ? COUNCIL_IDS.length : 0)
  // the parent keys this component by symbol, so a new symbol starts from 0 again
  useEffect(() => {
    if (reduceMotion()) return
    const ids = COUNCIL_IDS.map((_, i) => setTimeout(() => setLit(i + 1), 130 * (i + 1)))
    return () => ids.forEach(clearTimeout)
  }, [])
  const drawn = lit >= COUNCIL_IDS.length

  const fc = useMemo(() => forecastPath(f), [f])
  const pct = (fc[4] / f.lastClose - 1) * 100
  const kv = pct > 0.5 ? 'yes' : pct < -0.5 ? 'no' : 'none'

  // the drawing is as wide as its box in pixels, so labels stay readable on a phone
  const box = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(600)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(Math.max(280, Math.min(720, Math.round(el.clientWidth)))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const g = useMemo(() => {
    // the saved closes usually end with the forecast's own last close; keep it once
    const past = hist.length && Math.abs(hist[hist.length - 1] / f.lastClose - 1) < 1e-6 ? hist.slice(0, -1) : hist
    const h = [...past.slice(-29), f.lastClose]
    const sd = dailyVol(h)
    const line = [f.lastClose, ...fc]
    const hi = line.map((v, d) => v * (1 + sd * Math.sqrt(d)))
    const lo = line.map((v, d) => v * (1 - sd * Math.sqrt(d)))
    const all = [...h, ...hi, ...lo]
    let mn = Math.min(...all)
    let mx = Math.max(...all)
    const pad = (mx - mn) * 0.08 || f.lastClose * 0.01
    mn -= pad
    mx += pad
    const L = 4
    const R = W - 52
    const Tp = 6
    const B = 118
    const n = Math.max(h.length, 6) + 5
    const t0 = n - 6
    const X = (t: number) => L + ((R - L) * t) / (n - 1)
    const Y = (v: number) => B - ((B - Tp) * (v - mn)) / (mx - mn)
    const hx = (i: number) => X(t0 - (h.length - 1) + i)
    const histD = h.length > 1 ? 'M' + h.map((v, i) => `${hx(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' L') : ''
    const areaD = histD ? `${histD} L${hx(h.length - 1)},${B} L${hx(0)},${B}Z` : ''
    const fcD = 'M' + line.map((v, d) => `${X(t0 + d).toFixed(1)},${Y(v).toFixed(1)}`).join(' L')
    const bandD = 'M' + [...hi.map((v, d) => `${X(t0 + d).toFixed(1)},${Y(v).toFixed(1)}`), ...lo.map((_, d) => `${X(t0 + 5 - d).toFixed(1)},${Y(lo[5 - d]).toFixed(1)}`)].join(' L') + 'Z'
    const ticks = [mx - pad, (mx + mn) / 2, mn + pad].map((v) => ({ y: Y(v), v }))
    return { histD, areaD, fcD, bandD, ticks, nowX: X(t0), nowY: Y(f.lastClose), endX: X(t0 + 5), endY: Y(fc[4]), B, R }
  }, [hist, f.lastClose, fc, W])

  const clip = `kc${useId().replace(/:/g, '')}`

  return (
    <div className="hg-kchart" ref={box}>
      <div className="hg-ksel">
        <span>
          <b>{sym}</b> {fmtPx(f.lastClose)} → <b className={tone(pct)}>{fmtPx(fc[4])}</b> <em className={tone(pct)}>{fmtPct(pct)}</em>
        </span>
        <button onClick={onAll}>{tr('all')}</button>
      </div>
      <div className="hg-kag">
        {COUNCIL_IDS.map((id, i) => (
          <span key={id} className={`${i < lit ? 'lit' : ''}${id === 'kronos' && i < lit ? ` v-${kv}` : ''}`}>
            <i />
            {label(id)}
          </span>
        ))}
      </div>
      <svg className="hg-kline" viewBox={`0 0 ${W} 136`} role="img" aria-label={tr('aria', sym)}>
        {g.ticks.map((t) => (
          <g key={t.y}>
            <line x1="4" x2={g.R} y1={t.y} y2={t.y} />
            <text x={g.R + 6} y={t.y + 4}>
              {fmtPx(t.v)}
            </text>
          </g>
        ))}
        {g.areaD && <path className="hg-kl-area" d={g.areaD} />}
        {g.histD && <path className="hg-kl-hist" d={g.histD} />}
        <line className="hg-kl-now" x1={g.nowX} x2={g.nowX} y1="6" y2={g.B} />
        <text x={g.nowX - 4} y={g.B + 15} textAnchor="end">
          {tr('today')}
        </text>
        <text x={g.endX} y={g.B + 15} textAnchor="end">
          {tr('plus5')}
        </text>
        <clipPath id={clip}>
          <rect className={`hg-kl-wipe${drawn ? ' on' : ''}`} x={g.nowX - 2} y="0" width={g.endX - g.nowX + 10} height="136" />
        </clipPath>
        <g clipPath={`url(#${clip})`}>
          <path className="hg-kl-band" d={g.bandD} />
          <path className="hg-kl-fc" d={g.fcD} />
          <circle className="hg-kl-end" cx={g.endX} cy={g.endY} r="5" />
        </g>
        <circle className="hg-kl-dot" cx={g.nowX} cy={g.nowY} r="4" />
      </svg>
      {!hist.length && <p className="hg-kfoot">{tr('noHist')}</p>}
    </div>
  )
}
