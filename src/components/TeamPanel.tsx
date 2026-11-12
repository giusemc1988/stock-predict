import { useEffect, useState } from 'react'
import type { Bi } from '../lib/hubText'
import { useLang } from '../lib/i18n'
import { isOnline, JOBS, PROJECTS, type Job, type LogLine, type Owner, type Project, type TeamAction, type TeamState, type TeamTask } from '../lib/team'

const T = {
  title: { en: 'Office · team board', vi: 'Văn phòng · bảng điều khiển đội' },
  how: { en: 'Who leads, which machines are on, and the work queue. Give work below; red work waits for your OK. Each tap takes about 30 seconds to show.', vi: 'Ai đang chỉ huy, máy nào đang bật, và hàng việc. Giao việc ở dưới; việc đỏ chờ anh duyệt. Mỗi lần bấm khoảng 30 giây mới hiện.' },
  driver: { en: 'In charge', vi: 'Đang chỉ huy' },
  out: { en: 'Claude is out of limit → Milo', vi: 'Claude hết limit → Milo' },
  back: { en: 'Claude is back', vi: 'Claude quay lại' },
  on: { en: 'On', vi: 'Đang bật' },
  off: { en: 'Off', vi: 'Tắt' },
  seen: { en: 'last seen', vi: 'lần cuối' },
  never: { en: 'not seen yet', vi: 'chưa thấy' },
  give: { en: 'Give work', vi: 'Giao việc' },
  what: { en: 'What should be done?', vi: 'Cần làm gì?' },
  who: { en: 'Who', vi: 'Ai làm' },
  job: { en: 'Script', vi: 'Script' },
  red: { en: 'Red: needs my OK first', vi: 'Việc đỏ: cần anh duyệt trước' },
  send: { en: 'Give', vi: 'Giao' },
  idea: { en: 'Ask Claude for ideas', vi: 'Xin ý tưởng' },
  queue: { en: 'Work queue', vi: 'Hàng việc' },
  empty: { en: 'Nothing in the queue.', vi: 'Chưa có việc nào.' },
  ok: { en: 'Approve', vi: 'Duyệt' },
  cancel: { en: 'Drop', vi: 'Bỏ' },
  log: { en: 'Log', vi: 'Nhật ký' },
  refresh: { en: 'Refresh', vi: 'Làm mới' },
  loading: { en: 'Reading the board from GitHub…', vi: 'Đang đọc bảng từ GitHub…' },
  unread: { en: "Couldn't read the board right now.", vi: 'Chưa đọc được bảng.' },
  sent: { en: 'Sent. Wait about 30 seconds, then tap Refresh.', vi: 'Đã gửi. Chờ khoảng 30 giây rồi bấm Làm mới.' },
  nokey: { en: 'Save the GitHub key in Nova first.', vi: 'Cần lưu key GitHub trong Nova trước.' },
  failed: { en: "GitHub didn't take it. Try again.", vi: 'GitHub chưa nhận. Thử lại nhé.' },
  details: { en: 'details', vi: 'chi tiết' },
  brief: { en: 'Steps and limits for Milo (optional). No passwords or keys here.', vi: 'Các bước và giới hạn cho Milo (không bắt buộc). Không ghi mật khẩu hay key ở đây.' },
  handed: { en: 'Given to Milo on', vi: 'Đã đưa cho Milo trên máy' },
  notHanded: { en: 'Not given to Milo yet (waiting for a machine)', vi: 'Chưa đưa cho Milo (chờ máy bật)' },
  briefShow: { en: 'brief', vi: 'lời dặn' },
} satisfies Record<string, Bi>

const OWNER_NAME: Record<Owner, Bi> = {
  claude: { en: 'Claude (code)', vi: 'Claude (code)' },
  milo: { en: 'Milo (code)', vi: 'Milo (code)' },
  windows: { en: 'Windows machine (script)', vi: 'Máy Windows (script)' },
  ubuntu: { en: 'Ubuntu machine (script)', vi: 'Máy Ubuntu (script)' },
}
const JOB_NAME: Record<Job, Bi> = {
  status: { en: 'Check the machine', vi: 'Kiểm tra máy' },
  'neohub-test': { en: 'Neo Hub: test + build', vi: 'Neo Hub: test + build' },
  'bayready-pull': { en: 'BayReady: get newest code', vi: 'BayReady: lấy code mới' },
  'bayready-zip': { en: 'BayReady: build zip', vi: 'BayReady: đóng gói zip' },
}
const STATUS: Record<TeamTask['status'], Bi> = {
  'needs-ok': { en: 'Needs your OK', vi: 'Chờ anh duyệt' },
  todo: { en: 'Waiting', vi: 'Chờ làm' },
  running: { en: 'Working', vi: 'Đang làm' },
  done: { en: 'Done', vi: 'Xong' },
  failed: { en: 'Failed', vi: 'Lỗi' },
  cancelled: { en: 'Dropped', vi: 'Đã bỏ' },
}
const ago = (iso: string, now: number) => {
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60000))
  return m < 60 ? `${m}m` : m < 2880 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`
}

/** The "Văn phòng" board on the Max page: driver, machines, queue and log from team.json on handoff-log. */
export function TeamPanel() {
  const lang = useLang()
  const L = (k: keyof typeof T) => T[k][lang]
  const [data, setData] = useState<{ team: TeamState; log: LogLine[] } | null | 'error'>(null)
  const [title, setTitle] = useState('')
  const [project, setProject] = useState<Project>('neohub')
  const [owner, setOwner] = useState<Owner>('claude')
  const [job, setJob] = useState<Job>('status')
  const [red, setRed] = useState(false)
  const [brief, setBrief] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<keyof typeof T | null>(null)

  const load = () =>
    fetch('/api/team')
      .then((r) => (r.ok ? (r.json() as Promise<{ team: TeamState; log: LogLine[] }>) : Promise.reject(new Error(String(r.status)))))
      .then(setData)
      .catch(() => setData('error'))
  useEffect(() => void load(), [])

  const act = async (a: TeamAction) => {
    if (busy) return
    setBusy(true)
    const r = await fetch('/api/team/act', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(a) })
      .then((x) => x.json() as Promise<{ result?: string }>)
      .catch(() => ({ result: 'refused' }))
    setNote(r.result === 'ok' ? 'sent' : r.result === 'nokey' ? 'nokey' : 'failed')
    if (r.result === 'ok') { setTitle(''); setBrief('') }
    setBusy(false)
  }

  const machine = owner === 'windows' || owner === 'ubuntu'
  const canGive = machine || title.trim().length >= 3
  const give = () => void act(machine ? { type: 'add', project, owner, job } : { type: 'add', title: title.trim(), project, owner, red, ...(owner === 'milo' && brief.trim() ? { brief: brief.trim() } : {}) })
  const now = Date.now()
  const team = data && data !== 'error' ? data.team : null
  const open = team ? team.tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled' && t.status !== 'failed') : []
  const closed = team ? team.tasks.filter((t) => !open.includes(t)).slice(-5).reverse() : []

  return (
    <section className="bf-card tp-card">
      <header className="tp-head">
        <h3>{L('title')}</h3>
        <button className="btn" onClick={() => { setData(null); void load() }}>{L('refresh')}</button>
      </header>
      <p className="muted small">{L('how')}</p>
      {note && <p className="small tp-note" role="status">{L(note)}</p>}

      {data === null ? (
        <p className="muted small">{L('loading')}</p>
      ) : data === 'error' || !team ? (
        <p className="muted small">{L('unread')}</p>
      ) : (
        <>
          <div className="tp-top">
            <div className="tp-box">
              <small className="muted">{L('driver')}</small>
              <b className="tp-big">{team.driver.who === 'milo' ? 'Milo' : 'Claude'}</b>
              <button className="btn" disabled={busy} onClick={() => void act({ type: 'driver', who: team.driver.who === 'milo' ? 'claude' : 'milo' })}>
                {team.driver.who === 'milo' ? L('back') : L('out')}
              </button>
            </div>
            {(['windows', 'ubuntu'] as const).map((m) => {
              const st = team.machines[m]
              const up = isOnline(st, now)
              return (
                <div key={m} className="tp-box">
                  <small className="muted">{m === 'windows' ? 'Windows' : 'Ubuntu'}</small>
                  <b className={`tp-big ${up ? 'tp-up' : 'tp-down'}`}>● {up ? L('on') : L('off')}</b>
                  <small className="muted">{st ? `${L('seen')} ${ago(st.seen, now)}` : L('never')}</small>
                </div>
              )
            })}
          </div>

          <div className="tp-give">
            <b>{L('give')}</b>
            <div className="tp-row">
              <select aria-label={L('who')} value={owner} onChange={(e) => setOwner(e.target.value as Owner)}>
                {(Object.keys(OWNER_NAME) as Owner[]).map((o) => <option key={o} value={o}>{OWNER_NAME[o][lang]}</option>)}
              </select>
              <select aria-label="project" value={project} onChange={(e) => setProject(e.target.value as Project)}>
                {PROJECTS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            {machine ? (
              <select aria-label={L('job')} value={job} onChange={(e) => setJob(e.target.value as Job)}>
                {JOBS.map((j) => <option key={j} value={j}>{JOB_NAME[j][lang]}</option>)}
              </select>
            ) : (
              <>
                <textarea rows={2} placeholder={L('what')} value={title} maxLength={300} onChange={(e) => setTitle(e.target.value)} />
                {owner === 'milo' && <textarea rows={4} placeholder={L('brief')} value={brief} maxLength={4000} onChange={(e) => setBrief(e.target.value)} />}
                <label className="small tp-red"><input type="checkbox" checked={red} onChange={(e) => setRed(e.target.checked)} /> {L('red')}</label>
              </>
            )}
            <div className="ag-acts">
              <button className="btn primary" disabled={busy || !canGive} onClick={give}>{L('send')}</button>
              <button className="btn" disabled={busy} onClick={() => void act({ type: 'add', kind: 'idea', project, owner: 'claude' })}>{L('idea')}</button>
            </div>
          </div>

          <div className="tp-lists">
            <div>
              <b>{L('queue')}</b>
              {!open.length && !closed.length ? (
                <p className="muted small">{L('empty')}</p>
              ) : (
                <ul className="vt-list">
                  {[...open, ...closed].map((t) => (
                    <li key={t.id} className={`vt-row tp-t s-${t.status}`}>
                      <div>
                        <b>{t.id}</b> {t.title}
                        <div className="small muted">{t.project} · {OWNER_NAME[t.owner][lang]} · <span className="tp-st">{STATUS[t.status][lang]}</span></div>
                        {t.owner === 'milo' && t.kind === 'code' && (t.status === 'todo' || t.status === 'running') && (
                          <div className="small muted">{t.handed ? `${L('handed')} ${t.handed.machine === 'windows' ? 'Windows' : 'Ubuntu'} · ${ago(t.handed.at, now)}` : L('notHanded')}</div>
                        )}
                        {t.brief && <details className="small"><summary>{L('briefShow')}</summary><span style={{ whiteSpace: 'pre-wrap' }}>{t.brief}</span></details>}
                        {t.result && <details className="small"><summary>{L('details')}</summary>{t.result}</details>}
                      </div>
                      <div className="ag-acts">
                        {t.status === 'needs-ok' && <button className="btn primary" disabled={busy} onClick={() => void act({ type: 'approve', id: t.id })}>{L('ok')}</button>}
                        {(t.status === 'needs-ok' || t.status === 'todo') && <button className="btn" disabled={busy} onClick={() => void act({ type: 'cancel', id: t.id })}>{L('cancel')}</button>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <details className="tp-log">
              <summary><b>{L('log')}</b></summary>
              <ul className="vt-list">
                {data.log.map((l, i) => (
                  <li key={i} className="small">
                    <span className="muted">{l.time.slice(5)}</span> <b>{l.who}</b> {l.type}: {l.what}
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </>
      )}
    </section>
  )
}
