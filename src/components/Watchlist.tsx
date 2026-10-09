import { useEffect, useMemo, useRef, useState } from 'react'
import type { Instrument, Quote, Signal } from '../types'
import { fmtCompact, fmtPct, fmtPrice, tone } from '../lib/format'
import { Sparkline } from './Sparkline'
import { RobotIcon } from './RobotIcon'
import { CATALOG, toInstrument } from '../data/catalog'
import { loadPicks, PICKS_EVENT, SMALL_SAMPLE, type Pick } from '../lib/picks'
import { useSyncExternalStore } from 'react'
import { useT } from '../lib/i18n'

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
  const tx = useT()
  const [filter, setFilter] = useState('')
  const [tab, setTab] = useState<'all' | 'crypto' | 'stock'>('all')
  const [sort, setSort] = useState<'default' | 'gainers' | 'losers' | 'volume' | 'success'>('default')
  // last AI Picks scan, from browser storage; re-read whenever a new scan is saved
  const picks = useSyncExternalStore(
    (cb) => {
      window.addEventListener(PICKS_EVENT, cb)
      return () => window.removeEventListener(PICKS_EVENT, cb)
    },
    () => JSON.stringify(loadPicks()),
  )
  const picksBySymbol = useMemo(() => new Map((JSON.parse(picks) as Pick[]).map((p) => [p.symbol, p])), [picks])
  const filtered = instruments.filter(
    (i) => (tab === 'all' || i.assetClass === tab) && (i.symbol + i.name).toLowerCase().includes(filter.toLowerCase()),
  )
  const list = useMemo(() => {
    if (sort === 'default') return filtered
    const won = (i: Instrument) => picksBySymbol.get(i.symbol)?.winRate ?? -1
    if (sort === 'success') return [...filtered].sort((a, b) => won(b) - won(a))
    const chg = (i: Instrument) => quotes[i.symbol]?.changePct ?? 0
    const vol = (i: Instrument) => quotes[i.symbol]?.volume ?? 0
    const sorted = [...filtered]
    if (sort === 'gainers') sorted.sort((a, b) => chg(b) - chg(a))
    if (sort === 'losers') sorted.sort((a, b) => chg(a) - chg(b))
    if (sort === 'volume') sorted.sort((a, b) => vol(b) - vol(a))
    return sorted
  }, [filtered, sort, quotes, picksBySymbol])
  const taken = useMemo(() => new Set(instruments.map((i) => i.symbol)), [instruments])
  const matches = useMemo(() => suggest(filter, taken), [filter, taken])
  const totalVol = Object.values(quotes).reduce((a, q) => a + (q.live ? q.volume : 0), 0)
  return (
    <aside className="panel watchlist">
      <div className="panel-head">
        <span>{tx('watchlist')}</span>
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
            {t === 'all' ? tx('all') : t === 'crypto' ? tx('crypto') : tx('stocks')}
          </button>
        ))}
      </div>
      <div className="seg small">
        {(['default', 'gainers', 'losers', 'volume', 'success'] as const).map((s) => (
          <button key={s} className={sort === s ? 'on' : ''} onClick={() => setSort(s)}>
            {s === 'default' ? tx('sortDefault') : s === 'gainers' ? tx('sortGainers') : s === 'losers' ? tx('sortLosers') : s === 'volume' ? tx('sortVolume') : tx('sortSuccess')}
          </button>
        ))}
      </div>
      {sort === 'success' && (
        <p className="muted small">
          {picksBySymbol.size === 0
            ? 'Run "Scan my list" in the AI Picks tab first.'
            : `Past win rate from the last AI Picks scan. Under ${SMALL_SAMPLE} trades is noise. Not financial advice.`}
        </p>
      )}
      <div className="wl-list">
        {list.map((i) => (
          <Row key={i.symbol} inst={i} q={quotes[i.symbol]} active={i.symbol === active} onSelect={() => onSelect(i.symbol)} signal={i.symbol === active ? activeSignal : null} />
        ))}
      </div>
    </aside>
  )
}
