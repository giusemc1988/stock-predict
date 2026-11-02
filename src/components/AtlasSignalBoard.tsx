import { useCallback, useEffect, useMemo, useState } from 'react'
import { atlasSignals, atlasVerdict, BLOCK_LABEL, LAB, LEARN_GOAL, learnProgress, TRUST_MIN, whyToday, type Signal } from '../lib/atlasSignals'
import { fmtUsd } from '../lib/format'
import { useLang } from '../lib/i18n'
import { dayKey, parsePractice, type PracticeState } from '../lib/practice'
import { pickSourceLabel } from '../lib/practicePicks'
import type { LeadsReport } from '../lib/shadowLeads'
import { AtlasIdeaFactory } from './AtlasIdeaFactory'
import './AtlasSignalBoard.css'

type Bi = { en: string; vi: string }

const T = {
  whereTitle: { en: 'Where is Atlas?', vi: 'Atlas đang ở đâu?' },
  whereHow: { en: 'One honest answer: does Atlas have an edge yet, and what should you do.', vi: 'Một câu trả lời thật: Atlas đã có lợi thế chưa, và anh nên làm gì.' },
  refresh: { en: 'Refresh', vi: 'Làm mới' },
  refreshSafe: { en: 'Only loads the latest numbers. Deletes nothing.', vi: 'Chỉ tải số mới, không xóa gì.' },
  refreshing: { en: 'Refreshing…', vi: 'Đang làm mới…' },
  details: { en: 'Details', vi: 'Chi tiết' },
  learnTitle: { en: 'What is Atlas learning?', vi: 'Atlas đang học gì?' },
  learnHow: {
    en: 'Atlas shadow-runs 6 tests on new trades (no money placed). Goal: find one way in that beats random buying after costs.',
    vi: 'Atlas chạy "bóng" 6 bài kiểm tra trên lệnh mới (không đặt tiền). Mục tiêu: tìm 1 cách vào lệnh thắng hơn mua ngẫu nhiên sau phí.',
  },
  toReview: { en: 'to {d}', vi: 'đến {d}' },
  goal: { en: 'Goal: {n} new trades per test, graded on {d}.', vi: 'Đích: {n} lệnh mới mỗi bài, chấm điểm ngày {d}.' },
  left: { en: '{n} days left', vi: 'còn {n} ngày' },
  lead: { en: 'Most data so far: {t}', vi: 'Nhiều dữ liệu nhất: {t}' },
  noLead: { en: 'No test has data yet: the first trades arrive after the next US close.', vi: 'Chưa bài nào có dữ liệu: lệnh đầu tiên về sau phiên Mỹ đóng cửa tới.' },
  labLine: {
    en: 'Replay labs: {t} ideas tried, {p} passed. Strongest lead in shadow: {b} (DSR {d} of {need} needed). After {r}: a test that beats random goes to you to switch on; one that does not is dropped.',
    vi: 'Phòng lab: đã thử {t} ý tưởng, {p} đạt. Hướng mạnh nhất đang chạy bóng: {b} (DSR {d}, cần {need}). Sau {r}: bài nào thắng ngẫu nhiên thì hỏi anh bật thật; bài nào không thì bỏ.',
  },
  loadingLearn: { en: 'Loading the shadow tests…', vi: 'Đang tải các bài kiểm tra…' },
  learnErr: { en: 'Shadow tests not loaded ({e}). Showing what this device has.', vi: 'Chưa tải được bài kiểm tra ({e}). Đang hiện dữ liệu trên máy này.' },
  sigTitle: { en: 'Signals', vi: 'Tín hiệu' },
  sigHow: {
    en: 'Trades Atlas really took: entry, target (TP), stop (SL), and the real win rate of this kind of signal in Atlas’s own record.',
    vi: 'Lệnh Atlas thật sự vào: giá vào, chốt lời (TP), cắt lỗ (SL), và % thắng thật của loại tín hiệu này trong lịch sử của Atlas.',
  },
  more: { en: '+{n} more closed on {d} (Trading desk > Practice)', vi: '+{n} lệnh khác đã đóng ngày {d} (xem ở Trading > Luyện tập)' },
  noSig: { en: 'No open signal and none closed on {d}.', vi: 'Không có tín hiệu đang mở, và không có lệnh nào đóng ngày {d}.' },
  entry: { en: 'Entry', vi: 'Vào' },
  open: { en: 'open', vi: 'đang mở' },
  won: { en: 'won {p}', vi: 'thắng {p}' },
  lost: { en: 'lost {p}', vi: 'thua {p}' },
  day: { en: 'Day trade', vi: 'Trong ngày' },
  long: { en: 'Held for days', vi: 'Giữ dài' },
  chart: { en: 'own chart', vi: 'biểu đồ' },
  wins: { en: 'Won {p}%', vi: 'Thắng {p}%' },
  noRec: { en: 'No past trade of this kind yet', vi: 'Chưa có lệnh cũ cùng loại' },
  trades: { en: '{n} trades', vi: '{n} lệnh' },
  thin: { en: 'Too few trades to trust (needs {n}).', vi: 'Quá ít lệnh để tin (cần {n}).' },
  tpAvg: { en: 'Reached TP {tp}% · average {a}/trade after costs.', vi: 'Chạm TP {tp}% · trung bình {a}/lệnh sau phí.' },
  whyTitle: { en: 'Why does Atlas trade some times and not others?', vi: 'Vì sao lúc vào lệnh, lúc không?' },
  whyHow: { en: 'Every 5 minutes Atlas checks its markets. These are the reasons from its last session ({d}).', vi: 'Mỗi 5 phút Atlas xét các mã. Đây là lý do của phiên gần nhất ({d}).' },
  checks: { en: 'checks', vi: 'lần xét' },
  bought: { en: 'trades', vi: 'vào lệnh' },
  blocked: { en: 'blocked: {w}', vi: 'bị chặn: {w}' },
  noWhy: { en: 'No decision logged yet.', vi: 'Chưa có quyết định nào được ghi.' },
  practice: { en: 'Practice money only. Nothing here is advice.', vi: 'Chỉ là tiền tập. Không phải lời khuyên đầu tư.' },
} satisfies Record<string, Bi>
type TKey = keyof typeof T

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const money = (x: number) => `${x < 0 ? '−' : '+'}$${Math.abs(x).toFixed(2)}`
const pct = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(1)}%`

/** Progress ring in the hub theme: --robot is the agent's accent inside AgentShell. */
function LearnRing({ v, top, sub }: { v: number; top: string; sub: string }) {
  const r = 44
  const c = 2 * Math.PI * r
  return (
    <svg className="asb-ring" viewBox="0 0 104 104" role="img" aria-label={`${top} ${sub}`}>
      <circle cx="52" cy="52" r={r} className="asb-ring-bg" />
      <circle cx="52" cy="52" r={r} className="asb-ring-fg" strokeDasharray={`${Math.max(0.02, Math.min(1, v / 100)) * c} ${c}`} transform="rotate(-90 52 52)" />
      <text x="52" y="50" textAnchor="middle" className="asb-ring-v">
        {top}
      </text>
      <text x="52" y="68" textAnchor="middle" className="asb-ring-s">
        {sub}
      </text>
    </svg>
  )
}

/**
 * Atlas's signal board, at the top of its page: an honest verdict with one big Refresh button, what it is
 * learning and how far toward the review day, each signal with entry/TP/SL and the real win rate of its
 * kind, and why it traded or not. Display only: it never places, changes or blocks a trade.
 */
export function AtlasSignalBoard({ practice, onSymbol, ideas = true }: { practice: PracticeState; onSymbol?: (symbol: string, asset: 'stock' | 'crypto') => void; ideas?: boolean }) {
  const vi = useLang() === 'vi'
  const L = (b: Bi) => (vi ? b.vi : b.en)
  const G = (k: TKey, vars?: Record<string, string | number>) => Object.entries(vars ?? {}).reduce<string>((s, [a, b]) => s.replaceAll(`{${a}}`, String(b)), L(T[k]))
  const [leads, setLeads] = useState<LeadsReport | null>(null)
  const [fresh, setFresh] = useState<PracticeState | null>(null)
  const [busy, setBusy] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async (withState: boolean) => {
    setBusy(true)
    setErr(null)
    try {
      const [lr, sr] = await Promise.all([
        fetch(`/api/practice/learning?t=${Date.now()}`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
        withState ? fetch(`/api/practice/state?t=${Date.now()}`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null) : Promise.resolve(null),
      ])
      setLeads((lr as { leads?: LeadsReport }).leads ?? null)
      const st = sr ? parsePractice((sr as { state?: unknown }).state) : null
      if (st) setFresh(st)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setNow(Date.now())
      setBusy(false)
    }
  }, [])
  useEffect(() => {
    void load(false)
  }, [load])

  // the newer of the app's copy and the one just fetched
  const s = fresh && (fresh.server?.lastRun ?? 0) >= (practice.server?.lastRun ?? 0) ? fresh : practice
  const verdict = useMemo(() => atlasVerdict(s.trades), [s.trades])
  const prog = useMemo(() => learnProgress(s.trades, leads, now), [s.trades, leads, now])
  const why = useMemo(() => whyToday(s, dayKey), [s])
  const sigDay = why.day ?? dayKey(now)
  const sigs = useMemo(() => atlasSignals(s, sigDay, dayKey), [s, sigDay])
  // every open signal, then the last 3 closed on that day
  const shown = [...sigs.filter((g) => g.status === 'open'), ...sigs.filter((g) => g.status !== 'open').slice(0, 3)]

  const sigCard = (g: Signal) => {
    const st = g.stats
    const kindLbl = g.kind === 'long' ? G('long') : G('day')
    const src = g.source === 'chart' ? G('chart') : L(pickSourceLabel[g.source as keyof typeof pickSourceLabel])
    const status = g.status === 'open' ? G('open') : G(g.status === 'win' ? 'won' : 'lost', { p: money(g.pnl ?? 0) })
    const wrTone = st.winRate == null ? '' : st.winRate >= 50 ? 'up' : 'gold'
    return (
      <div key={g.id} className={`asb-sig s-${g.status}`}>
        <div className="asb-sig-top">
          <button className="asb-sym mono" onClick={() => onSymbol?.(g.symbol, g.symbol.includes('/') ? 'crypto' : 'stock')}>
            {g.symbol}
          </button>
          <span className={`asb-tag s-${g.status}`}>
            {kindLbl} · {src} · {status}
          </span>
        </div>
        <div className="asb-lv">
          <div>
            <small>{G('entry')}</small>
            <b className="mono">{fmtUsd(g.entry)}</b>
          </div>
          <div>
            <small>TP</small>
            <b className="mono up">{fmtUsd(g.tp)}</b>
            <em className="mono up">{pct(g.tpPct)}</em>
          </div>
          <div>
            <small>SL</small>
            <b className="mono down">{fmtUsd(g.sl)}</b>
            <em className="mono down">{pct(g.slPct)}</em>
          </div>
        </div>
        {st.n ? (
          <>
            <div className="asb-wr">
              <span>{G('wins', { p: st.winRate ?? 0 })}</span>
              <div className="asb-bar">
                <i className={wrTone} style={{ width: `${st.winRate ?? 0}%` }} />
              </div>
              <span className="muted mono">{G('trades', { n: st.n })}</span>
            </div>
            <p className={`asb-note${st.thin ? ' warn' : ''}`}>{st.thin ? `⚠ ${G('thin', { n: TRUST_MIN })}` : G('tpAvg', { tp: st.tpRate ?? 0, a: money(st.avgPnl ?? 0) })}</p>
          </>
        ) : (
          <p className="asb-note warn">⚠ {G('noRec')}</p>
        )}
      </div>
    )
  }

  return (
    <div className="asb" id="atlas-signals">
      <section className="bf-card asb-where">
        <header>
          <h3>{G('whereTitle')}</h3>
        </header>
        <p className="bf-source">{G('whereHow')}</p>
        <div className="asb-verdict">
          <span className={`asb-dot l-${verdict.level}`} aria-hidden="true" />
          <div>
            <b>{L(verdict.title)}</b>
            <p className="muted">{L(verdict.line)}</p>
          </div>
        </div>
        <button className="btn prime asb-big" onClick={() => void load(true)} disabled={busy} aria-busy={busy}>
          {busy ? G('refreshing') : `↻ ${G('refresh')}`}
        </button>
        <p className="asb-safe muted small">{G('refreshSafe')}</p>
        {busy && <div className="asb-progress" role="progressbar" aria-label={G('refreshing')}><i /></div>}
        <details className="asb-more">
          <summary>{G('details')}</summary>
          <p>
            PF {verdict.pf ?? '—'} · {vi ? 'lãi gộp' : 'gross'} {verdict.gross != null ? money(verdict.gross) : '—'} · {vi ? 'phí' : 'costs'} {verdict.costs != null ? `$${verdict.costs.toFixed(2)}` : '—'} ·{' '}
            {vi ? 'ròng' : 'net'} {money(verdict.net)}
          </p>
          <p>{G('practice')}</p>
        </details>
      </section>

      <section className="bf-card asb-learn" id="atlas-learn">
        <header>
          <h3>🎓 {G('learnTitle')}</h3>
        </header>
        <p className="bf-source">{G('learnHow')}</p>
        <div className="asb-ringrow">
          <LearnRing v={prog.pct} top={`${prog.pct}%`} sub={G('toReview', { d: ddmm(prog.reviewDay) })} />
          <div className="asb-goal">
            <p>{G('goal', { n: LEARN_GOAL, d: ddmm(prog.reviewDay) })}</p>
            <p className="muted">{G('left', { n: prog.daysLeft })}</p>
            <p className="muted">{prog.lead ? G('lead', { t: L(prog.lead.label) }) : G('noLead')}</p>
          </div>
        </div>
        {busy && !leads && <p className="muted small">{G('loadingLearn')}</p>}
        {err && <p className="warn small">{G('learnErr', { e: err })}</p>}
        <ul className="asb-tests">
          {prog.tests.map((t) => (
            <li key={t.id} title={L(t.what)}>
              <div className="asb-t">
                <span>{L(t.label)}</span>
                <span className="mono muted">
                  {t.n}/{t.goal}
                  {t.unit === 'days' ? (vi ? ' ngày' : ' days') : ''}
                </span>
              </div>
              <div className="asb-bar">
                <i style={{ width: `${t.pct}%` }} />
              </div>
              <small className="muted">{L(t.what)}</small>
            </li>
          ))}
        </ul>
        <details className="asb-more">
          <summary>{G('details')}</summary>
          <p>{G('labLine', { t: LAB.trials, p: LAB.passed, b: L(LAB.best), d: LAB.bestDsr, need: LAB.needDsr, r: ddmm(prog.reviewDay) })}</p>
          {leads?.vi?.length ? <p className="mono small">{leads.vi.join(' · ')}</p> : null}
        </details>
      </section>

      <section className="bf-card asb-sigs">
        <header>
          <h3>📡 {G('sigTitle')}</h3>
          <span className="muted small">{ddmm(sigDay)}</span>
        </header>
        <p className="bf-source">{G('sigHow')}</p>
        {sigs.length ? <div className="asb-siglist">{shown.map(sigCard)}</div> : <p className="muted">{G('noSig', { d: ddmm(sigDay) })}</p>}
        {sigs.length > shown.length && <p className="asb-note">{G('more', { n: sigs.length - shown.length, d: ddmm(sigDay) })}</p>}
      </section>

      {/* the idea factory next to the book signals: same layout, its own record (AI rule ideaFactory) */}
      {ideas && <AtlasIdeaFactory trades={s.trades} onSymbol={onSymbol} />}

      <section className="bf-card asb-why">
        <header>
          <h3>❓ {G('whyTitle')}</h3>
        </header>
        <p className="bf-source">{G('whyHow', { d: why.day ? ddmm(why.day) : '—' })}</p>
        {why.decisions ? (
          <div className="asb-whyrow">
            <div>
              <b className="mono">{why.decisions}</b>
              <small>{G('checks')}</small>
            </div>
            <div>
              <b className="mono up">{why.accepted}</b>
              <small>{G('bought')}</small>
            </div>
            {why.blocked.slice(0, 3).map((b) => (
              <div key={b.by}>
                <b className="mono down">{b.n}</b>
                <small>{G('blocked', { w: BLOCK_LABEL[b.by] ? L(BLOCK_LABEL[b.by]) : b.by })}</small>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">{G('noWhy')}</p>
        )}
      </section>
    </div>
  )
}
