import { useEffect, useMemo, useRef, useState } from 'react'
import type { Instrument, Quote, Signal } from '../types'
import { fmtCompact, fmtPct, fmtPrice, tone } from '../lib/format'
import { Sparkline } from './Sparkline'
import { RobotIcon } from './RobotIcon'
import { CATALOG, toInstrument } from '../data/catalog'
import { loadPicks, PICKS_EVENT, type Pick } from '../lib/picks'
import { useSyncExternalStore } from 'react'
import { useLang, useT } from '../lib/i18n'
import { useMarketLists } from '../hooks/useMarketLists'
import type { AlpacaDataKeys, MarketListRow } from '../data/providers'

/** One market practice mode is trading, closed today, or watching. */
export interface AiActiveRow {
  symbol: string
  status: 'trade' | 'closed' | 'watching'
  kind?: 'day' | 'long'
  entry?: number
  qty?: number
  pnl?: number
  place?: number
  gainPct?: number | null
}

interface Props {
  /** Pinned "AI active" list; null hides it. */
  aiActive: AiActiveRow[] | null
  instruments: Instrument[]
  quotes: Record<string, Quote>
  active: string
  onSelect: (symbol: string) => void
  onAdd: (inst: Instrument) => void
  activeSignal: Signal | null
  alpacaKeys: AlpacaDataKeys
  /** Bumped to open the live Top gainers list (from the Jarvis Brief scanner). */
  sortRequest?: number
}

type ListSort = 'gainers' | 'losers' | 'volume' | 'most_active' | 'new_highs'

function listInstrument(r: MarketListRow): Instrument {
  const known = CATALOG.find((c) => c.symbol === r.symbol)
  return {
    ...toInstrument(known ?? { symbol: r.symbol, name: r.symbol.replace('/USDT', ''), assetClass: r.assetClass }),
    demoPrice: r.price,
  }
}

function MarketRow({ r, sort, active, onSelect }: { r: MarketListRow; sort: ListSort; active: boolean; onSelect: () => void }) {
  const lang = useLang()
  const L = (en: string, vi: string) => (lang === 'vi' ? vi : en)
  const name = CATALOG.find((c) => c.symbol === r.symbol)?.name
  return (
    <button className={`wl-row ${active ? 'active' : ''}`} onClick={onSelect}>
      <div className="wl-id">
        <div className="wl-sym">{r.symbol}</div>
        <div className="wl-name">{name ?? (r.assetClass === 'crypto' ? L('Crypto · 24h', 'Crypto · 24 giờ') : L('US stock · today', 'Cổ phiếu Mỹ · hôm nay'))}</div>
      </div>
      <span className="wl-vol mono muted">{sort === 'volume' && r.dollarVolume ? `$${fmtCompact(r.dollarVolume)}` : ''}</span>
      <div className="wl-px">
        <div className="wl-price mono">{fmtPrice(r.price)}</div>
        <div className={`wl-chg mono ${tone(r.changePct)}`}>{fmtPct(r.changePct)}</div>
      </div>
    </button>
  )
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

function AiActive({ rows, quotes, active, onSelect }: { rows: AiActiveRow[]; quotes: Record<string, Quote>; active: string; onSelect: (s: string) => void }) {
  const lang = useLang()
  const L = (en: string, vi: string) => (lang === 'vi' ? vi : en)
  const money = (x: number) => `${x >= 0 ? '+' : '−'}$${Math.abs(x).toFixed(2)}`
  return (
    <div className="ai-active">
      <div className="ai-active-head">
        <span>🎯 {L('AI active', 'AI đang hoạt động')}</span>
        <span className="muted">{rows.length ? L('practice · paper', 'luyện tập · thử') : ''}</span>
      </div>
      {rows.length === 0 && <p className="muted ai-active-empty">{L('Nothing yet. Picks and practice trades show up here on their own.', 'Chưa có gì. Mã được chọn và lệnh luyện tập sẽ tự hiện ở đây.')}</p>}
      {rows.map((r) => {
        // simulated quotes never show as practice P&L
        const px = quotes[r.symbol]?.live ? quotes[r.symbol].price : undefined
        const live = r.status === 'trade' && px && r.entry != null && r.qty != null ? (px - r.entry) * r.qty : null
        const pnl = r.status === 'closed' ? r.pnl ?? null : live
        const badge =
          r.status === 'trade'
            ? r.kind === 'long'
              ? L('In trade · long', 'Đang giữ · dài hạn')
              : L('In trade · day', 'Đang giữ · trong ngày')
            : r.status === 'closed'
              ? L('Closed today', 'Đã đóng hôm nay')
              : `${L('Watching', 'Theo dõi')}${r.place ? ` #${r.place}` : ''}`
        return (
          <button key={r.symbol} className={`ai-row ${r.status} ${active === r.symbol ? 'active' : ''}`} onClick={() => onSelect(r.symbol)}>
            <span className="ai-sym">{r.symbol}</span>
            <span className={`ai-badge ${r.status}`}>{badge}</span>
            <span className={`ai-pnl mono ${pnl == null ? 'muted' : pnl >= 0 ? 'up' : 'down'}`}>
              {pnl != null ? money(pnl) : r.gainPct != null ? `${r.gainPct >= 0 ? '+' : ''}${r.gainPct.toFixed(1)}%` : px ? fmtPrice(px) : '—'}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function Watchlist({ aiActive, instruments, quotes, active, onSelect, onAdd, activeSignal, alpacaKeys, sortRequest = 0 }: Props) {
  const tx = useT()
  const lang = useLang()
  const L = (en: string, vi: string) => (lang === 'vi' ? vi : en)
  const [filter, setFilter] = useState('')
  const [tab, setTab] = useState<'all' | 'crypto' | 'stock'>('all')
  const [sort, setSort] = useState<'default' | 'gainers' | 'losers' | 'volume' | 'most_active' | 'new_highs' | 'success'>(sortRequest ? 'gainers' : 'default')
  useEffect(() => {
    if (sortRequest) setSort('gainers')
  }, [sortRequest])
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
  const marketWide = sort === 'gainers' || sort === 'losers' || sort === 'volume' || sort === 'most_active' || sort === 'new_highs'
  // top gainers / losers / volume come from the whole market, never from the watchlist
  const lists = useMarketLists(marketWide, alpacaKeys)
  const marketRows = useMemo(() => {
    if (!marketWide) return []
    const metric = (r: MarketListRow) =>
      sort === 'gainers' ? r.changePct : sort === 'losers' ? -r.changePct : sort === 'most_active' || sort === 'volume' ? r.dollarVolume ?? 0 : sort === 'new_highs' ? r.price : 0
    const pick = (l: typeof lists.crypto) => (l && marketWide ? (l[sort] ?? []) : [])
    const rows = [...(tab !== 'crypto' ? pick(lists.stocks) : []), ...(tab !== 'stock' ? pick(lists.crypto) : [])]
    const q = filter.toLowerCase()
    return rows.filter((r) => r.symbol.toLowerCase().includes(q)).sort((a, b) => metric(b) - metric(a)).slice(0, 25)
  }, [marketWide, sort, tab, filter, lists.crypto, lists.stocks])
  const list = useMemo(() => {
    if (sort !== 'success') return filtered
    const won = (i: Instrument) => picksBySymbol.get(i.symbol)?.winRate ?? -1
    return [...filtered].sort((a, b) => won(b) - won(a))
  }, [filtered, sort, picksBySymbol])
  const taken = useMemo(() => new Set(instruments.map((i) => i.symbol)), [instruments])
  const matches = useMemo(() => suggest(filter, taken), [filter, taken])
  const totalVol = Object.values(quotes).reduce((a, q) => a + (q.live ? q.volume : 0), 0)
  return (
    <aside className="panel watchlist">
      {aiActive && <AiActive rows={aiActive} quotes={quotes} active={active} onSelect={onSelect} />}
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
        {(['default', 'gainers', 'losers', 'volume', 'most_active', 'new_highs', 'success'] as const).map((s) => (
          <button key={s} className={sort === s ? 'on' : ''} onClick={() => setSort(s)}>
            {s === 'default'
              ? tx('sortDefault')
              : s === 'gainers'
                ? tx('sortGainers')
                : s === 'losers'
                  ? tx('sortLosers')
                  : s === 'volume'
                    ? tx('sortVolume')
                    : s === 'most_active'
                      ? L('Most active', 'Giao dịch nhất')
                      : s === 'new_highs'
                        ? L('New highs', 'Đỉnh mới')
                        : tx('sortSuccess')}
          </button>
        ))}
      </div>
      {sort === 'success' && (
        <p className="muted small">
          {picksBySymbol.size === 0
            ? tx('scanFirst')
            : tx('successFromScan')}
        </p>
      )}
      {marketWide && (
        <div className="wl-market-note small">
          {lists.updatedAt && marketRows.length > 0 ? (
            <span className={lists.updatedAt === lists.staledAt && !lists.loading ? 'stale-note' : 'live-note'}>
              {lists.updatedAt === lists.staledAt && !lists.loading ? '○' : '●'} {lists.updatedAt === lists.staledAt && !lists.loading ? L('Last session · market closed', 'Phiên trước · market đóng') : L('Live, whole market', 'Trực tiếp, toàn thị trường')} · {new Date(lists.updatedAt).toLocaleTimeString()}
            </span>
          ) : lists.loading ? (
            <span className="muted">{L('Loading the live market list…', 'Đang tải danh sách trực tiếp…')}</span>
          ) : null}
          {tab !== 'crypto' && lists.stocksNeedKey && (
            <span className="warn">{L('No live stock list yet: add an Alpaca paper key on the Portfolio page.', 'Chưa có dữ liệu cổ phiếu trực tiếp, cần key Alpaca paper ở trang Danh mục.')}</span>
          )}
          {tab !== 'crypto' && lists.stockError && <span className="warn">{L('Stocks', 'Cổ phiếu')}: {lists.stockError}</span>}
          {tab !== 'stock' && lists.cryptoError && <span className="warn">Crypto: {lists.cryptoError}</span>}
        </div>
      )}
      <div className="wl-list">
        {marketWide &&
          marketRows.map((r) => (
            <MarketRow
              key={r.symbol}
              r={r}
              sort={sort as ListSort}
              active={r.symbol === active}
              onSelect={() => {
                if (!taken.has(r.symbol)) onAdd(listInstrument(r))
                onSelect(r.symbol)
              }}
            />
          ))}
        {!marketWide && list.map((i) => (
          <Row key={i.symbol} inst={i} q={quotes[i.symbol]} active={i.symbol === active} onSelect={() => onSelect(i.symbol)} signal={i.symbol === active ? activeSignal : null} />
        ))}
      </div>
    </aside>
  )
}
