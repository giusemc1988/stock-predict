import { useEffect, useRef, useState } from 'react'
import type { Bi } from '../lib/hubText'
import { useLang } from '../lib/i18n'
import { isOnline, isStuck, JOBS, miloOpen, miloPrompt, miloStage, needsChanh, PROJECTS, sinceClaude, type Job, type LogLine, type Owner, type Project, type TeamAction, type TeamState, type TeamTask } from '../lib/team'

const T = {
  title: { en: 'Office · team board', vi: 'Văn phòng · bảng điều khiển đội' },
  how: { en: 'Type the work, add pictures if they help, tap Give. The board updates by itself. If Claude is out of limit, tap "Copy prompt for Milo" and paste it into Milo\'s chat.', vi: 'Gõ việc cần làm, thêm ảnh nếu cần, bấm Giao việc. Bảng tự cập nhật. Khi Claude hết limit: bấm "Sao chép lời nhắc cho Milo" rồi dán vào chat Milo.' },
  auto: { en: 'Updates by itself · last', vi: 'Tự cập nhật · lần cuối' },
  opts: { en: 'Options (who, project, steps, red)', vi: 'Tuỳ chọn (ai làm, dự án, lời dặn, việc đỏ)' },
  addImg: { en: '📷 Add pictures', vi: '📷 Thêm ảnh' },
  imgHint: { en: 'You can also paste a picture into the box. Pictures stay on this device: paste them into Milo\'s chat with the prompt.', vi: 'Cũng có thể dán ảnh thẳng vào ô. Ảnh chỉ nằm trên máy này: dán ảnh vào chat Milo cùng lời nhắc.' },
  copyImg: { en: 'Copy picture', vi: 'Sao chép ảnh' },
  rmImg: { en: 'Remove', vi: 'Bỏ' },
  imgCopied: { en: 'Picture copied. Paste it into Milo\'s chat.', vi: 'Đã sao chép ảnh. Dán vào chat Milo.' },
  imgFail: { en: "This browser can't copy pictures. Press and hold the picture to save or share it.", vi: 'Trình duyệt này không sao chép ảnh được. Nhấn giữ ảnh để lưu hoặc chia sẻ.' },
  miloWait: { en: 'Milo has work waiting', vi: 'Milo đang có việc chờ' },
  miloHow: { en: 'No Claude needed: copy, open Milo\'s chat, paste, send.', vi: 'Không cần Claude: sao chép, mở chat Milo, dán, gửi.' },
  copyAll: { en: 'Copy prompt for Milo', vi: 'Sao chép lời nhắc cho Milo' },
  copyOne: { en: 'Copy prompt', vi: 'Sao chép lời nhắc' },
  copied: { en: 'Copied. Paste it into Milo\'s chat.', vi: 'Đã sao chép. Dán vào chat Milo.' },
  copyFail: { en: "Couldn't copy. Open \"see the prompt\" and copy by hand.", vi: 'Chưa sao chép được. Mở "xem lời nhắc" rồi tự copy.' },
  seePrompt: { en: 'see the prompt', vi: 'xem lời nhắc' },
  writing: { en: 'Writing to the board…', vi: 'Đang ghi lên bảng…' },
  needYou: { en: 'Needs you now', vi: 'Cần anh ngay' },
  rRed: { en: 'waits for your OK', vi: 'chờ anh duyệt' },
  rNeed: { en: 'Milo asks', vi: 'Milo hỏi' },
  rStuck: { en: 'nobody has picked it up: paste the prompt to Milo', vi: 'chưa ai nhận: dán lời nhắc cho Milo' },
  rFail: { en: 'failed', vi: 'bị lỗi' },
  dSent: { en: 'Sent', vi: 'Gửi' },
  dBy: { en: 'by', vi: 'bởi' },
  dFile: { en: 'File given', vi: 'Đưa file' },
  dFileNo: { en: 'not yet (waits for a machine that is on)', vi: 'chưa (chờ máy đang bật)' },
  dTook: { en: 'Picked up', vi: 'Nhận việc' },
  dTookNo: { en: 'nobody yet', vi: 'chưa ai nhận' },
  dNow: { en: 'Working on', vi: 'Đang làm tới' },
  dNeed: { en: 'Needs from you', vi: 'Cần anh' },
  dRes: { en: 'Result', vi: 'Kết quả' },
  dErr: { en: 'What went wrong', vi: 'Bị gì' },
  dLesson: { en: 'Lesson for the team', vi: 'Bài học cho đội' },
  dLast: { en: 'Last change', vi: 'Thay đổi cuối' },
  dClaude: { en: 'waits for Claude (when Claude has limit)', vi: 'chờ Claude (khi Claude còn limit)' },
  away: { en: 'Changed since Claude last looked', vi: 'Thay đổi từ lần cuối Claude xem' },
  awayHow: { en: 'Claude reads this list first when back, checks each one, then marks it read.', vi: 'Khi quay lại Claude đọc danh sách này trước, kiểm tra từng việc rồi đánh dấu đã xem.' },
  awayNone: { en: 'Nothing new.', vi: 'Không có gì mới.' },
  st1: { en: 'On board', vi: 'Lên bảng' },
  st2: { en: 'File given', vi: 'Đã đưa file' },
  st3: { en: 'Milo working', vi: 'Milo làm' },
  st4: { en: 'Result', vi: 'Kết quả' },
  stuck: { en: "Milo hasn't opened this yet. Tap Copy prompt and paste it into Milo's chat.", vi: 'Milo chưa mở việc này. Bấm Sao chép lời nhắc rồi dán vào chat Milo.' },
  claudeOut: { en: 'Claude is marked out of limit: work for Claude waits. Give it to Milo instead.', vi: 'Claude đang hết limit: việc giao Claude sẽ nằm chờ. Nên giao cho Milo.' },
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
  sent: { en: 'Sent. It shows here by itself in about 30 seconds.', vi: 'Đã gửi. Khoảng 30 giây nữa việc tự hiện ở dưới.' },
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
const hm = (iso: string) => new Date(iso).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const ago = (iso: string, now: number) => {
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60000))
  return m < 60 ? `${m}m` : m < 2880 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`
}

/** The "Văn phòng" board on the Max page: driver, machines, queue and log from team.json on handoff-log. */
export function TeamPanel() {
  const lang = useLang()
  const L = (k: keyof typeof T) => T[k][lang]
  const [data, setData] = useState<{ team: TeamState; log: LogLine[] } | null | 'error'>(null)
  const [title, setTitle] = useState(() => { try { return localStorage.getItem('tp-draft') ?? '' } catch { return '' } })
  const [project, setProject] = useState<Project>('neohub')
  const [owner, setOwner] = useState<Owner>('milo')
  const [job, setJob] = useState<Job>('status')
  const [red, setRed] = useState(false)
  const [brief, setBrief] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<keyof typeof T | null>(null)
  const [at, setAt] = useState<number | null>(null)
  /** A task just sent that the board has not shown yet: { text, how many tasks the board had numbered } */
  const [sentTask, setPending] = useState<{ text: string; next: number; until: number } | null>(null)
  const [imgs, setImgs] = useState<{ id: number; url: string; blob: Blob }[]>([])
  const imgId = useRef(0)
  const pick = useRef<HTMLInputElement>(null)

  /** quiet = keep what is on screen while reading (the timer), so the board never blinks. */
  const load = (quiet = false) =>
    fetch('/api/team')
      .then((r) => (r.ok ? (r.json() as Promise<{ team: TeamState; log: LogLine[] }>) : Promise.reject(new Error(String(r.status)))))
      .then((d) => { setData(d); setAt(Date.now()) })
      .catch(() => { if (!quiet) setData('error') })
  useEffect(() => void load(), [])
  // the board follows GitHub by itself: every 30 s, every 6 s while a task just sent is not on it yet
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === 'visible') void load(true) }, sentTask ? 6000 : 30000)
    return () => clearInterval(id)
  }, [sentTask])
  useEffect(() => {
    if (!sentTask) return
    const id = setTimeout(() => setPending(null), 125000)
    return () => clearTimeout(id)
  }, [sentTask])
  // the draft survives a reload or a closed tab
  useEffect(() => { try { localStorage.setItem('tp-draft', title) } catch { /* private window */ } }, [title])

  const addImgs = (files: Iterable<File>) => {
    const add = [...files].filter((f) => f.type.startsWith('image/')).map((f) => ({ id: ++imgId.current, url: URL.createObjectURL(f), blob: f as Blob }))
    if (add.length) setImgs((old) => [...old, ...add].slice(0, 4))
    return add.length
  }
  const copyImg = async (blob: Blob) => {
    try {
      let png = blob
      if (blob.type !== 'image/png') {
        const bmp = await createImageBitmap(blob)
        const c = document.createElement('canvas')
        c.width = bmp.width
        c.height = bmp.height
        c.getContext('2d')!.drawImage(bmp, 0, 0)
        png = await new Promise<Blob>((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('png'))), 'image/png'))
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
      setNote('imgCopied')
    } catch {
      setNote('imgFail')
    }
  }
  const copyText = (text: string) => navigator.clipboard.writeText(text).then(() => setNote('copied'), () => setNote('copyFail'))

  const act = async (a: TeamAction) => {
    if (busy) return
    setBusy(true)
    const r = await fetch('/api/team/act', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(a) })
      .then((x) => x.json() as Promise<{ result?: string }>)
      .catch(() => ({ result: 'refused' }))
    setNote(r.result === 'ok' ? 'sent' : r.result === 'nokey' ? 'nokey' : 'failed')
    if (r.result === 'ok') {
      if (a.type === 'add' && team) setPending({ text: a.title ?? '', next: team.next, until: Date.now() + 120000 })
      if (a.type === 'add') { setTitle(''); setBrief('') }
      setTimeout(() => void load(true), 8000)
    }
    setBusy(false)
  }

  const machine = owner === 'windows' || owner === 'ubuntu'
  const canGive = machine || title.trim().length >= 3
  const give = () => {
    // pictures cannot ride in the public repo: the brief says they exist so Milo asks for them instead of guessing
    const pics = owner === 'milo' && imgs.length ? `Chanh has ${imgs.length} picture${imgs.length > 1 ? 's' : ''} for this task. If they are not pasted in your chat, ask him for them before you start.` : ''
    const b = [brief.trim(), pics].filter(Boolean).join('\n')
    void act(machine ? { type: 'add', project, owner, job } : { type: 'add', title: title.trim(), project, owner, red, ...(owner === 'milo' && b ? { brief: b } : {}) })
  }
  const now = Date.now()
  const team = data && data !== 'error' ? data.team : null
  // a task just sent stays as a "writing" line until the board numbers it (or 2 minutes pass)
  const pending = sentTask && team && team.next <= sentTask.next && now < sentTask.until ? sentTask : null
  const waiting = team ? miloOpen(team) : []
  const allPrompt = miloPrompt(waiting, imgs.length)
  const urgent = team ? needsChanh(team, now) : []
  const news = team ? sinceClaude(team) : []
  const why = (t: TeamTask) => (t.status === 'needs-ok' ? L('rRed') : t.need ? `${L('rNeed')}: ${t.need}` : t.status === 'failed' ? `${L('rFail')}: ${(t.result ?? '').slice(0, 140)}` : L('rStuck'))
  const open = team ? team.tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled' && t.status !== 'failed') : []
  const closed = team ? team.tasks.filter((t) => !open.includes(t)).slice(-5).reverse() : []

  return (
    <section className="bf-card tp-card">
      <header className="tp-head">
        <h3>{L('title')}</h3>
        <button className="btn" onClick={() => void load()}>{L('refresh')}</button>
      </header>
      <p className="muted small">{L('how')}</p>
      {at && <p className="muted small">{L('auto')} {new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>}
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

          {urgent.length > 0 && (
            <div className="tp-box tp-urgent">
              <b>{L('needYou')} ({urgent.length})</b>
              <ul className="tp-plain">
                {urgent.map((t) => <li key={t.id} className="small"><b>{t.id}</b> {t.title.slice(0, 60)} · <span className="tp-warn">{why(t)}</span></li>)}
              </ul>
            </div>
          )}

          {waiting.length > 0 && (
            <div className="tp-box tp-milo">
              <b>{L('miloWait')}: {waiting.map((t) => t.id).join(', ')}</b>
              <small className="muted">{L('miloHow')}</small>
              <button className="btn primary tp-bigbtn" onClick={() => void copyText(allPrompt)}>{L('copyAll')}</button>
              <details className="small"><summary>{L('seePrompt')}</summary><pre className="tp-pre">{allPrompt}</pre></details>
            </div>
          )}

          <div className="tp-give">
            <b>{L('give')}</b>
            {!machine && (
              <>
                <textarea
                  rows={3}
                  placeholder={L('what')}
                  value={title}
                  maxLength={300}
                  onChange={(e) => setTitle(e.target.value)}
                  onPaste={(e) => { if (addImgs(e.clipboardData.files)) e.preventDefault() }}
                />
                <input ref={pick} type="file" accept="image/*" multiple hidden onChange={(e) => { addImgs(e.target.files ?? []); e.target.value = '' }} />
                <div className="ag-acts">
                  <button className="btn" onClick={() => pick.current?.click()}>{L('addImg')}</button>
                </div>
                {imgs.length > 0 && (
                  <>
                    <div className="tp-imgs">
                      {imgs.map((im) => (
                        <figure key={im.id} className="tp-img">
                          <img src={im.url} alt="" />
                          <figcaption className="ag-acts">
                            <button className="btn" onClick={() => void copyImg(im.blob)}>{L('copyImg')}</button>
                            <button className="btn" onClick={() => { URL.revokeObjectURL(im.url); setImgs((old) => old.filter((x) => x.id !== im.id)) }}>{L('rmImg')}</button>
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                    <p className="muted small">{L('imgHint')}</p>
                  </>
                )}
              </>
            )}
            {owner === 'claude' && team.driver.who === 'milo' && <p className="small tp-warn">{L('claudeOut')}</p>}
            <button className="btn primary tp-bigbtn" disabled={busy || !canGive} onClick={give}>{L('send')} → {OWNER_NAME[owner][lang]}</button>
            <details className="tp-opts">
              <summary className="small">{L('opts')}</summary>
              <div className="tp-give">
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
                    {owner === 'milo' && <textarea rows={4} placeholder={L('brief')} value={brief} maxLength={3800} onChange={(e) => setBrief(e.target.value)} />}
                    <label className="small tp-red"><input type="checkbox" checked={red} onChange={(e) => setRed(e.target.checked)} /> {L('red')}</label>
                  </>
                )}
                <div className="ag-acts">
                  <button className="btn" disabled={busy} onClick={() => void act({ type: 'add', kind: 'idea', project, owner: 'claude' })}>{L('idea')}</button>
                </div>
              </div>
            </details>
          </div>

          <div className="tp-lists">
            <div>
              <b>{L('queue')}</b>
              {pending && <p className="small tp-note">⏳ {L('writing')} {pending.text.slice(0, 80)}</p>}
              {!open.length && !closed.length ? (
                <p className="muted small">{L('empty')}</p>
              ) : (
                <ul className="vt-list">
                  {[...open, ...closed].map((t) => (
                    <li key={t.id} className={`vt-row tp-t s-${t.status}`}>
                      <div>
                        <b>{t.id}</b> {t.title}
                        <div className="small muted">{t.project} · {OWNER_NAME[t.owner][lang]} · <span className="tp-st">{STATUS[t.status][lang]}</span></div>
                        {t.owner === 'milo' && t.kind === 'code' && t.status !== 'needs-ok' && t.status !== 'cancelled' && (
                          <ol className="tp-steps" aria-label={STATUS[t.status][lang]}>
                            {(['st1', 'st2', 'st3', 'st4'] as const).map((k, i) => (
                              <li key={k} className={miloStage(t) > i ? 'on' : ''}>{L(k)}</li>
                            ))}
                          </ol>
                        )}
                        {t.owner === 'milo' && t.kind === 'code' && (t.status === 'todo' || t.status === 'running') && (
                          <div className="small muted">{t.handed ? `${L('handed')} ${t.handed.machine === 'windows' ? 'Windows' : 'Ubuntu'} · ${ago(t.handed.at, now)}` : L('notHanded')}</div>
                        )}
                        {t.owner === 'milo' && t.kind === 'code' && isStuck(t, now) && <div className="small tp-warn">{L('stuck')}</div>}
                        {t.need && <div className="small tp-warn"><b>{L('dNeed')}:</b> {t.need}</div>}
                        {t.progress && t.status === 'running' && <div className="small"><b>{L('dNow')}:</b> {t.progress}</div>}
                        <details className="small">
                          <summary>{L('details')}</summary>
                          <ul className="tp-plain">
                            <li>{L('dSent')}: {hm(t.created)} {L('dBy')} {t.by ?? 'chanh'}</li>
                            {t.owner === 'milo' && t.kind === 'code' && <li>{L('dFile')}: {t.handed ? `${hm(t.handed.at)} · ${t.handed.machine === 'windows' ? 'Windows' : 'Ubuntu'}` : L('dFileNo')}</li>}
                            {t.owner === 'milo' && t.kind === 'code' && <li>{L('dTook')}: {t.started ? `Milo · ${hm(t.started)}` : t.status === 'done' || t.status === 'failed' ? 'Milo' : L('dTookNo')}</li>}
                            {t.owner === 'claude' && (t.status === 'todo' || t.status === 'running') && <li>{L('dTook')}: {L('dClaude')}</li>}
                            {t.progress && <li>{L('dNow')}: {t.progress}</li>}
                            {t.need && <li className="tp-warn">{L('dNeed')}: {t.need}</li>}
                            {t.result && <li className={t.status === 'failed' ? 'tp-warn' : ''} style={{ whiteSpace: 'pre-wrap' }}>{t.status === 'failed' ? L('dErr') : L('dRes')}: {t.result}</li>}
                            {t.lesson && <li>{L('dLesson')}: {t.lesson}</li>}
                            <li className="muted">{L('dLast')}: {hm(t.updated)} ({ago(t.updated, now)}){t.updatedBy ? ` · ${t.updatedBy}` : ''}</li>
                          </ul>
                        </details>
                        {t.brief && <details className="small"><summary>{L('briefShow')}</summary><span style={{ whiteSpace: 'pre-wrap' }}>{t.brief}</span></details>}
                      </div>
                      <div className="ag-acts">
                        {t.status === 'needs-ok' && <button className="btn primary" disabled={busy} onClick={() => void act({ type: 'approve', id: t.id })}>{L('ok')}</button>}
                        {t.owner === 'milo' && t.kind === 'code' && (t.status === 'todo' || t.status === 'running') && <button className="btn" onClick={() => void copyText(miloPrompt([t], imgs.length))}>{L('copyOne')}</button>}
                        {(t.status === 'needs-ok' || t.status === 'todo') && <button className="btn" disabled={busy} onClick={() => void act({ type: 'cancel', id: t.id })}>{L('cancel')}</button>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="tp-side">
            <details className="tp-log" open={news.length > 0}>
              <summary><b>{L('away')} ({news.length})</b></summary>
              <p className="muted small">{L('awayHow')}{team.claudeSeen ? ` · ${hm(team.claudeSeen)}` : ''}</p>
              {news.length ? (
                <ul className="tp-plain">
                  {news.map((t) => <li key={t.id} className="small"><b>{t.id}</b> {STATUS[t.status][lang]} · {t.updatedBy ?? t.by ?? '?'} · {hm(t.updated)} · {t.title.slice(0, 60)}</li>)}
                </ul>
              ) : <p className="muted small">{L('awayNone')}</p>}
            </details>
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
          </div>
        </>
      )}
    </section>
  )
}
