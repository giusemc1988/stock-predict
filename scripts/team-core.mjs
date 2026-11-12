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
const MAX_BRIEF = 4000
const KEEP_DONE = 40

export const emptyTeam = () => ({ v: 1, driver: { who: 'claude', since: null }, machines: {}, tasks: [], next: 1 })

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
      const brief = kind === 'code' ? block(a.brief, MAX_BRIEF) : ''
      s.tasks.push({ id, title, project, kind, owner, ...(kind === 'job' ? { job: a.job } : {}), ...(brief ? { brief } : {}), status: red ? 'needs-ok' : 'todo', created: now, updated: now, by: who })
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

/** Milo code tasks no machine has written a TASK file for yet, oldest first. */
export const toHandOff = (s) => s.tasks.filter((t) => t.owner === 'milo' && t.kind === 'code' && t.status === 'todo' && !t.handed)
/** Milo tasks already handed off on this machine and still open: the bridge looks for their RESULT file. */
export const handedOpen = (s, machine) => s.tasks.filter((t) => t.owner === 'milo' && t.handed?.machine === machine && (t.status === 'todo' || t.status === 'running'))
export const taskFileName = (id) => `TASK-board-${id}.md`
export const resultFileName = (id) => `RESULT-board-${id}.md`
/** The TASK file a machine writes for Milo. Fixed shape so Milo does not have to investigate. */
export function taskFile(t) {
  return [
    `# TASK-board-${t.id} (from the Neo Hub Max board, ${t.created.slice(0, 16).replace('T', ' ')} UTC)`,
    `project: ${t.project}`,
    `given by: ${t.by ?? 'chanh'}`,
    '',
    `Goal: ${t.title}`,
    '',
    t.brief ? `Steps and limits:\n${t.brief}` : 'No extra brief: do exactly the goal above and nothing else.',
    '',
    'Rules: delete nothing, no secrets in files or chat, never remove a feature, free tools only, do not merge or deploy.',
    `When finished write ${resultFileName(t.id)} in this same folder: first line DONE or FAILED, then what changed, the version, and the exact checks you ran with their real output. Short and plain.`,
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
      `When finished write ${resultFileName(t.id)} in milo-shared: first line DONE or FAILED, then what changed, the version, and the exact checks you ran with their real output.`,
    ]
      .filter(Boolean)
      .join('\n')
  return [
    `Milo, this is work from the Neo Hub Max board (${tasks.length} task${tasks.length > 1 ? 's' : ''}). Do them in order, one at a time.`,
    pictures > 0 ? `Chanh pastes ${pictures} picture${pictures > 1 ? 's' : ''} with this message: look at them first, they show what he means.` : '',
    'Rules: delete nothing, no secrets in files or chat, never remove a feature, free tools only, do not merge or deploy. If a step is unclear, stop and ask Chanh instead of guessing.',
    '',
    tasks.map(one).join('\n\n'),
    '',
    'Answer Chanh in short plain Vietnamese: what is done, what failed, what he must press.',
  ]
    .filter((l, i) => l !== '' || i > 1)
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
