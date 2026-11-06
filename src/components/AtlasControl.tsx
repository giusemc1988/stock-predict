import { useCallback, useEffect, useMemo, useState } from 'react'
import { batchPrompt, headline, kpis, learners, MAX_BATCH, repoUpgrade, steps, systemCheck, taskGoal, todos, UPGRADES, PASS, type Check, type ControlInput, type FoundRepo, type Level, type Upgrade } from '../lib/atlasControl'
import type { FactoryReport } from '../lib/ideaFactoryView'
import type { TaskInfo } from '../lib/hubTasks'
import { useLang } from '../lib/i18n'
import { parsePractice, type PracticeState } from '../lib/practice'
import type { LeadsReport } from '../lib/shadowLeads'
import './AtlasControl.css'

type Bi = { en: string; vi: string }
const getJson = (url: string) => fetch(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)

/** "Do this": file the prompt as an agent-task issue; Claude works the queue when Chanh says "làm hàng chờ Atlas". */
async function queue(prompt: string): Promise<'ok' | 'nokey' | 'refused' | 'error'> {
  const r = await fetch('/api/hub/task', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: prompt, where: 'Atlas · Bảng điều khiển' }) }).catch(() => null)
  const res = r ? ((await r.json().catch(() => null)) as { result?: string } | null)?.result : null
  return res === 'ok' || res === 'nokey' || res === 'refused' ? res : 'error'
}

const SENT: Record<string, Bi> = {
  ok: { en: 'Queued for Claude. When you have time, say "làm hàng chờ Atlas" in Neo Hub chat.', vi: 'Đã vào hàng chờ (xem ở "Hàng chờ cho Claude" bên dưới). Khi rảnh anh nhắn "làm hàng chờ Atlas" trong chat Neo Hub.' },
  nokey: { en: 'Needs the GitHub key: Nova, step 5, "GitHub key".', vi: 'Cần key GitHub: mở Nova, bước 5, ô "Key GitHub".' },
  refused: { en: 'GitHub refused: the saved key may have expired.', vi: 'GitHub từ chối: key đã lưu có thể hết hạn.' },
  error: { en: "Couldn't reach the server. Try again.", vi: 'Không gọi được máy chủ. Thử lại nhé.' },
}

function Spark({ data, tone }: { data: number[]; tone: string }) {
  if (data.length < 2) return <svg className="ac-spark" viewBox="0 0 100 30" />
  const lo = Math.min(...data)
  const hi = Math.max(...data)
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${hi === lo ? 15 : 27 - ((v - lo) / (hi - lo)) * 24}`).join(' ')
  return (
    <svg className="ac-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden>
      <polyline fill="none" className={tone} strokeWidth="2" points={pts} />
    </svg>
  )
}

export function AtlasControl({ practice }: { practice: PracticeState }) {
  const vi = useLang() === 'vi'
  const L = (b: Bi) => (vi ? b.vi : b.en)
  const [fresh, setFresh] = useState<PracticeState | null>(null)
  const [factory, setFactory] = useState<FactoryReport | null>(null)
  const [leaders, setLeaders] = useState<ControlInput['leaders']>(null)
  const [leads, setLeads] = useState<LeadsReport | null>(null)
  const [paper, setPaper] = useState<ControlInput['paper']>(null)
  const [busy, setBusy] = useState(true)
  const [now, setNow] = useState(() => Date.now())
  const [checkedAt, setCheckedAt] = useState<number | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [sent, setSent] = useState<Record<string, string>>({})
  const [help, setHelp] = useState<number | null>(null)
  const [found, setFound] = useState<Upgrade[] | null>(null)
  const [finding, setFinding] = useState(false)
  const [allUps, setAllUps] = useState(false)
  const [picked, setPicked] = useState<Record<string, Upgrade>>({})
  const [tab, setTab] = useState<'fix' | 'up' | 'queue'>('fix')
  const [allLb, setAllLb] = useState(false)
  const [tasks, setTasks] = useState<TaskInfo[] | null>(null)
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const loadQueue = useCallback(async () => {
    const [t, r] = await Promise.all([getJson('/api/hub/tasks'), getJson('/api/hub/runs')])
    setTasks((t as { tasks?: TaskInfo[] } | null)?.tasks ?? null)
    const k = (r as { key?: boolean } | null)?.key
    setHasKey(typeof k === 'boolean' ? k : null)
  }, [])
  useEffect(() => {
    void loadQueue()
  }, [loadQueue])

  const check = useCallback(async () => {
    setBusy(true)
    const [st, fr, ld, lr, pp] = await Promise.all([getJson('/api/practice/state'), getJson('/idea-factory.json'), getJson('/leaders.json'), getJson('/api/practice/learning'), getJson('/leaders-paper.json')])
    setPaper((pp as ControlInput['paper']) ?? null)
    const ps = st ? parsePractice((st as { state?: unknown }).state) : null
    if (ps) setFresh(ps)
    setFactory(fr as FactoryReport | null)
    setLeaders(ld as ControlInput['leaders'])
    setLeads((lr as { leads?: LeadsReport } | null)?.leads ?? null)
    setNow(Date.now())
    setCheckedAt(Date.now())
    setBusy(false)
  }, [])
  useEffect(() => {
    void check()
  }, [check])

  const s = fresh && (fresh.server?.lastRun ?? 0) >= (practice.server?.lastRun ?? 0) ? fresh : practice
  const input: ControlInput = { s, now, factory, leaders, leads, paper }
  const checks = useMemo(() => systemCheck(input), [s, now, factory, leaders, leads, paper]) // eslint-disable-line react-hooks/exhaustive-deps
  const k = useMemo(() => kpis(s, now), [s, now])
  const head = headline(checks)
  const todo = todos(checks)
  const map = steps(input, checks)
  const board = learners(input)
  const count = (l: Level) => checks.filter((c) => c.level === l).length

  const send = async (id: string, prompt: string) => {
    setSent((m) => ({ ...m, [id]: 'busy' }))
    const r = await queue(prompt)
    setSent((m) => ({ ...m, [id]: r }))
    if (r === 'ok') setTimeout(() => void loadQueue(), 8000)
  }

  const findNew = async () => {
    setFinding(true)
    const since = new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10)
    const q = (topic: string) => getJson(`https://api.github.com/search/repositories?q=topic:${topic}+pushed:>${since}&sort=stars&per_page=6`)
    const res = await Promise.all([q('algorithmic-trading'), q('stock-screener'), q('backtesting')])
    const seen = new Set(UPGRADES.map((u) => u.url))
    const list: FoundRepo[] = []
    for (const r of res) for (const it of ((r as { items?: { full_name: string; html_url: string; stargazers_count: number; description: string | null; pushed_at: string }[] } | null)?.items ?? [])) {
      if (seen.has(it.html_url)) continue
      seen.add(it.html_url)
      list.push({ name: it.full_name, url: it.html_url, stars: it.stargazers_count, desc: it.description ?? '', pushed: it.pushed_at })
    }
    setFound(list.sort((a, b) => b.stars - a.stars).slice(0, 6).map(repoUpgrade))
    setFinding(false)
  }

  // one row with "Do this" + "See prompt"
  const actions = (id: string, prompt: string, label: Bi) => {
    const st = sent[id]
    // already in the queue (waiting or PR ready): no second copy of the same task
    const queued = (tasks ?? []).find((t) => (t.state === 'waiting' || t.state === 'pr') && prompt.includes(taskGoal(t.title)))
    return (
      <div className="ac-act">
        <div className="ac-btns">
          {queued ? (
            <a className="ac-btn ac-pri" href={queued.url} target="_blank" rel="noreferrer">{vi ? `✓ Đã ở hàng chờ #${queued.number}` : `✓ In the queue #${queued.number}`}</a>
          ) : (
            <button className="ac-btn ac-pri" disabled={st === 'busy' || st === 'ok'} onClick={() => void send(id, prompt)}>
              {st === 'busy' ? '…' : st === 'ok' ? (vi ? '✓ Đã gửi' : '✓ Sent') : L(label)}
            </button>
          )}
          <button className="ac-btn" onClick={() => setOpen(open === id ? null : id)}>{vi ? (open === id ? 'Ẩn prompt' : 'Xem prompt') : open === id ? 'Hide prompt' : 'See prompt'}</button>
        </div>
        {st && st !== 'busy' && <p className={`ac-sent ${st === 'ok' ? 'up' : 'down'}`}>{L(SENT[st])}</p>}
        {open === id && <pre className="ac-prompt">{prompt}</pre>}
      </div>
    )
  }

  const nPicked = Object.keys(picked).length
  const togglePick = (u: Upgrade) =>
    setPicked((m) => {
      const n = { ...m }
      if (n[u.id]) delete n[u.id]
      else if (Object.keys(n).length < MAX_BATCH) n[u.id] = u
      return n
    })
  const sendBatch = async () => {
    await send('batch', batchPrompt(Object.values(picked)))
    setPicked({})
  }

  const upCard = (u: Upgrade) => (
    <li key={u.id} className={`ac-up${picked[u.id] ? ' picked' : ''}`}>
      <div className="ac-up-top">
        <label className="ac-pick" title={vi ? 'Chọn để làm chung' : 'Pick to do together'}>
          <input type="checkbox" checked={!!picked[u.id]} disabled={!picked[u.id] && nPicked >= MAX_BATCH} onChange={() => togglePick(u)} />
        </label>
        <div>
          <b>{u.url ? <a href={u.url} target="_blank" rel="noreferrer">{L(u.title)}</a> : L(u.title)}</b>
          <span>{L(u.why)}</span>
        </div>
        <span className="ac-imp" title={vi ? 'Mức lợi ích' : 'Benefit'}>{[1, 2, 3].map((i) => <i key={i} className={i <= u.benefit ? 'on' : ''} />)}</span>
      </div>
      <p className="ac-how">{vi ? `Giúp bước ${u.step} · ` : `Helps step ${u.step} · `}{L(u.how)}</p>
      {actions(u.id, u.prompt, { en: 'Do this', vi: 'Làm cái này' })}
    </li>
  )

  const cmpTone = (n: number | null, base: number) => (n == null ? '' : n >= base ? 'up' : 'down')

  return (
    <div className="ac">
      <section className={`bf-card ac-head ac-${head.level}`}>
        <div className="ac-head-row">
          <div>
            <span className="ac-kicker">{vi ? 'ATLAS · BẢNG ĐIỀU KHIỂN' : 'ATLAS · CONTROL PANEL'}{checkedAt ? ` · ${new Date(checkedAt).toLocaleTimeString(vi ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
            <h2><i className={`ac-dot ${head.level}`} />{L(head.text)}</h2>
            <p className="ac-note">{vi ? 'Tiền giả, không có tiền thật. Bấm nút để kiểm tra mọi bộ phận; việc cần làm hiện ở "Việc cần làm".' : 'Paper money only. Press the button to check every part; what needs doing shows under "To do".'}</p>
          </div>
          <button className="ac-big" disabled={busy} onClick={() => void check()}>{busy ? (vi ? 'Đang kiểm tra…' : 'Checking…') : vi ? 'Kiểm tra hệ thống' : 'Check the system'}</button>
        </div>
        {busy && <div className="ac-progress"><i /></div>}
        <div className="ac-legend">
          <span><i className="ac-dot ok" />{vi ? 'Ổn' : 'OK'}</span>
          <span><i className="ac-dot warn" />{vi ? 'Cần để ý / chờ duyệt' : 'Look / approve'}</span>
          <span><i className="ac-dot bad" />{vi ? 'Có vấn đề' : 'Problem'}</span>
          <span><i className="ac-dot off" />{vi ? 'Chưa xây / đã sửa, chờ kết quả' : 'Not built / fixed, waiting for results'}</span>
        </div>
      </section>

      <section className="bf-card ac-health">
        <header className="ac-h">
          <h3>🚦 {vi ? 'Đèn sức khoẻ' : 'Health lights'}</h3>
          <span className="ac-tags"><span className="ac-tag ok">{count('ok')} {vi ? 'ổn' : 'ok'}</span><span className="ac-tag warn">{count('warn')} {vi ? 'để ý' : 'look'}</span>{count('bad') > 0 && <span className="ac-tag bad">{count('bad')} {vi ? 'đỏ' : 'red'}</span>}</span>
        </header>
        <p className="ac-note">{vi ? 'Mỗi đèn là một bộ phận tự chạy (miễn phí, không tốn token). Vàng/đỏ thì xem ở "Việc cần làm".' : 'Each light is a part that runs by itself (free). Yellow/red ones are listed under "To do".'}</p>
        <div className="ac-lights">
          {checks.map((c) => (
            <div key={c.id} className={`ac-light ${c.level}`}>
              <i className={`ac-dot ${c.level}`} />
              <b>{L(c.part)}</b>
              <span>{L(c.status)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="bf-card ac-work">
        <header className="ac-h"><h3>🧰 {vi ? 'Việc cần làm' : 'Work list'}</h3></header>
        <div className="ac-tabs" role="tablist">
          <button className={tab === 'fix' ? 'on' : ''} onClick={() => setTab('fix')}>{vi ? 'Cần sửa' : 'Fix'} <span className={`ac-tag ${todo.some((c) => c.level === 'bad') ? 'bad' : todo.length ? 'warn' : 'ok'}`}>{todo.length}</span></button>
          <button className={tab === 'up' ? 'on' : ''} onClick={() => setTab('up')}>{vi ? 'Nâng cấp' : 'Upgrade'} <span className="ac-tag">{UPGRADES.length}</span></button>
          <button className={tab === 'queue' ? 'on' : ''} onClick={() => setTab('queue')}>{vi ? 'Hàng chờ' : 'Queue'} <span className="ac-tag">{(tasks ?? []).filter((t) => t.state === 'waiting' || t.state === 'pr').length}</span></button>
        </div>
        <p className="ac-note">{tab === 'fix' ? (vi ? 'Lỗi và cảnh báo hệ thống tìm ra, đỏ trên cùng.' : 'Problems the check found, red first.') : tab === 'up' ? (vi ? 'Việc nên làm thêm, xếp theo lợi ích (vạch).' : 'Things worth adding, best first (bars = benefit).') : (vi ? 'Việc anh đã bấm "Làm cái này". Nhắn "làm hàng chờ Atlas" trong chat Neo Hub để Claude làm.' : 'Tasks you sent. Say "làm hàng chờ Atlas" in Neo Hub chat.')} {tab !== 'queue' && (vi ? 'Bấm "Làm cái này" là anh đã duyệt, việc vào Hàng chờ.' : 'Pressing "Do this" approves it and adds it to the queue.')}</p>
        {hasKey === false && (
          <div className="ac-keywarn">
            <b>🔑 {vi ? 'Chưa có key GitHub, nên nút "Làm cái này" chưa gửi được' : 'No GitHub key yet, so "Do this" cannot send'}</b>
            <ol>
              <li>{vi ? 'Bấm link này (đã điền sẵn tên và quyền):' : 'Open this link (name and permission prefilled):'} <a href="https://github.com/settings/personal-access-tokens/new?name=Neo%20Hub%20tasks&description=Atlas%20and%20Neo%20send%20tasks%20to%20Claude&target_name=giusemc1988&expires_in=365&actions=write" target="_blank" rel="noreferrer">{vi ? 'Tạo key GitHub' : 'Create GitHub key'}</a></li>
              <li>{vi ? 'Ở "Repository access" chọn "Only select repositories" rồi chọn stock-predict.' : 'Under "Repository access" pick "Only select repositories", then stock-predict.'}</li>
              <li>{vi ? 'Kiểm tra "Actions" là "Read and write", rồi bấm "Generate token" và Copy.' : 'Check "Actions" is "Read and write", press "Generate token" and copy it.'}</li>
              <li>{vi ? 'Mở Nova, bước 5, dán vào ô "Key GitHub" và bấm Lưu. Quay lại đây bấm "Làm mới".' : 'Open Nova, step 5, paste into "GitHub key" and save. Come back and press Refresh.'}</li>
            </ol>
          </div>
        )}
        {tab === 'fix' && (
          <>
        {todo.length === 0 ? <p className="ac-empty">✓ {vi ? 'Không có việc gì cần làm.' : 'Nothing to do.'}</p> : (
          <ul className="ac-list">
            {todo.map((c: Check) => (
              <li key={c.id} className={`ac-item ${c.level}`}>
                <div className="ac-item-top"><i className={`ac-dot ${c.level}`} /><div><b>{L(c.title)}</b><span>{L(c.detail)}</span></div></div>
                {c.prompt && actions(c.id, c.prompt, c.id === 'grade' ? { en: 'Approve', vi: 'Duyệt' } : c.level === 'bad' ? { en: 'Fix this', vi: 'Sửa cái này' } : { en: 'Do this', vi: 'Làm cái này' })}
              </li>
            ))}
          </ul>
        )}
          </>
        )}
        {tab === 'up' && (
          <>
        <p className="ac-note">{vi ? `Tích ô vuông ở nhiều mục (tối đa ${MAX_BATCH}) rồi bấm "Làm các mục đã chọn": Claude làm chung một lần, đỡ tốn token hơn làm từng cái.` : `Tick several items (up to ${MAX_BATCH}) and press "Do the picked ones": Claude does them in one go, using fewer tokens.`}</p>
        <ul className="ac-list ac-uplist">{(allUps ? UPGRADES : UPGRADES.slice(0, 4)).map(upCard)}</ul>
        {!allUps && <button className="ac-btn ac-find" onClick={() => setAllUps(true)}>{vi ? `Xem thêm ${UPGRADES.length - 4} gợi ý` : `${UPGRADES.length - 4} more ideas`}</button>}
        <button className="ac-btn ac-find" disabled={finding} onClick={() => void findNew()}>{finding ? (vi ? 'Đang tìm…' : 'Searching…') : vi ? '🔎 Tìm mới trên GitHub' : '🔎 Find new on GitHub'}</button>
        {finding && <div className="ac-progress"><i /></div>}
        {found && (found.length ? <ul className="ac-list ac-uplist">{found.map(upCard)}</ul> : <p className="ac-empty">{vi ? 'Chưa tìm được (GitHub giới hạn lượt tìm, thử lại sau 1 phút).' : 'Nothing found (GitHub rate limit, try again in a minute).'}</p>)}
        {(nPicked > 0 || sent.batch) && (
          <div className="ac-batch">
            <span>{nPicked > 0 ? (vi ? `Đã chọn ${nPicked}/${MAX_BATCH}` : `${nPicked}/${MAX_BATCH} picked`) : ''}</span>
            <div className="ac-btns">
              {nPicked > 0 && <button className="ac-btn ac-pri" disabled={sent.batch === 'busy'} onClick={() => void sendBatch()}>{sent.batch === 'busy' ? '…' : vi ? `Làm ${nPicked} mục đã chọn` : `Do the ${nPicked} picked`}</button>}
              {nPicked > 0 && <button className="ac-btn" onClick={() => setPicked({})}>{vi ? 'Bỏ chọn' : 'Clear'}</button>}
            </div>
            {sent.batch && sent.batch !== 'busy' && <p className={`ac-sent ${sent.batch === 'ok' ? 'up' : 'down'}`}>{L(SENT[sent.batch])}</p>}
          </div>
        )}
          </>
        )}
        {tab === 'queue' && (
          <>
            <button className="ac-btn ac-find" onClick={() => void loadQueue()}>{vi ? 'Làm mới hàng chờ' : 'Refresh queue'}</button>
        {tasks == null ? <p className="ac-note">{vi ? 'Chưa đọc được hàng chờ.' : 'Could not read the queue.'}</p> : tasks.length === 0 ? <p className="ac-empty">{vi ? 'Hàng chờ trống.' : 'The queue is empty.'}</p> : (
          <ul className="ac-list ac-qlist">
            {tasks.map((t) => (
              <li key={t.number} className="ac-qrow">
                <a href={t.url} target="_blank" rel="noreferrer">#{t.number} {t.title}</a>
                <span className={`ac-tag ${t.state === 'waiting' ? 'warn' : t.state === 'pr' ? 'ok' : 'off'}`}>{vi ? { waiting: 'Đang chờ', pr: 'Có PR chờ duyệt', done: 'Xong', closed: 'Đã đóng' }[t.state] : { waiting: 'Waiting', pr: 'PR ready', done: 'Done', closed: 'Closed' }[t.state]}</span>
              </li>
            ))}
          </ul>
        )}
          </>
        )}
      </section>

      <section className="bf-card ac-kpi">
        <h3>📊 {vi ? 'Chỉ số chính' : 'Key numbers'}</h3>
        <div className="ac-kpis">
          <div className="ac-k"><span>{vi ? 'Tiền giả (gốc $100k)' : 'Paper money ($100k start)'}</span><b>${k.equity.toLocaleString('en', { maximumFractionDigits: 0 })}</b><em className={k.returnPct >= 0 ? 'up' : 'down'}>{k.returnPct >= 0 ? '▲' : '▼'} {Math.abs(k.returnPct)}%</em><Spark data={k.spark} tone={k.returnPct >= 0 ? 'up' : 'down'} /></div>
          <div className="ac-k"><span>{vi ? `Tỉ lệ thắng · đích ${PASS.winRate}%` : `Win rate · goal ${PASS.winRate}%`}</span><b className={cmpTone(k.winRate, PASS.winRate)}>{k.winRate ?? '—'}%</b><em>{vi ? `20 lệnh gần: ${k.recentWinRate ?? '—'}%` : `last 20: ${k.recentWinRate ?? '—'}%`}</em></div>
          <div className="ac-k"><span>{vi ? 'Lãi/lỗ (PF) · đích trên 1' : 'Profit factor · goal above 1'}</span><b className={cmpTone(k.pf, 1)}>{k.pf ?? '—'}</b><em>{k.pfBefore != null ? (vi ? `trước đó ${k.pfBefore}` : `before ${k.pfBefore}`) : '—'}</em></div>
          <div className="ac-k"><span>{vi ? 'Lệnh đóng hôm nay' : 'Closed today'}</span><b>{k.today.n}</b><em className={k.today.pnl >= 0 ? 'up' : 'down'}>{vi ? `${k.today.wins} thắng · ${k.today.n - k.today.wins} thua` : `${k.today.wins} won · ${k.today.n - k.today.wins} lost`}</em></div>
        </div>
      </section>

      <section className="bf-card ac-map">
        <header className="ac-h"><h3>🏭 {vi ? 'Bản đồ hệ thống: 6 bước nối nhau' : 'System map: 6 linked steps'}</h3><span className="ac-small">{vi ? 'bấm ? để đọc giải thích' : 'tap ? for an explanation'}</span></header>
        <div className="ac-steps">
          {map.map((st) => (
            <div key={st.n} className={`ac-step ${st.level === 'off' ? 'off' : ''}`}>
              <div className="ac-step-hd"><i className={`ac-dot ${st.level}`} /><b>{st.n} · {L(st.name)}</b><button className="ac-q" onClick={() => setHelp(help === st.n ? null : st.n)} aria-label="?">?</button></div>
              {help === st.n && <p className="ac-help">{L(st.help)}</p>}
              <div className="ac-stats">{st.stats.map((x, i) => <div key={i}><span>{L(x.label)}</span><b>{x.value}</b></div>)}</div>
              <span className="ac-feed">{L(st.feeds)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="bf-card ac-lb">
        <header className="ac-h"><h3>🏆 {vi ? 'Bảng xếp hạng học viên' : 'Learner leaderboard'}</h3><span className="ac-small">{vi ? `đậu = ≥${PASS.n} bài, thắng ≥${PASS.winRate}%, lãi TB > 0` : `pass = ≥${PASS.n} graded, ≥${PASS.winRate}% wins, avg > 0`}</span></header>
        <p className="ac-note">{vi ? 'Ai đang học gì và đã làm bao nhiêu bài. Thanh = số bài trên số bài cần để chấm.' : 'Who is learning what and how far along. Bar = graded so far vs needed.'}</p>
        <div className="ac-rows">
          <div className="ac-row ac-row-h"><span>{vi ? 'Học viên' : 'Learner'}</span><span className="c">{vi ? 'Bài' : 'Graded'}</span><span className="c">{vi ? 'Thắng' : 'Wins'}</span><span className="c">{vi ? 'Lãi TB' : 'Avg'}</span><span>{vi ? 'Trạng thái' : 'Status'}</span></div>
          {(allLb ? board : board.slice(0, 5)).map((l) => (
            <div key={l.id} className="ac-row">
              <div className="ac-nm"><b>{l.icon} {L(l.name)}</b><span>{L(l.sub)}</span></div>
              <span className="c">{l.n ?? '–'}</span>
              <span className={`c ${cmpTone(l.winRate, PASS.winRate)}`}>{l.winRate != null ? `${l.winRate}%` : '–'}</span>
              <span className={`c ${l.avgPct == null ? '' : l.avgPct > 0 ? 'up' : 'down'}`}>{l.avgPct != null ? `${l.avgPct}%` : '–'}</span>
              <div className="ac-st">
                <span className="ac-mini"><i className={l.verdict === 'fail' ? 'bad' : ''} style={{ width: `${l.goal ? Math.min(100, ((l.n ?? 0) / l.goal) * 100) : 0}%` }} /></span>
                <span className={`ac-tag ${l.verdict === 'pass' ? 'ok' : l.verdict === 'fail' ? 'bad' : l.verdict === 'advisor' ? 'off' : 'warn'}`}>{vi ? { pass: 'Đậu', fail: 'Trượt', testing: 'Đang thi', advisor: 'Cố vấn' }[l.verdict] : { pass: 'Passed', fail: 'Failed', testing: 'Testing', advisor: 'Advisor' }[l.verdict]}</span>
              </div>
            </div>
          ))}
        </div>
        {!allLb && board.length > 5 && <button className="ac-btn ac-find" onClick={() => setAllLb(true)}>{vi ? `Xem tất cả ${board.length} học viên` : `All ${board.length} learners`}</button>}
      </section>

    </div>
  )
}
