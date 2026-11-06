import { useEffect, useState } from 'react'
import { useLang } from '../lib/i18n'
import { parseLeaders, type LeadersReport } from '../lib/leaders'
import { parsePaper, type PaperReport } from '../lib/leadersPaper'
import './AtlasSignalBoard.css'

type Bi = { en: string; vi: string }

const T = {
  title: { en: 'Leaders: the strongest stocks in the whole market', vi: 'Dẫn đầu: những mã mạnh nhất cả thị trường' },
  how: {
    en: 'Every night after the US close Atlas looks at about {n} liquid US stocks (not just its usual 270) and keeps the ~100 with the strongest price trend. Your main account does not trade from it; the paper test below watches it for entry points.',
    vi: 'Mỗi đêm sau phiên Mỹ, Atlas xem khoảng {n} mã Mỹ thanh khoản cao (không chỉ 270 mã quen thuộc) và giữ lại ~100 mã có xu hướng giá mạnh nhất. Tài khoản chính không giao dịch theo nó; bài thử giấy bên dưới canh điểm vào trong danh sách này.',
  },
  stats: { en: '{a} trend leaders · {b} big movers · {k} kept', vi: '{a} mã xu hướng mạnh · {b} mã tăng nóng · giữ {k} mã' },
  sectors: { en: 'Strongest sectors (3-month median): ', vi: 'Ngành mạnh nhất (trung vị 3 tháng): ' },
  asOf: { en: 'List from {d}.', vi: 'Danh sách ngày {d}.' },
  none: { en: 'No list yet. The first one is written after the next US close.', vi: 'Chưa có danh sách. Cái đầu tiên được ghi sau phiên Mỹ tới.' },
  stale: { en: 'This list is {n} days old: the nightly job may have failed.', vi: 'Danh sách này đã {n} ngày tuổi: job hằng đêm có thể bị lỗi.' },
  head: { en: 'Stock · strength · 1 / 3 / 6 months in % · below high', vi: 'Mã · sức mạnh · 1 / 3 / 6 tháng (%) · cách đỉnh' },
  more: { en: 'Show all {n}', vi: 'Xem hết {n} mã' },
  less: { en: 'Show fewer', vi: 'Thu gọn' },
  legend: {
    en: 'A = trend leader (price above its 50, 150, 200-day averages, within 25% of its yearly high, strength in the top 10%). B = big mover (+25% in 1 month, +50% in 3, or +150% in 6). ★ = in a top-3 sector. Starting numbers from public methods; tuned on paper.',
    vi: 'A = xu hướng mạnh (giá trên các đường trung bình 50, 150, 200 ngày, cách đỉnh năm ≤25%, sức mạnh top 10%). B = tăng nóng (+25% trong 1 tháng, +50% trong 3, hoặc +150% trong 6). ★ = thuộc 3 ngành mạnh nhất. Con số khởi đầu theo phương pháp công khai; sẽ chỉnh bằng giấy.',
  },
  paperTitle: { en: 'Leaders on paper: does buying them make money?', vi: 'Dẫn đầu chạy giấy: mua theo danh sách có lãi không?' },
  paperHow: {
    en: 'Atlas watches leaders that sit in a tight base, buys on a breakout through the top of the base with big volume, stops just under the base and holds for days until the trend breaks. Paper only; the main account is not touched. After {need} finished trades it is called working (wins {w}%+ and average above 0) or failing.',
    vi: 'Atlas canh mã dẫn đầu đang đi ngang chặt, mua khi giá phá lên đỉnh vùng đi ngang với volume lớn, cắt lỗ ngay dưới vùng đó và giữ nhiều ngày đến khi xu hướng gãy. Chỉ giấy; tài khoản chính không bị đụng. Sau {need} lệnh đã đóng sẽ gắn "đáng tin" (thắng từ {w}%, lãi TB dương) hoặc "loại".',
  },
  paperProgress: { en: '{g} of {need} finished trades', vi: '{g} / {need} lệnh đã đóng' },
  paperStats: { en: 'Wins {w}% · average {a}% · profit factor {pf}', vi: 'Thắng {w}% · TB {a}% · PF {pf}' },
  paperNone: { en: 'No finished trade yet. Setups are rare (about one a night), so the first results take a few weeks.', vi: 'Chưa có lệnh nào đóng. Điểm vào hiếm (khoảng 1 mã mỗi đêm), nên vài tuần mới có kết quả đầu tiên.' },
  watching: { en: 'Waiting for a breakout', vi: 'Đang canh phá đỉnh' },
  holding: { en: 'Holding', vi: 'Đang giữ' },
  buyAt: { en: 'buy above {e}, stop {s}', vi: 'mua trên {e}, cắt lỗ {s}' },
  heldFor: { en: 'in at {e}, now {p}%, day {d}', vi: 'vào {e}, nay {p}%, ngày {d}' },
  stTesting: { en: 'testing', vi: 'đang thử' },
  stWorking: { en: 'working', vi: 'đáng tin' },
  stFailing: { en: 'failing', vi: 'loại' },
} satisfies Record<string, Bi>
type TKey = keyof typeof T

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const pn = (x: number) => `${x > 0 ? '+' : ''}${Math.round(x)}`
const pct = (x: number) => `${x > 0 ? '+' : ''}${Math.round(x)}%`

/** Stage 1 of the Leaders funnel: tonight's strongest stocks from the whole market (public/leaders.json). Read only. */
export function AtlasLeaders({ onSymbol }: { onSymbol?: (symbol: string, asset: 'stock' | 'crypto') => void }) {
  const vi = useLang() === 'vi'
  const L = (b: Bi) => (vi ? b.vi : b.en)
  const G = (k: TKey, vars?: Record<string, string | number>) => Object.entries(vars ?? {}).reduce<string>((s, [a, b]) => s.replaceAll(`{${a}}`, String(b)), L(T[k]))
  const [rep, setRep] = useState<LeadersReport | null | undefined>(undefined)
  const [paper, setPaper] = useState<PaperReport | null>(null)
  const [all, setAll] = useState(false)
  const [now] = useState(() => Date.now())

  useEffect(() => {
    let live = true
    fetch(`/leaders.json?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => live && setRep(parseLeaders(j)))
      .catch(() => live && setRep(null))
    fetch(`/leaders-paper.json?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => live && setPaper(parsePaper(j)))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [])

  if (rep === undefined) return null
  const age = rep ? Math.floor((now - Date.parse(rep.generated)) / 86_400_000) : 0
  const rows = rep ? (all ? rep.leaders : rep.leaders.slice(0, 12)) : []

  return (
    <section className="bf-card asb-leaders">
      <header>
        <h3>🏆 {G('title')}</h3>
        {rep && <span className="muted small">{ddmm(rep.generated)}</span>}
      </header>
      {!rep ? (
        <p className="muted">{G('none')}</p>
      ) : (
        <>
          <p className="bf-source">{G('how', { n: rep.universe.toLocaleString('en-US') })}</p>
          <p className="asb-note">
            {G('stats', { a: rep.listA, b: rep.listB, k: rep.leaders.length })}
            {age >= 4 ? ` · ⚠ ${G('stale', { n: age })}` : ''}
          </p>
          {rep.topSectors.length > 0 && (
            <p className="asb-note">
              {G('sectors')}
              {rep.topSectors.map((s) => `${s.sector} ${pct(s.median3m)}`).join(' · ')}
            </p>
          )}
          <small className="muted">{G('head')}</small>
          <ul className="asb-lead-list">
            {rows.map((l) => (
              <li key={l.symbol}>
                <button type="button" className="asb-lead-row" onClick={() => onSymbol?.(l.symbol, 'stock')}>
                  <b className="mono">{l.symbol}</b>
                  <span className="asb-lead-tags">
                    {l.tags.join('')}
                    {l.inTopSector ? ' ★' : ''}
                  </span>
                  <span className="mono">{l.rs}</span>
                  <span className="asb-lead-p mono">
                    {pn(l.p1m)}/{pn(l.p3m)}/{pn(l.p6m)}
                  </span>
                  <span className="mono small muted">-{Math.round(l.offHigh)}%</span>
                </button>
              </li>
            ))}
          </ul>
          {rep.leaders.length > 12 && (
            <button type="button" className="btn" onClick={() => setAll((v) => !v)}>
              {all ? G('less') : G('more', { n: rep.leaders.length })}
            </button>
          )}
          {paper && (
            <div className="asb-lead-paper">
              <h4>
                {G('paperTitle')} <span className={`asb-lead-st ${paper.score.status}`}>{G(paper.score.status === 'working' ? 'stWorking' : paper.score.status === 'failing' ? 'stFailing' : 'stTesting')}</span>
              </h4>
              <p className="bf-source">{G('paperHow', { need: paper.score.need, w: 55 })}</p>
              <div className="asb-bar">
                <i className={paper.score.status === 'working' ? 'up' : ''} style={{ width: `${Math.min(100, (100 * paper.score.graded) / paper.score.need)}%` }} />
              </div>
              <p className="asb-note">
                {G('paperProgress', { g: paper.score.graded, need: paper.score.need })}
                {paper.score.graded > 0 && ` · ${G('paperStats', { w: paper.score.winRate ?? 0, a: paper.score.avgPct ?? 0, pf: paper.score.profitFactor ?? '—' })}`}
              </p>
              {paper.score.graded === 0 && <p className="asb-note">{G('paperNone')}</p>}
              {paper.open.length > 0 && (
                <>
                  <small className="muted">{G('holding')}</small>
                  <ul className="asb-lead-mini">
                    {paper.open.map((p) => (
                      <li key={p.symbol}>
                        <b className="mono">{p.symbol}</b> <span className="asb-note">{G('heldFor', { e: p.entry, p: p.openPct, d: p.days })}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {paper.watching.length > 0 && (
                <>
                  <small className="muted">{G('watching')}</small>
                  <ul className="asb-lead-mini">
                    {paper.watching.map((w) => (
                      <li key={w.symbol}>
                        <b className="mono">{w.symbol}</b> <span className="asb-note">{G('buyAt', { e: w.entry, s: w.stop })}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
          <details className="asb-more">
            <summary>{vi ? 'Cách đọc' : 'How to read'}</summary>
            <p>{G('legend')}</p>
          </details>
        </>
      )}
    </section>
  )
}
