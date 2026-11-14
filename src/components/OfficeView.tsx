import { useEffect, useState } from 'react'
import { useAiRules } from '../lib/aiRules'
import type { Bi } from '../lib/hubText'
import { useLang } from '../lib/i18n'
import { Help } from './Help'
import { officeSeats, type OfficeSeat, type OfficeState, type OfficeWho } from '../lib/office'
import type { LogLine, TeamState } from '../lib/team'

const T = {
  title: { en: 'Little office', vi: 'Văn phòng nhỏ' },
  how: { en: 'Who is working right now: Muse and the two machines (each runs its Hermes script). Tap a window for details. It updates by itself every 30 seconds.', vi: 'Ai đang làm gì lúc này: Muse và hai máy (mỗi máy có Hermes chạy script). Chạm vào cửa sổ để xem chi tiết. Tự cập nhật mỗi 30 giây.' },
  tapWhy: { en: 'tap to see why', vi: 'chạm để xem lý do' },
  refresh: { en: 'Update now', vi: 'Cập nhật ngay' },
  loading: { en: 'Reading the board from GitHub…', vi: 'Đang đọc bảng từ GitHub…' },
  unread: { en: "Couldn't read the board right now.", vi: 'Chưa đọc được bảng.' },
  queued: { en: 'in the queue', vi: 'việc đang chờ' },
  seen: { en: 'last seen', vi: 'thấy lần cuối' },
  never: { en: 'not seen yet', vi: 'chưa thấy' },
  now: { en: 'Now', vi: 'Đang làm' },
  nothing: { en: 'Nothing right now.', vi: 'Chưa có gì.' },
  recent: { en: 'Latest work', vi: 'Việc gần đây' },
  lead: { en: 'In charge', vi: 'Đang chỉ huy' },
  logTitle: { en: 'Latest log', vi: 'Nhật ký mới nhất' },
} satisfies Record<string, Bi>

const NAME: Record<OfficeWho, Bi> = {
  muse: { en: 'Muse (Milo)', vi: 'Muse (Milo)' },
  hermesWin: { en: 'Windows PC (Hermes)', vi: 'Máy Windows (Hermes)' },
  hermesUbu: { en: 'Ubuntu PC (Hermes)', vi: 'Máy Ubuntu (Hermes)' },
  ubuntuPc: { en: 'Ubuntu PC', vi: 'Máy Ubuntu' },
}
const STATE: Record<OfficeState, Bi> = {
  working: { en: 'Working', vi: 'Đang làm' },
  idle: { en: 'Resting', vi: 'Đang rảnh' },
  waiting: { en: 'Waiting', vi: 'Đang chờ' },
  error: { en: 'Problem', vi: 'Có lỗi' },
  off: { en: 'Off', vi: 'Tắt' },
}
const WHY: Record<OfficeState, Bi> = {
  working: { en: 'Has a task running.', vi: 'Đang chạy một việc.' },
  idle: { en: 'On, nothing to do.', vi: 'Đang bật, chưa có việc.' },
  waiting: { en: 'Has work queued or needs your OK.', vi: 'Có việc đang chờ hoặc chờ anh duyệt.' },
  error: { en: 'Its last task failed.', vi: 'Việc gần nhất bị lỗi.' },
  off: { en: 'Not seen for a while.', vi: 'Lâu rồi chưa thấy.' },
}
const ago = (iso: string, now: number) => {
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60000))
  return m < 60 ? `${m}m` : m < 2880 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`
}

/** One little window: title bar, a screen whose animation follows the state, and a status line. */
function Window({ seat, open, onTap, lang, now }: { seat: OfficeSeat; open: boolean; onTap: () => void; lang: 'en' | 'vi'; now: number }) {
  const name = NAME[seat.who][lang]
  const pc = seat.who === 'ubuntuPc'
  return (
    <button type="button" className={`of-win of-${seat.state}${pc ? ' of-pc' : ''}`} aria-expanded={open} aria-label={`${name}: ${STATE[seat.state][lang]}`} onClick={onTap}>
      <span className="of-bar"><i /><i /><i /><b>{name}</b></span>
      <span className="of-screen" aria-hidden="true">
        {seat.state === 'working' && (<><u /><u /><u /><em /></>)}
        {seat.state === 'idle' && <span className="of-steam"><i /><i /></span>}
        {seat.state === 'waiting' && <span className="of-bubble"><i /><i /><i /></span>}
        {seat.state === 'error' && <span className="of-bang">!</span>}
        {seat.state === 'off' && <span className="of-dark" />}
      </span>
      <span className="of-state">
        <b>{STATE[seat.state][lang]}</b>
        <small>{seat.state === 'error' && seat.task ? `${seat.task.id} · ${T.tapWhy[lang]}` : seat.queued > 0 ? `${seat.queued} ${T.queued[lang]}` : seat.seen ? `${T.seen[lang]} ${ago(seat.seen, now)}` : pc || seat.who !== 'muse' ? T.never[lang] : ''}</small>
      </span>
    </button>
  )
}

function Details({ seat, lang, now, lead }: { seat: OfficeSeat; lang: 'en' | 'vi'; now: number; lead: boolean }) {
  return (
    <div className="of-detail" role="region" aria-label={NAME[seat.who][lang]}>
      <b>{NAME[seat.who][lang]}</b> · <span className={`of-tag of-t-${seat.state}`}>{STATE[seat.state][lang]}</span>
      {lead && seat.who === 'muse' && <span className="muted small"> · {T.lead[lang]}</span>}
      <p className="small muted">{WHY[seat.state][lang]}{seat.seen ? ` ${T.seen[lang]} ${ago(seat.seen, now)}.` : ''}{seat.note ? ` (${seat.note})` : ''}</p>
      <p className="small"><b>{T.now[lang]}:</b> {seat.task ? `${seat.task.id} ${seat.task.title}` : T.nothing[lang]}</p>
      {seat.task?.result && <p className="small muted">{seat.task.result}</p>}
      {seat.recent.length > 0 && (
        <>
          <p className="small"><b>{T.recent[lang]}</b></p>
          <ul className="vt-list">
            {seat.recent.map((t) => (
              <li key={t.id} className="small"><b>{t.id}</b> {t.title} <span className="muted">· {t.status} · {ago(t.updated, now)}</span></li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

/** The little office on the Max page: Muse and the two machines (each with its Hermes), animated from the live team board. */
export function OfficeView() {
  const lang = useLang()
  const rules = useAiRules()
  const [data, setData] = useState<{ team: TeamState; log: LogLine[] } | null | 'error'>(null)
  const [pick, setPick] = useState<OfficeWho | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const load = () =>
    fetch('/api/team')
      .then((r) => (r.ok ? (r.json() as Promise<{ team: TeamState; log: LogLine[] }>) : Promise.reject(new Error(String(r.status)))))
      .then((j) => { setData(j); setNow(Date.now()) })
      .catch(() => setData((d) => d ?? 'error'))

  useEffect(() => {
    if (!rules.officeView) return
    void load()
    // GitHub only, no AI: refresh while the page is visible
    const id = setInterval(() => { if (!document.hidden) void load() }, 30000)
    return () => clearInterval(id)
  }, [rules.officeView])

  if (!rules.officeView) return null
  const team = data && data !== 'error' ? data.team : null
  const seats = team ? officeSeats(team, now) : []
  const open = seats.find((s) => s.who === pick)

  return (
    <section className="bf-card of-card">
      <header className="tp-head">
        <h3>{T.title[lang]}</h3>
        <button type="button" className="btn primary of-big" onClick={() => { setData(null); void load() }}>{T.refresh[lang]}</button>
      </header>
      <p className="muted small">{T.how[lang]}</p>
      <Help k="officeRefresh" />
      {data === null ? (
        <p className="muted small">{T.loading[lang]}</p>
      ) : !team ? (
        <p className="muted small">{T.unread[lang]}</p>
      ) : (
        <>
          <div className="of-room">
            {/* the Ubuntu PC and Hermes Ubuntu are one thing on the board (same heartbeat, same tasks): show it once */}
            {seats.filter((s) => s.who !== 'ubuntuPc').map((s) => <Window key={s.who} seat={s} lang={lang} now={now} open={pick === s.who} onTap={() => setPick(pick === s.who ? null : s.who)} />)}
          </div>
          {open && <Details seat={open} lang={lang} now={now} lead={team.driver.who === 'milo'} />}
          {data !== 'error' && data.log[0] && (
            <p className="small muted of-log">{T.logTitle[lang]}: {data.log[0].time.slice(5)} <b>{data.log[0].who}</b> {data.log[0].type}: {data.log[0].what}</p>
          )}
        </>
      )}
    </section>
  )
}
