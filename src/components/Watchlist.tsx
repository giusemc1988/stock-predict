import { useEffect, useMemo, useRef, useState } from 'react'
import type { Instrument, Quote, Signal } from '../types'
import { fmtCompact, fmtPct, fmtPrice, tone } from '../lib/format'
import { Sparkline } from './Sparkline'
import { RobotIcon } from './RobotIcon'
import { CATALOG, toInstrument } from '../data/catalog'

interface Props {
  instruments: Instrument[]
  quotes: Record<string, Quote>
  active: string
  onSelect: (symbol: string) => void
  onAdd: (inst: Instrument) => void
  activeSignal: Signal | null
}

/** Matches typed text against symbol and name; symbol-prefix hits rank first. */
function suggest(query: string, taken: Set<string>) {
  const q = query.trim().toUpperCase()
  if (!q) return []
  const score = (c: (typeof CATALOG)[number]) => {
    const sym = c.symbol.toUpperCase()
    const name = c.name.toUpperCase()
    if (sym.startsWith(q)) return 0
    if (sym.includes(q)) return 1
    if (name.startsWith(q)) return 2
    if (name.includes(q)) return 3
    return -1
  }
  return CATALOG.filter((c) => !taken.has(c.symbol) && score(c) >= 0)
    .sort((a, b) => score(a) - score(b))
    .slice(0, 8)
}

function Row({ inst, q, active, onSelect, signal }: { inst: Instrument; q?: Quote; active: boolean; onSelect: () => void; signal: Signal | null }) {
  const prev = useRef(q?.price)
  const [flash, setFlash] = useState<'' | 'up' | 'down'>('')
  useEffect(() => {
    if (q && prev.current != null && q.price !== prev.current) {
      setFlash(q.price > prev.current ? 'up' : 'down')
      const t = setTimeout(() => setFlash(''), 450)
      prev.current = q.price
      return () => clearTimeout(t)
    }
    prev.current = q?.price
  }, [q?.price])
  return (
    <button className={`wl-row ${active ? 'active' : ''}`} onClick={onSelect}>
      <div className="wl-id">
        <div className="wl-sym">
          {inst.symbol}
          {signal && <RobotIcon side={signal.side} size={14} title={`Latest robot signal: ${signal.side.toUpperCase()}`} />}
        </div>
        <div className="wl-name">
          {inst.name}
          {q && !q.live && <span className="badge-demo">SIM</span>}
        </div>
      </div>
      <Sparkline data={q?.spark ?? []} width={48} />
      <div className="wl-px">
        <div className={`wl-price mono flash-${flash}`}>{q ? fmtPrice(q.price) : '—'}</div>
        <div className={`wl-chg mono ${tone(q?.changePct ?? 0)}`}>{q ? fmtPct(q.changePct) : ''}</div>
      </div>
    </button>
  )
}

export function Watchlist({ instruments, quotes, active, onSelect, onAdd, activeSignal }: Props) {
  const [filter, setFilter] = useState('')
  const [tab, setTab] = useState<'all' | 'crypto' | 'stock'>('all')
  const list = instruments.filter(
    (i) => (tab === 'all' || i.assetClass === tab) && (i.symbol + i.name).toLowerCase().includes(filter.toLowerCase()),
  )
  const taken = useMemo(() => new Set(instruments.map((i) => i.symbol)), [instruments])
  const matches = useMemo(() => suggest(filter, taken), [filter, taken])
  const totalVol = Object.values(quotes).reduce((a, q) => a + (q.live ? q.volume : 0), 0)
  return (
    <aside className="panel watchlist">
      <div className="panel-head">
        <span>Watchlist</span>
        <span className="muted mono">{totalVol ? `24h vol ${fmtCompact(totalVol)}` : ''}</span>
      </div>
      <div className="search-wrap">
        <input className="search" placeholder="Search symbol or name" value={filter} onChange={(e) => setFilter(e.target.value)} />
        {matches.length > 0 && (
          <div className="suggest">
            {matches.map((c) => (
              <button
                key={c.symbol}
                className="suggest-row"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onAdd(toInstrument(c))
                  onSelect(c.symbol)
                  setFilter('')
                }}
              >
                <span className="mono">{c.symbol}</span>
                <span className="muted">{c.name}</span>
                <span className="suggest-tag">{c.assetClass === 'crypto' ? 'Crypto' : 'Stock'} +</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="seg small">
        {(['all', 'crypto', 'stock'] as const).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t === 'all' ? 'All' : t === 'crypto' ? 'Crypto' : 'Stocks'}
          </button>
        ))}
      </div>
      <div className="wl-list">
        {list.map((i) => (
          <Row key={i.symbol} inst={i} q={quotes[i.symbol]} active={i.symbol === active} onSelect={() => onSelect(i.symbol)} signal={i.symbol === active ? activeSignal : null} />
        ))}
      </div>
    </aside>
  )
}
