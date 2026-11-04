import { useCallback, useEffect, useRef, useState } from 'react'
import { useLang } from '../lib/i18n'
import { requestRun } from '../lib/hubRuns'
import type { PracticeTrade } from '../lib/practice'
import { duel, type FactoryReport, type FactorySignalView } from '../lib/ideaFactoryView'
import { fmtUsd } from '../lib/format'
import './AtlasSignalBoard.css'

type Bi = { en: string; vi: string }

const T = {
  title: { en: 'Idea factory: Atlas thinks for itself', vi: 'Xưởng ý tưởng: Atlas tự nghĩ' },
  how: {
    en: 'Atlas invents its own rules from 30 Claude Opus ideas, tests them on years it never saw, and logs a signal when one fires. Signals refresh by themselves after each US close; "Run the factory" looks for new rules (about 10 min). Paper only.',
    vi: 'Atlas tự nghĩ luật từ 30 ý tưởng của Claude Opus, thi trên những năm chưa từng thấy, và ghi tín hiệu khi luật báo mua. Tín hiệu tự làm mới sau mỗi phiên Mỹ đóng cửa; "Chạy xưởng" để tìm luật mới (khoảng 10 phút). Chỉ giấy.',
  },
  book: { en: '📚 Book (Atlas now)', vi: '📚 Sách vở (Atlas hiện tại)' },
  opus: { en: '🧠 Opus, self-made', vi: '🧠 Opus tự nghĩ' },
  real: { en: '{n} real trades', vi: '{n} lệnh thật' },
  graded: { en: '{n} signals graded', vi: '{n} tín hiệu đã chấm' },
  vaultHint: { en: 'vault (old data): {p}% of {n}', vi: 'két khóa (dữ liệu cũ): {p}% / {n} lệnh' },
  noScore: { en: 'no graded signals yet', vi: 'chưa có tín hiệu nào được chấm' },
  ahead: { en: '{w} is ahead for now, but {m} graded signals are too few to trust (need {need}).', vi: '{w} đang dẫn, nhưng {m} tín hiệu đã chấm còn quá ít để tin (cần {need}).' },
  aheadOk: { en: '{w} is ahead.', vi: '{w} đang dẫn.' },
  tie: { en: 'Too early to tell: the factory needs graded signals first.', vi: 'Còn quá sớm: xưởng cần có tín hiệu được chấm trước.' },
  run: { en: 'Run the factory', vi: 'Chạy xưởng' },
  running: { en: 'Running on GitHub (about 10 min)…', vi: 'Đang chạy trên GitHub (khoảng 10 phút)…' },
  runSafe: { en: 'Only adds new results; nothing is deleted and nothing trades.', vi: 'Chỉ thêm kết quả mới; không xóa gì, không trade.' },
  sigTitle: { en: 'Factory signals from the close of {d}', vi: 'Tín hiệu của xưởng từ phiên đóng cửa {d}' },
  noSig: { en: 'No factory rule fired on the last close.', vi: 'Không luật nào của xưởng báo mua ở phiên gần nhất.' },
  days: { en: 'hold {n} days', vi: 'giữ {n} ngày' },
  nSig: { en: '{n} stocks', vi: '{n} mã' },
  similar: { en: '+{n} similar rule(s) fired on the same stocks (see Details).', vi: '+{n} luật tương tự báo cùng các mã này (xem Chi tiết).' },
  funnel: { en: 'This run: {t} new rules → {d} looked good on 2008-2017 → {v} held on 2018-2022 → {k} passed the vault.', vi: 'Lần này: {t} luật mới → {d} tốt trên 2008-2017 → {v} vẫn đứng trên 2018-2022 → {k} qua két khóa.' },
  counter: { en: 'Trial counter: {total} ideas judged on the recent years ({l} by the labs, {v} factory rules that reached the vault). The factory also tried {f} rules on the old years only; those cannot be lucky in the vault, so they do not raise its bar. More ideas judged = a higher bar, so a lucky rule cannot slip through.', vi: 'Bộ đếm lượt thử: {total} ý tưởng đã thi trên dữ liệu những năm gần đây ({l} của các lab, {v} luật của xưởng vào tới két). Xưởng còn thử {f} luật chỉ trên dữ liệu cũ; chúng không thể "ăn may" trong két nên không làm vạch đỗ cao thêm. Càng nhiều ý tưởng thi thì vạch đỗ càng cao, nên luật "ăn may" không lọt được.' },
  honest: { en: 'Honest note: none of these rules passed the vault yet, so the signals are a live test, not advice.', vi: 'Nói thật: chưa luật nào qua két khóa, nên các tín hiệu này là bài thi thật, không phải lời khuyên.' },
  passedNote: { en: '{n} rule(s) passed the vault. Still paper only: switching any on needs your OK.', vi: '{n} luật đã qua két khóa. Vẫn chỉ giấy: bật thật cần anh OK.' },
  rulesNow: { en: 'Rules making the signals', vi: 'Các luật đang ra tín hiệu' },
  details: { en: 'Details', vi: 'Chi tiết' },
  slotsTitle: { en: 'Strategy slots: live paper results decide', vi: 'Ô chiến lược: kết quả chạy thật (giấy) quyết định' },
  slotsHow: { en: 'Many rules trade on paper side by side, even ones the old tests rejected. After 20 graded signals a rule is called working (wins 55%+ and average above 0) or failing.', vi: 'Nhiều luật chạy giấy song song, cả luật bài kiểm tra cũ đã loại. Sau 20 tín hiệu được chấm: thắng từ 55% và lãi TB dương thì "đáng tin", không thì "loại".' },
  slotTesting: { en: 'testing', vi: 'đang thử' },
  slotWorking: { en: 'working', vi: 'đáng tin' },
  slotFailing: { en: 'failing', vi: 'loại' },
  slotRow: { en: '{g} graded, {w}% wins, avg {a}%, {x} waiting', vi: '{g} đã chấm, thắng {w}%, TB {a}%, {x} đang chờ' },
  none: { en: 'The factory has not run yet. Tap "Run the factory".', vi: 'Xưởng chưa chạy lần nào. Bấm "Chạy xưởng".' },
  last: { en: 'Last run {d} (run #{r}, {s} s).', vi: 'Lần chạy gần nhất {d} (lần #{r}, {s} giây).' },
  stage: { en: 'Stage:', vi: 'Vòng:' },
} satisfies Record<string, Bi>
type TKey = keyof typeof T

const STAGE: Record<string, Bi> = {
  passed: { en: 'passed the vault', vi: 'qua két khóa' },
  vault: { en: 'failed the vault', vi: 'trượt két khóa' },
  'validation-weak': { en: 'too weak on 2018-2022', vi: 'yếu ở 2018-2022' },
  'validation-failed': { en: 'failed 2018-2022', vi: 'trượt 2018-2022' },
}

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const RUN_MS = 12 * 60_000

/** The idea factory on the signal board: its signals and win rate next to Atlas's own, a manual run button. */
export function AtlasIdeaFactory({ trades, onSymbol }: { trades: PracticeTrade[]; onSymbol?: (symbol: string, asset: 'stock' | 'crypto') => void }) {
  const vi = useLang() === 'vi'
  const L = (b: Bi) => (vi ? b.vi : b.en)
  const G = (k: TKey, vars?: Record<string, string | number>) => Object.entries(vars ?? {}).reduce<string>((s, [a, b]) => s.replaceAll(`{${a}}`, String(b)), L(T[k]))
  const [rep, setRep] = useState<FactoryReport | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [started, setStarted] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const timer = useRef<number | null>(null)

  const load = useCallback(async () => {
    const r = await fetch(`/idea-factory.json?t=${Date.now()}`, { cache: 'no-store' }).catch(() => null)
    const j = r?.ok ? ((await r.json().catch(() => null)) as FactoryReport | null) : null
    if (j) setRep(j)
    return j
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  // while a run is going: a progress bar, and a look for the new result every 30 s (stops after 20 min)
  useEffect(() => {
    if (started == null) return
    const before = rep?.generated ?? ''
    timer.current = window.setInterval(() => {
      setNow(Date.now())
      if ((Date.now() - started) % 30_000 < 1000 || Date.now() - started > RUN_MS) {
        void load().then((j) => {
          if (j && j.generated !== before) setStarted(null)
        })
      }
      if (Date.now() - started > 20 * 60_000) setStarted(null)
    }, 1000)
    return () => {
      if (timer.current) window.clearInterval(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, load])

  const run = async () => {
    setMsg(null)
    const r = await requestRun('ideas')
    setMsg(L(r))
    if (/^(Started|Đã chạy)/.test(r.en)) setStarted(Date.now())
  }

  const d = duel(trades, rep)
  // one card per rule: the rule and its "why" once, then a short row per stock it fired on
  const groups = Object.values(
    (rep?.today.signals ?? []).reduce<Record<string, { key: string; en: string; vi: string; why?: Bi | null; hold: number; rows: FactorySignalView[] }>>((a, s) => {
      ;(a[s.key] ??= { key: s.key, en: s.en, vi: s.vi, why: s.why, hold: s.hold, rows: [] }).rows.push(s)
      return a
    }, {}),
  ).filter((g, k, all) => {
    // rules that fired on the same stocks are one idea with a twist: show the first, count the rest
    const set = g.rows.map((r) => r.symbol).sort().join()
    return all.findIndex((x) => x.rows.map((r) => r.symbol).sort().join() === set) === k
  })
  const similar = new Set((rep?.today.signals ?? []).map((s) => s.key)).size - groups.length
  const pct = started != null ? Math.min(98, Math.round(((now - started) / RUN_MS) * 100)) : 0
  const winnerName = d.winner === 'book' ? G('book') : d.winner === 'opus' ? G('opus') : ''

  return (
    <section className="bf-card asb-ideas" id="atlas-ideas">
      <header>
        <h3>🧠 {G('title')}</h3>
        {rep && <span className="muted small">#{rep.run}</span>}
      </header>
      <p className="bf-source">{G('how')}</p>

      <div className="asb-duel">
        <div className={d.winner === 'book' ? 'lead' : ''}>
          <small>{G('book')}</small>
          <b className="mono">{d.book.winRate != null ? `${d.book.winRate}%` : '—'}</b>
          <div className="asb-bar">
            <i className="gold" style={{ width: `${d.book.winRate ?? 0}%` }} />
          </div>
          <span className="muted">{G('real', { n: d.book.n })}</span>
        </div>
        <div className={d.winner === 'opus' ? 'lead' : ''}>
          <small>{G('opus')}</small>
          <b className="mono">{d.opus.winRate != null ? `${d.opus.winRate}%` : '—'}</b>
          <div className="asb-bar">
            <i style={{ width: `${d.opus.winRate ?? 0}%` }} />
          </div>
          <span className="muted">{d.opus.graded ? G('graded', { n: d.opus.graded }) : G('noScore')}</span>
          {d.vault && <span className="muted">{G('vaultHint', { p: d.vault.winRate, n: d.vault.n })}</span>}
        </div>
      </div>
      {rep?.slots?.length ? (
        <>
          <h4 className="asb-h4">{G('slotsTitle')}</h4>
          <p className="asb-note">{G('slotsHow')}</p>
          <div className="asb-siglist">
            {rep.slots.map((sl) => {
              const rule = rep.rules.find((r) => r.key === sl.key)
              return (
                <div key={sl.key} className="asb-sig">
                  <div className="asb-sig-top">
                    <span className="asb-tag">{sl.status === 'working' ? '✅' : sl.status === 'failing' ? '❌' : '⏳'} {G(sl.status === 'working' ? 'slotWorking' : sl.status === 'failing' ? 'slotFailing' : 'slotTesting')}</span>
                    <span className="muted small">{G('slotRow', { g: sl.graded, w: sl.winRate ?? '—', a: sl.avgPct ?? '—', x: sl.waiting })}</span>
                  </div>
                  {rule && <p className="asb-rule">{L(rule)}</p>}
                </div>
              )
            })}
          </div>
        </>
      ) : null}
      <p className="asb-note">{d.winner ? (d.trusted ? G('aheadOk', { w: winnerName }) : G('ahead', { w: winnerName, m: d.opus.graded, need: d.need })) : G('tie')}</p>

      <button className="btn prime asb-big" onClick={() => void run()} disabled={started != null} aria-busy={started != null}>
        {started != null ? G('running') : `▶ ${G('run')}`}
      </button>
      <p className="asb-safe muted small">{G('runSafe')}</p>
      {started != null && (
        <div className="asb-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={G('running')}>
          <i style={{ width: `${pct}%` }} />
        </div>
      )}
      {msg && <p className="asb-note">{msg}</p>}

      {!rep ? (
        <p className="muted">{G('none')}</p>
      ) : (
        <>
          <h4 className="asb-h4">{G('sigTitle', { d: ddmm(rep.today.day) })}</h4>
          {groups.length ? (
            <div className="asb-siglist">
              {groups.map((g) => (
                <div key={g.key} className="asb-sig asb-isig">
                  <div className="asb-sig-top">
                    <span className="asb-tag">🧠 {G('days', { n: g.hold })}</span>
                    <span className="muted small">{G('nSig', { n: g.rows.length })}</span>
                  </div>
                  <p className="asb-rule">{L(g)}</p>
                  {g.why && <p className="asb-note">💡 {L(g.why)}</p>}
                  <div className="asb-irows">
                    {g.rows.slice(0, 8).map((s) => (
                      <button key={s.symbol} className="asb-irow" onClick={() => onSymbol?.(s.symbol, 'stock')}>
                        <b className="mono">{s.symbol}</b>
                        <span className="mono px">{fmtUsd(s.close)}</span>
                        {s.sl != null && <span className="mono down sl">SL {fmtUsd(s.sl)}</span>}
                      </button>
                    ))}
                  </div>
                  {g.rows.length > 8 && <p className="asb-note">+{g.rows.length - 8}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">{G('noSig')}</p>
          )}
          {similar > 0 && (
            <p className="asb-note">{G('similar', { n: similar })}</p>
          )}
          <p className="asb-note">{rep.funnel.vault ? G('passedNote', { n: rep.funnel.vault }) : G('honest')}</p>
          <details className="asb-more">
            <summary>{G('details')}</summary>
            <p>{G('funnel', { t: rep.funnel.tried, d: rep.funnel.discovery, v: rep.funnel.validation, k: rep.funnel.vault })}</p>
            <p>{G('counter', { total: rep.trials.total, f: rep.trials.factoryTotal, l: rep.trials.holdout ?? rep.trials.labs, v: rep.trials.vaultTotal ?? 0 })}</p>
            <p>
              <b>{G('rulesNow')}</b>
            </p>
            <ul className="asb-rules">
              {rep.rules.map((r) => (
                <li key={r.key}>
                  {L(r)}
                  {r.vault ? ` (${G('vaultHint', { p: r.vault.winRate, n: r.vault.n })}, DSR ${r.vault.dsr})` : ''}
                </li>
              ))}
            </ul>
            <p>{L(rep.pass)}</p>
            <p>{G('last', { d: new Date(rep.generated).toLocaleString(vi ? 'vi-VN' : 'en-US'), r: rep.run, s: rep.seconds })}</p>
            {rep.top.slice(0, 5).map((t) => (
              <p key={t.key} className="small">
                {G('stage')} {L(STAGE[t.stage] ?? { en: t.stage, vi: t.stage })}: {L(t)}
              </p>
            ))}
          </details>
        </>
      )}
    </section>
  )
}
