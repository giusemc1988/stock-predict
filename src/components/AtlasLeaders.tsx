import { useEffect, useState } from 'react'
import { useLang } from '../lib/i18n'
import { parseLeaders, type LeadersReport } from '../lib/leaders'
import './AtlasSignalBoard.css'

type Bi = { en: string; vi: string }

const T = {
  title: { en: 'Leaders: the strongest stocks in the whole market', vi: 'Dẫn đầu: những mã mạnh nhất cả thị trường' },
  how: {
    en: 'Every night after the US close Atlas looks at about {n} liquid US stocks (not just its usual 270) and keeps the ~100 with the strongest price trend. Nothing trades yet: this is the shortlist the next step will watch for entry points.',
    vi: 'Mỗi đêm sau phiên Mỹ, Atlas xem khoảng {n} mã Mỹ thanh khoản cao (không chỉ 270 mã quen thuộc) và giữ lại ~100 mã có xu hướng giá mạnh nhất. Chưa giao dịch gì: đây là danh sách rút gọn để bước sau canh điểm vào.',
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
  const [all, setAll] = useState(false)
  const [now] = useState(() => Date.now())

  useEffect(() => {
    let live = true
    fetch(`/leaders.json?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => live && setRep(parseLeaders(j)))
      .catch(() => live && setRep(null))
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
          <details className="asb-more">
            <summary>{vi ? 'Cách đọc' : 'How to read'}</summary>
            <p>{G('legend')}</p>
          </details>
        </>
      )}
    </section>
  )
}
