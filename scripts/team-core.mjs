/**
 * Team control (Neo Hub "Đội"): one shared state for Claude, Milo (Muse) and the two Hermes machines,
 * kept in docs/handoff/team.json on the branch `handoff-log`. Plain JS so the GitHub workflow
 * (team-update.yml) and the machine bridge (team-bridge.mjs) run it with no build step.
 * Every change goes through applyAction(); the Markdown views (QUEUE.md, LOG.md) are rendered from it.
 */
export const MACHINES = ['windows', 'ubuntu']
export const OWNERS = ['claude', 'milo', 'windows', 'ubuntu']
export const PROJECTS = ['bayready', 'neohub', 'atlas', 'nova', 'volt', 'other']
/** Jobs a machine may run: fixed scripts only (Chanh 2026-11-12: Hermes runs scripts, Claude/Milo write code). */
export const JOBS = ['status', 'neohub-test', 'bayready-pull', 'bayready-zip']
export const STATUSES = ['proposed', 'needs-ok', 'todo', 'running', 'done', 'failed', 'cancelled']
/** Pipeline roles of a code task: the coder writes the change, the reviewer (another model) checks it. */
export const ROLES = ['coder', 'review']
/** A change goes back to the coder at most this many times before it waits for Chanh. */
export const MAX_ROUNDS = 3
const MAX_FEED = 60
const MAX_SEEN = 300
/** A machine counts as on when its last heartbeat is newer than this. */
export const ONLINE_MS = 45 * 60 * 1000
const MAX_TITLE = 300
const MAX_RESULT = 1500
const MAX_BRIEF = 4000
const MAX_NOTE = 300
const MAX_LESSON = 400
const KEEP_DONE = 40

export const emptyTeam = () => ({ v: 1, driver: { who: 'claude', since: null }, machines: {}, tasks: [], next: 1, feed: [], seen: [] })

/** Multi-line text (a brief): keeps line breaks, drops other control characters. The repo is public: never put secrets in a brief. */
const block = (x, max) => (typeof x === 'string' ? x.replace(/\r/g, '').replace(/[^\S\n]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max) : '')
const text = (x, max) => (typeof x === 'string' ? x.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const find = (s, id) => {
  const t = s.tasks.find((x) => x.id === id)
  if (!t) throw new Error(`no task ${id}`)
  return t
}

/**
 * Apply one action. Returns the new state and one log line ({ who, type, what, ref }).
 * Throws on anything invalid, so a bad request never writes.
 */
export function applyAction(state, a, now, by) {
  const who = text(by, 20) || 'chanh'
  const out = applyOne(state, a, now, who)
  talk(out.state, a, out.log, now, who)
  // every changed task remembers who touched it last; anything Claude does counts as "Claude has looked"
  const before = new Map((state?.tasks ?? []).map((t) => [t.id, t.updated]))
  for (const t of out.state.tasks) if (before.get(t.id) !== t.updated) t.updatedBy = who
  if (who === 'claude') out.state.claudeSeen = now
  return out
}


/** Short team talk (the "Trao đổi" feed in Max office) written by itself from what happened. No AI. */
const ROLE_OF = { claude: 'Claude', milo: 'Milo', windows: 'Hermes Windows', ubuntu: 'Hermes Ubuntu', chanh: 'Chanh', scout: 'Scout' }
const nm = (x) => ROLE_OF[x] ?? text(x, 20)
function say(s, now, from, to, line, ref = '') {
  s.feed = [...(s.feed ?? []), { t: now, from: nm(from), to: nm(to), text: text(line, 240), ref }].slice(-MAX_FEED)
}
function talk(s, a, log, now, who) {
  if (!log) return
  const t = a.id ? s.tasks.find((x) => x.id === a.id) : s.tasks[s.tasks.length - 1]
  const id = t?.id ?? ''
  switch (a.type) {
    case 'propose': return say(s, now, a.from || 'scout', 'chanh', `${id} Đề xuất: ${t.title}`, id)
    case 'approve': return say(s, now, who, t?.owner ?? 'milo', `${id} duyệt, làm đi: ${t?.title ?? ''}`, id)
    case 'cancel': return say(s, now, who, 'team', `${id} huỷ: ${t?.title ?? ''}`, id)
    case 'handoff': return say(s, now, a.machine, 'milo', `${id} đã đưa việc cho Milo`, id)
    case 'finish':
      if (!t) return
      if (t.role === 'review') return say(s, now, 'milo', 'team', `${id} reviewer: ${t.verdict ?? (a.ok ? 'xong' : 'lỗi')}${t.merged ? ', đã merge' : ''}`, id)
      return say(s, now, 'milo', a.ok ? (t.pr ? 'reviewer' : 'chanh') : 'chanh', `${id} coder ${a.ok ? 'xong' : 'lỗi'}${t.gate ? `, cổng ${t.gate}` : ''}${t.pr ? `, PR ${t.pr}` : ''}`, id)
    default:
  }
}

function applyOne(state, a, now, who) {
  const s = structuredClone(state ?? emptyTeam())
  if (!a || typeof a !== 'object') throw new Error('no action')
  switch (a.type) {
    case 'add': {
      const owner = OWNERS.includes(a.owner) ? a.owner : 'claude'
      const project = PROJECTS.includes(a.project) ? a.project : 'other'
      const kind = MACHINES.includes(owner) ? 'job' : a.kind === 'idea' ? 'idea' : 'code'
      if (kind === 'job' && !JOBS.includes(a.job)) throw new Error('unknown job')
      const cut = (x) => (text(x, MAX_BRIEF).length > MAX_TITLE ? `${text(x, 140)}… (full text in the brief)` : text(x, MAX_TITLE))
      const title = kind === 'job' ? `job: ${a.job}` : kind === 'idea' ? text(a.title, MAX_TITLE) || `3 new ideas for ${project}` : cut(a.title)
      if (title.length < 3) throw new Error('empty title')
      const id = `T${s.next++}`
      const red = kind === 'code' && a.red === true
      // a long request (a pasted prompt) never loses text: the title keeps the start, the full text goes into the brief
      const full = kind === 'code' ? block(a.title, MAX_BRIEF) : ''
      const long = full.replace(/\s+/g, ' ').length > MAX_TITLE
      const brief = kind === 'code' ? block([long ? `Full request from ${who}:\n${full}` : '', typeof a.brief === 'string' ? a.brief : ''].filter(Boolean).join('\n\n'), MAX_BRIEF + 600) : ''
      s.tasks.push({ id, title, project, kind, owner, ...(kind === 'job' ? { job: a.job } : {}), ...(brief ? { brief } : {}), status: red ? 'needs-ok' : 'todo', created: now, updated: now, by: who })
      return { state: trim(s), log: { who, type: 'ADD', what: `${id} ${title} → ${owner}${red ? ' (needs Chanh OK)' : ''}`, ref: project } }
    }
    case 'propose': {
      // a finder (script or model) found something: it waits as an "Đề xuất" until Chanh or Claude taps Duyệt or Huỷ
      const project = PROJECTS.includes(a.project) ? a.project : 'other'
      const title = text(a.title, MAX_TITLE)
      if (title.length < 3) throw new Error('empty title')
      const key = text(a.key, 80) || `${project}:${title.toLowerCase().slice(0, 60)}`
      s.seen = s.seen ?? []
      if (s.seen.includes(key) || s.tasks.some((t) => t.key === key && !['done', 'cancelled', 'failed'].includes(t.status))) throw new Error('already proposed')
      s.seen = [...s.seen, key].slice(-MAX_SEEN)
      const risk = a.risk === 'low' ? 'low' : 'high' // unknown = careful
      const id = `T${s.next++}`
      const brief = block([a.evidence ? `Evidence: ${a.evidence}` : '', a.check ? `Done when this passes: ${a.check}` : 'No automatic check given: write one first (a test or a script), then fix.'].filter(Boolean).join('\n'), MAX_BRIEF)
      s.tasks.push({ id, title, project, kind: 'code', owner: 'milo', role: 'coder', round: 1, risk, key, from: nm(a.from || 'scout'), brief, status: 'proposed', created: now, updated: now, by: text(a.from, 20) || who })
      return { state: trim(s), log: { who, type: 'PROPOSE', what: `${id} ${title} (${risk})`, ref: project } }
    }
    case 'approve': {
      const t = find(s, a.id)
      if (t.status !== 'needs-ok' && t.status !== 'proposed') throw new Error('not waiting for OK')
      Object.assign(t, { status: 'todo', updated: now })
      return { state: s, log: { who, type: 'OK', what: `${t.id} approved: ${t.title}`, ref: t.project } }
    }
    case 'cancel': {
      const t = find(s, a.id)
      if (t.status === 'done' || t.status === 'cancelled') throw new Error('already closed')
      Object.assign(t, { status: 'cancelled', updated: now })
      if (t.key) s.seen = [...new Set([...(s.seen ?? []), t.key])].slice(-MAX_SEEN) // a dropped proposal is not proposed again
      return { state: trim(s), log: { who, type: 'CANCEL', what: `${t.id} ${t.title}`, ref: t.project } }
    }
    case 'claim': {
      const t = find(s, a.id)
      if (t.status !== 'todo') throw new Error('not todo')
      Object.assign(t, { status: 'running', updated: now, by: who })
      return { state: s, log: { who, type: 'CLAIM', what: `${t.id} ${t.title}`, ref: t.project } }
    }
    case 'handoff': {
      // a machine wrote TASK-<id>.md into Milo's folder: the task is now in front of Milo (no AI ran for this)
      const t = find(s, a.id)
      if (t.owner !== 'milo' || t.kind !== 'code') throw new Error('only Milo code tasks are handed off')
      if (t.status !== 'todo') throw new Error('not todo')
      if (t.handed) throw new Error('already handed off')
      if (!MACHINES.includes(a.machine)) throw new Error('unknown machine')
      Object.assign(t, { handed: { at: now, machine: a.machine }, updated: now })
      return { state: s, log: { who, type: 'HANDOFF', what: `${t.id} file written for Milo on ${a.machine}`, ref: t.project } }
    }
    case 'note': {
      // Milo wrote PROGRESS-board-<id>.md: the task is picked up; `text` = where the work is, `need` = what Milo needs from Chanh
      const t = find(s, a.id)
      if (t.owner !== 'milo' || t.kind !== 'code') throw new Error('only Milo code tasks take notes')
      if (t.status !== 'running' && t.status !== 'todo') throw new Error('not open')
      const progress = text(a.text, MAX_NOTE)
      const need = text(a.need, MAX_NOTE)
      if (!progress && !need) throw new Error('empty note')
      if (t.status === 'running' && (t.progress ?? '') === progress && (t.need ?? '') === need) throw new Error('nothing new')
      const first = t.status === 'todo'
      Object.assign(t, { status: 'running', updated: now, ...(first ? { started: now } : {}), progress })
      if (need) t.need = need
      else delete t.need
      return { state: s, log: { who, type: need ? 'NEED' : first ? 'START' : 'PROGRESS', what: `${t.id} ${need ? `Milo needs: ${need}` : progress}`.slice(0, 200), ref: t.project } }
    }
    case 'reopen': {
      // Milo kept working after the board closed the task as failed (newer RESULT or PROGRESS file): open it again
      const t = find(s, a.id)
      if (t.owner !== 'milo' || t.kind !== 'code') throw new Error('only Milo code tasks reopen')
      if (t.status !== 'failed') throw new Error('not failed')
      Object.assign(t, { status: 'running', updated: now, tries: (t.tries ?? 1) + 1 })
      return { state: s, log: { who, type: 'REOPEN', what: `${t.id} Milo is working on it again (try ${t.tries})`, ref: t.project } }
    }
    case 'followup': {
      // Chanh taps "Merge" (after the reviewer agreed) or "Hoàn tác" (undo a merge): a small task for Milo, ordered by Chanh himself
      const t = find(s, a.id)
      if (!t.pr) throw new Error('no pull request on this task')
      const merge = a.what === 'merge'
      if (!merge && a.what !== 'revert') throw new Error('merge or revert')
      if (merge && t.merged) throw new Error('already merged')
      if (!merge && !t.merged) throw new Error('not merged')
      delete t.need
      delete t.awaiting
      t.updated = now
      const id = `T${s.next++}`
      const brief = merge
        ? `Merge the pull request ${t.pr} (squash) now: Chanh approved it. Check that it is merged, then write "MERGED: yes" in the RESULT file. Do NOT release the BayReady zip.`
        : `Undo the merged change of ${t.pr}: open a pull request that reverts it, run the gate, merge it, then write "PR: <url>", "GATE: green|red" and "MERGED: yes". Never release the BayReady zip.`
      s.tasks.push({ id, title: `${merge ? 'Merge' : 'Hoàn tác'}: ${t.title}`.slice(0, MAX_TITLE), project: t.project, kind: 'code', owner: 'milo', role: 'merge', parent: t.id, pr: t.pr, risk: t.risk ?? 'high', brief, status: 'todo', created: now, updated: now, by: who })
      return { state: s, log: { who, type: merge ? 'MERGE-OK' : 'REVERT', what: `${t.id} ${t.pr}`, ref: t.project } }
    }
    case 'clear': {
      // Chanh 2026-11-14: "clear the cache" of the Max office. The caller (team-apply) saves every task and the talk
      // to an archive file first; here the board starts clean. Dropped proposals stay remembered so they do not return.
      if (who !== 'claude' && who !== 'chanh') throw new Error('only Claude or Chanh clear the board')
      const n = s.tasks.length
      s.seen = [...new Set([...(s.seen ?? []), ...s.tasks.map((t) => t.key).filter(Boolean)])].slice(-MAX_SEEN)
      s.tasks = []
      s.feed = []
      return { state: s, log: { who, type: 'CLEAR', what: `board cleared (${n} tasks archived)`, ref: '' } }
    }
    case 'say': {
      // one line of team talk (a role speaking to another); the feed keeps the newest 60
      const line = text(a.text, 240)
      if (line.length < 2) throw new Error('empty line')
      say(s, now, a.from || who, a.to || 'team', line, text(a.ref, 12))
      return { state: s, log: null }
    }
    case 'seen': {
      // Claude is back and has read the board: "new since Claude last looked" starts again from now
      if (who !== 'claude') throw new Error('only Claude marks the board as read')
      return { state: s, log: { who, type: 'CLAUDE-READ', what: 'Claude read the board', ref: '' } }
    }
    case 'finish': {
      const t = find(s, a.id)
      if (t.status !== 'running' && t.status !== 'todo') throw new Error('not open')
      // a line "LESSON: ..." in the result goes to LESSONS.md so the whole team learns from it
      const found = text((typeof a.result === 'string' ? a.result : '').match(/^\W*LESSON:\s*(.+)$/im)?.[1], MAX_LESSON)
      const lesson = /^none\b/i.test(found) ? '' : found
      Object.assign(t, { status: a.ok ? 'done' : 'failed', updated: now, result: text(a.result, MAX_RESULT), ...(lesson ? { lesson } : {}) })
      delete t.need
      if (t.kind === 'code' && t.owner === 'milo' && typeof a.result === 'string') pipeline(s, t, a.result, now)
      return { state: trim(s), log: { who, type: a.ok ? 'DONE' : 'FAILED', what: `${t.id} ${t.title}${t.result ? `: ${t.result.slice(0, 120)}` : ''}`, ref: t.project, ...(lesson ? { lesson, id: t.id } : {}) } }
    }
    case 'driver': {
      if (a.who !== 'claude' && a.who !== 'milo') throw new Error('driver is claude or milo')
      if (s.driver.who === a.who) throw new Error(`driver is already ${a.who}`)
      s.driver = { who: a.who, since: now }
      return { state: s, log: { who, type: a.who === 'milo' ? 'OUT' : 'CLAUDE-BACK', what: `driver: ${a.who}`, ref: '' } }
    }
    case 'beat': {
      if (!MACHINES.includes(a.machine)) throw new Error('unknown machine')
      s.machines[a.machine] = { ...(s.machines[a.machine]?.scoutAt ? { scoutAt: s.machines[a.machine].scoutAt } : {}), seen: now, note: text(a.note, 200), ...(a.scout ? { scoutAt: now } : {}) }
      return { state: s, log: null }
    }
    default:
      throw new Error(`unknown action ${a.type}`)
  }
}


/** What a result file says in fixed lines: PR: <url>, GATE: green|red, VERDICT: APPROVE|CHANGES, MERGED: yes|no. */
export function readResult(txt) {
  const line = (k) => String(txt ?? '').match(new RegExp(`^\\W*${k}:\\s*(.+)$`, 'im'))?.[1]?.trim() ?? ''
  const gate = /^green/i.test(line('GATE')) ? 'green' : /^red/i.test(line('GATE')) ? 'red' : ''
  const verdict = /^approve/i.test(line('VERDICT')) ? 'APPROVE' : /^changes/i.test(line('VERDICT')) ? 'CHANGES' : ''
  return { pr: line('PR').match(/https?:\/\/\S+/)?.[0] ?? '', gate, verdict, merged: /^yes/i.test(line('MERGED')), notes: line('NOTES') }
}
const REVIEW_HOW = (t) => [
  `Review the pull request ${t.pr} for ${t.parentTitle}. You are the REVIEWER: use the other OmniRoute combo (review-hard), not the one the coder used.`,
  'Read the diff and the task. Check: does it do what the task says, does it break anything else, is there a test or check that proves it, does it stay inside the limits (no secrets, nothing deleted, no feature removed).',
  'Run the gate again yourself. Then write in the RESULT file, in this order: first line DONE; "VERDICT: APPROVE" or "VERDICT: CHANGES"; "NOTES: <what to fix, one line>" when CHANGES; "GATE: green" or "GATE: red".',
  t.risk === 'low'
    ? 'This is a LOW-risk change. If VERDICT is APPROVE and the gate is green, merge the pull request yourself (squash), check that it is merged, and write "MERGED: yes". Otherwise write "MERGED: no" and merge nothing.'
    : 'This is a HIGH-risk change: do NOT merge. Write "MERGED: no". Chanh decides.',
  'Never push the release zip: a release only happens when Chanh says "phát hành X".',
]
const CODER_HOW = (t) => [
  `Open a new branch and a pull request in ${t.project === 'bayready' ? 'giusemc1988/bayready (private repo, the real source)' : 'giusemc1988/stock-predict'}. Never push to main.`,
  `Run the gate before you finish (${t.project === 'bayready' ? 'node milo-shared\\bayready-gate.mjs <your checkout>' : 'npm test and npm run build'}). Fix what it says until it is green, or say why you cannot.`,
  'In the RESULT file write, one per line: "PR: <url>", then "GATE: green" or "GATE: red", then what changed.',
  'Write that RESULT file right after you open the pull request, not at the end of a long session: the board marks the task done and hands the PR to the reviewer only when it reads this file. Keep working on the details afterwards if you must.',
]
const clip = (x, n = 600) => String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
/** After a pipeline result: coder done → review task; review APPROVE → merged or waits for Chanh; CHANGES / red gate → coder again (3 rounds max). */
function pipeline(s, t, txt, now) {
  const r = readResult(txt)
  if (t.role === 'merge') {
    const parent = s.tasks.find((x) => x.id === t.parent)
    if (parent && t.status === 'done' && r.merged) parent.merged = !/^Hoàn tác/.test(t.title)
    return
  }
  if (t.role === 'review') {
    const parent = s.tasks.find((x) => x.id === t.parent)
    t.verdict = r.verdict
    t.merged = r.merged
    if (!parent) return
    if (t.status === 'failed' || !r.verdict) return waitChanh(s, parent, 'reviewer chưa cho kết luận rõ', now)
    if (r.verdict === 'APPROVE' && r.gate !== 'red') {
      parent.pr = parent.pr || t.pr
      if (r.merged && parent.risk === 'low') {
        for (let p = parent, n = 0; p && n < 6; p = s.tasks.find((x) => x.id === p.parent), n++) p.merged = true // the whole chain counts as merged
        return say(s, now, 'milo', 'chanh', `${parent.id} đã merge (rủi ro thấp). Cần thì bấm Hoàn tác.`, parent.id)
      }
      return waitChanh(s, parent, 'reviewer đồng ý, chờ anh Duyệt merge', now)
    }
    return again(s, parent, r.notes || 'reviewer yêu cầu sửa', now)
  }
  if (t.role === 'coder' || !t.role) {
    if (t.status !== 'done') return
    t.pr = r.pr
    t.gate = r.gate || 'unknown'
    if (!t.pr) return // nothing to review (an answer, not a change)
    if (t.gate === 'red') return again(s, t, 'cổng kiểm tra còn đỏ', now)
    const id = `T${s.next++}`
    s.tasks.push({ id, title: `Review: ${t.title}`.slice(0, MAX_TITLE), project: t.project, kind: 'code', owner: 'milo', role: 'review', parent: t.id, pr: t.pr, risk: t.risk ?? 'high', round: t.round ?? 1, brief: block(REVIEW_HOW({ ...t, parentTitle: t.title }).join('\n'), MAX_BRIEF), status: 'todo', created: now, updated: now, by: 'pipeline' })
    say(s, now, 'milo', 'reviewer', `${id} mời xem PR của ${t.id}`, id)
  }
}
function again(s, t, why, now) {
  const round = (t.round ?? 1) + 1
  if (round > MAX_ROUNDS) return waitChanh(s, t, `sau ${MAX_ROUNDS} vòng vẫn chưa xong: ${clip(why, 120)}`, now)
  const id = `T${s.next++}`
  s.tasks.push({ id, title: `Sửa lại (vòng ${round}): ${t.title}`.slice(0, MAX_TITLE), project: t.project, kind: 'code', owner: 'milo', role: 'coder', parent: t.id, pr: t.pr, risk: t.risk ?? 'high', round, key: t.key, brief: block(`${t.brief ?? ''}\n\nReviewer / gate says: ${clip(why)}\nFix it on the SAME branch and pull request (${t.pr || 'none yet'}), then run the gate again.`, MAX_BRIEF), status: 'todo', created: now, updated: now, by: 'pipeline' })
  say(s, now, 'reviewer', 'milo', `${id} cần sửa: ${clip(why, 100)}`, id)
}
function waitChanh(s, t, why, now) {
  t.need = clip(why, MAX_NOTE)
  t.awaiting = true
  t.updated = now
  say(s, now, 'milo', 'chanh', `${t.id} chờ anh: ${t.need}`, t.id)
}

/** Keep every open task and only the newest closed ones. */
function trim(s) {
  const open = s.tasks.filter((t) => !['done', 'failed', 'cancelled'].includes(t.status))
  const closed = s.tasks.filter((t) => ['done', 'failed', 'cancelled'].includes(t.status)).slice(-KEEP_DONE)
  s.tasks = s.tasks.filter((t) => open.includes(t) || closed.includes(t))
  return s
}

/** True when the machine's last heartbeat is recent. */
export const isOnline = (m, nowMs) => !!m?.seen && nowMs - Date.parse(m.seen) < ONLINE_MS

/** The next job this machine should run, oldest first. */
export const nextJob = (s, machine) => s.tasks.find((t) => t.owner === machine && t.kind === 'job' && t.status === 'todo') ?? null

/** Milo code tasks no machine has written a TASK file for yet, oldest first. */
export const toHandOff = (s) => s.tasks.filter((t) => t.owner === 'milo' && t.kind === 'code' && t.status === 'todo' && !t.handed)
/** Milo tasks already handed off on this machine and still open: the bridge looks for their RESULT file. */
export const handedOpen = (s, machine) => s.tasks.filter((t) => t.owner === 'milo' && t.handed?.machine === machine && (t.status === 'todo' || t.status === 'running'))
/** Milo tasks closed as failed on this machine in the last day: the bridge reopens one when Milo's files are newer than the close. */
export const failedRecent = (s, machine, nowMs) => s.tasks.filter((t) => t.owner === 'milo' && t.handed?.machine === machine && t.status === 'failed' && nowMs - Date.parse(t.updated) < 24 * 3600 * 1000)
export const taskFileName = (id) => `TASK-board-${id}.md`
export const resultFileName = (id) => `RESULT-board-${id}.md`
export const progressFileName = (id) => `PROGRESS-board-${id}.md`
/** What Milo's PROGRESS file says: first plain line = where the work is, a line "NEED: ..." = what Milo needs from Chanh. */
export function readProgress(txt) {
  const lines = String(txt ?? '').split('\n').map((l) => l.replace(/^[#>*\-\s]+/, '').trim()).filter(Boolean)
  const need = lines.find((l) => /^NEED:/i.test(l))?.replace(/^NEED:\s*/i, '') ?? ''
  return { text: (lines.filter((l) => !/^NEED:/i.test(l)).pop() ?? '').slice(0, MAX_NOTE), need: need.slice(0, MAX_NOTE) }
}
/** Tasks someone else changed after Claude last looked: what Claude reads first when back. */
export const sinceClaude = (s) => s.tasks.filter((t) => t.updatedBy !== 'claude' && (!s.claudeSeen || t.updated > s.claudeSeen) && (s.claudeSeen || !['done', 'cancelled'].includes(t.status)))
/** What needs Chanh now: red tasks, Milo asking for something, a failure, or a hand-off nobody opened. */
export const needsChanh = (s, nowMs) => s.tasks.filter((t) => t.status === 'needs-ok' || t.status === 'proposed' || t.awaiting || !!t.need || isStuck(t, nowMs) || (t.status === 'failed' && nowMs - Date.parse(t.updated) < 24 * 3600 * 1000))
/** Milo's own standing rule is "write a prompt first, then wait for 'Do this prompt'". A board task is already that order. */
export const GO = (by) =>
  `GO: this task is the order to act, ${by === 'claude' ? 'given by Claude on Chanh\'s standing order' : 'given by Chanh himself with the Give button on the Max board'}. It already counts as his "Do this prompt". Start the work now. Do NOT answer with another prompt, do NOT ask him to paste anything or to type "do this prompt". Stop only for a real question (write it as NEED:) or a step that cannot be undone.`
const HOW = (id) => [
  'Before you start: read docs/library/INDEX.md (stock-predict repo) and docs/handoff/LESSONS.md (branch handoff-log), then the one playbook that fits.',
  `When you start, write ${progressFileName(id)} in milo-shared: one line saying what you are doing now. Rewrite it at each new step (newest step on the last line). If you need something from Chanh, add a line starting "NEED:". The board shows these to Chanh, so he knows the task was picked up.`,
  `When finished write ${resultFileName(id)} in milo-shared: first line DONE or FAILED, then what changed, the version, and the exact checks you ran with their real output. LAST line, always: "LESSON: ..." = one sentence the next worker must know (the cause, or what to do next time, under 400 characters). If truly nothing new was learned write "LESSON: none". The board saves every lesson in the team library (docs/handoff/LESSONS.md, listed in docs/library/INDEX.md) and shows it to everyone, so the whole team learns. A longer write-up goes in docs/library/lessons/ with your PR. Short and plain.`,
]
/** The TASK file a machine writes for Milo. Fixed shape so Milo does not have to investigate. */
export function taskFile(t) {
  return [
    `# TASK-board-${t.id} (from the Neo Hub Max board, ${t.created.slice(0, 16).replace('T', ' ')} UTC)`,
    `project: ${t.project}`,
    `given by: ${t.by ?? 'chanh'}`,
    '',
    GO(t.by),
    '',
    `Goal: ${t.title}`,
    '',
    t.brief ? `Steps and limits:\n${t.brief}` : 'No extra brief: do exactly the goal above and nothing else.',
    ...(t.role === 'coder' && t.risk ? ['', `Pipeline (coder, round ${t.round ?? 1}, risk ${t.risk}):`, ...CODER_HOW(t)] : []),
    '',
    'Rules: delete nothing, no secrets in files or chat, never remove a feature, free tools only, do not merge or deploy.',
    ...HOW(t.id),
    '',
  ].join('\n')
}

/** Milo tasks still open (waiting or working), oldest first. */
export const miloOpen = (s) => s.tasks.filter((t) => t.owner === 'milo' && t.kind === 'code' && (t.status === 'todo' || t.status === 'running'))
/** How far a Milo task is: 1 on the board, 2 file handed to Milo, 3 Milo working, 4 closed. */
export const miloStage = (t) => (['done', 'failed', 'cancelled'].includes(t.status) ? 4 : t.status === 'running' ? 3 : t.handed ? 2 : 1)
/** Handed to Milo this long ago with no result: the board tells Chanh to paste the ready prompt. */
export const STUCK_MS = 20 * 60 * 1000
export const isStuck = (t, nowMs) => miloStage(t) === 2 && nowMs - Date.parse(t.handed.at) > STUCK_MS
/**
 * A complete prompt for Milo, built from the board with fixed text (no AI), for Chanh to paste into
 * Milo's chat when nothing wakes Milo or Claude is out of limit. `pictures` = how many images Chanh pastes with it.
 */
export function miloPrompt(tasks, pictures = 0) {
  if (!tasks.length) return ''
  const one = (t) =>
    [
      `## ${t.id} (${t.project})`,
      `Goal: ${t.title}`,
      t.brief ? `Steps and limits:\n${t.brief}` : 'No extra brief: do exactly the goal above and nothing else.',
      t.handed ? `The file ${taskFileName(t.id)} is already in milo-shared on the ${t.handed.machine} machine.` : '',
      ...HOW(t.id).slice(1),
    ]
      .filter(Boolean)
      .join('\n')
  return [
    `Milo, this is work from the Neo Hub Max board (${tasks.length} task${tasks.length > 1 ? 's' : ''}). Do them in order, one at a time.`,
    GO('chanh'),
    pictures > 0 ? `Chanh pastes ${pictures} picture${pictures > 1 ? 's' : ''} with this message: look at them first, they show what he means.` : '',
    'Rules: delete nothing, no secrets in files or chat, never remove a feature, free tools only, do not merge or deploy. If a step is unclear, stop and ask Chanh instead of guessing.',
    HOW('')[0],
    '',
    tasks.map(one).join('\n\n'),
    '',
    'Answer Chanh in short plain Vietnamese: what is done, what failed, what he must press.',
  ]
    .filter((l, i) => l !== '' || i > 2)
    .join('\n')
}

const cell = (x) => String(x ?? '').replace(/\|/g, '/').replace(/\n/g, ' ')
/** QUEUE.md, rendered from team.json (do not edit by hand: use the Neo Hub Đội card). */
export function renderQueue(s) {
  const rows = s.tasks.map((t) => `| ${t.id} | ${cell(t.title)} | ${t.project} | ${t.owner} | ${t.status} | ${t.updated.slice(0, 16).replace('T', ' ')} | ${cell(t.result ?? '')} |`)
  return [
    '# Task queue (rendered from team.json, branch `handoff-log`)',
    '',
    'Do not edit by hand. Add, approve or cancel tasks on the Neo Hub Max page (Đội card), or in team.json through scripts/team-apply.mjs.',
    `Driver: **${s.driver.who}**${s.driver.since ? ` since ${s.driver.since.slice(0, 16).replace('T', ' ')} UTC` : ''}.`,
    '',
    '| id | task | project | owner | status | updated (UTC) | result |',
    '|---|---|---|---|---|---|---|',
    ...rows,
    '',
    `## New since Claude last looked${s.claudeSeen ? ` (${s.claudeSeen.slice(0, 16).replace('T', ' ')} UTC)` : ''}`,
    '',
    'Claude: read this first when back, check each one against real files, then run the `seen` action (team-update.yml, who=claude).',
    '',
    ...(sinceClaude(s).length
      ? sinceClaude(s).map((t) => `- ${t.id} **${t.status}** by ${t.updatedBy ?? t.by ?? '?'} at ${t.updated.slice(0, 16).replace('T', ' ')}: ${cell(t.title).slice(0, 120)}${t.need ? ` | NEEDS: ${cell(t.need)}` : ''}${t.progress ? ` | at: ${cell(t.progress)}` : ''}${t.result ? ` | result: ${cell(t.result).slice(0, 200)}` : ''}`)
      : ['- nothing']),
    '',
  ].join('\n')
}

/** One row for LESSONS.md (append-only, on handoff-log). */
export const lessonRow = (now, l) => `| ${now.slice(0, 10)} | ${cell(l.id)} | ${cell(l.ref)} | ${cell(l.who)} | ${cell(l.lesson)} |`
export const LESSONS_HEAD = ['# Lessons from finished board tasks', '', 'Written by itself when a RESULT has a line starting `LESSON:`. Read before a job on the same project. Longer write-ups live in docs/library/lessons/ on main.', '', '| date | task | project | who | lesson |', '|---|---|---|---|---|', ''].join('\n')

/** One LOG.md table row. */
export const logRow = (now, l) => `| ${now.slice(0, 16).replace('T', ' ')} | ${cell(l.who)} | ${l.type} | ${cell(l.what)} | ${cell(l.ref)} | — |`

/** LOG.md with its first line set to the current driver and the new row appended. */
export function updateLog(md, s, row) {
  const lines = md.split('\n')
  const head = `driver: ${s.driver.who === 'milo' ? 'Milo' : 'Claude'} since ${(s.driver.since ?? '2026-11-11T23:30').slice(0, 16).replace('T', ' ')} UTC`
  if (lines[0]?.startsWith('driver:')) lines[0] = head
  else lines.unshift(head, '')
  while (lines.length && lines[lines.length - 1] === '') lines.pop()
  if (row) lines.push(row)
  return lines.join('\n') + '\n'
}
