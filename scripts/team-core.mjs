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
export const STATUSES = ['needs-ok', 'todo', 'running', 'done', 'failed', 'cancelled']
/** A machine counts as on when its last heartbeat is newer than this. */
export const ONLINE_MS = 45 * 60 * 1000
const MAX_TITLE = 300
const MAX_RESULT = 1500
const KEEP_DONE = 40

export const emptyTeam = () => ({ v: 1, driver: { who: 'claude', since: null }, machines: {}, tasks: [], next: 1 })

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
  const s = structuredClone(state ?? emptyTeam())
  const who = text(by, 20) || 'chanh'
  if (!a || typeof a !== 'object') throw new Error('no action')
  switch (a.type) {
    case 'add': {
      const owner = OWNERS.includes(a.owner) ? a.owner : 'claude'
      const project = PROJECTS.includes(a.project) ? a.project : 'other'
      const kind = MACHINES.includes(owner) ? 'job' : a.kind === 'idea' ? 'idea' : 'code'
      if (kind === 'job' && !JOBS.includes(a.job)) throw new Error('unknown job')
      const title = kind === 'job' ? `job: ${a.job}` : kind === 'idea' ? text(a.title, MAX_TITLE) || `3 new ideas for ${project}` : text(a.title, MAX_TITLE)
      if (title.length < 3) throw new Error('empty title')
      const id = `T${s.next++}`
      const red = kind === 'code' && a.red === true
      s.tasks.push({ id, title, project, kind, owner, ...(kind === 'job' ? { job: a.job } : {}), status: red ? 'needs-ok' : 'todo', created: now, updated: now, by: who })
      return { state: trim(s), log: { who, type: 'ADD', what: `${id} ${title} → ${owner}${red ? ' (needs Chanh OK)' : ''}`, ref: project } }
    }
    case 'approve': {
      const t = find(s, a.id)
      if (t.status !== 'needs-ok') throw new Error('not waiting for OK')
      Object.assign(t, { status: 'todo', updated: now })
      return { state: s, log: { who, type: 'OK', what: `${t.id} approved: ${t.title}`, ref: t.project } }
    }
    case 'cancel': {
      const t = find(s, a.id)
      if (t.status === 'done' || t.status === 'cancelled') throw new Error('already closed')
      Object.assign(t, { status: 'cancelled', updated: now })
      return { state: trim(s), log: { who, type: 'CANCEL', what: `${t.id} ${t.title}`, ref: t.project } }
    }
    case 'claim': {
      const t = find(s, a.id)
      if (t.status !== 'todo') throw new Error('not todo')
      Object.assign(t, { status: 'running', updated: now, by: who })
      return { state: s, log: { who, type: 'CLAIM', what: `${t.id} ${t.title}`, ref: t.project } }
    }
    case 'finish': {
      const t = find(s, a.id)
      if (t.status !== 'running' && t.status !== 'todo') throw new Error('not open')
      Object.assign(t, { status: a.ok ? 'done' : 'failed', updated: now, result: text(a.result, MAX_RESULT) })
      return { state: trim(s), log: { who, type: a.ok ? 'DONE' : 'FAILED', what: `${t.id} ${t.title}${t.result ? `: ${t.result.slice(0, 120)}` : ''}`, ref: t.project } }
    }
    case 'driver': {
      if (a.who !== 'claude' && a.who !== 'milo') throw new Error('driver is claude or milo')
      if (s.driver.who === a.who) throw new Error(`driver is already ${a.who}`)
      s.driver = { who: a.who, since: now }
      return { state: s, log: { who, type: a.who === 'milo' ? 'OUT' : 'CLAUDE-BACK', what: `driver: ${a.who}`, ref: '' } }
    }
    case 'beat': {
      if (!MACHINES.includes(a.machine)) throw new Error('unknown machine')
      s.machines[a.machine] = { seen: now, note: text(a.note, 200) }
      return { state: s, log: null }
    }
    default:
      throw new Error(`unknown action ${a.type}`)
  }
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
  ].join('\n')
}

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
