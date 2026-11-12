/**
 * Neo Hub "Văn phòng" (team office): one board for Claude, Milo (Muse) and the two Hermes machines.
 * State lives in docs/handoff/team.json on the branch handoff-log (see scripts/team-core.mjs).
 * The Worker reads it (/api/team) and turns button taps into one action for team-update.yml (/api/team/act).
 * Machines pick up their jobs with scripts/team-bridge.mjs. No AI model runs for any of this.
 */
// @ts-expect-error plain JS module shared with the GitHub workflow and the machine bridge
import * as core from '../../scripts/team-core.mjs'
import { NOVA_REPO } from './studioJobs'

export type Owner = 'claude' | 'milo' | 'windows' | 'ubuntu'
export type Project = 'bayready' | 'neohub' | 'atlas' | 'nova' | 'volt' | 'other'
export type Job = 'status' | 'neohub-test' | 'bayready-pull' | 'bayready-zip'
export type TaskStatus = 'needs-ok' | 'todo' | 'running' | 'done' | 'failed' | 'cancelled'

export interface TeamTask {
  id: string
  title: string
  project: Project
  kind: 'code' | 'job' | 'idea'
  owner: Owner
  job?: Job
  status: TaskStatus
  created: string
  updated: string
  by?: string
  result?: string
  /** Steps and limits for the worker (Milo). Public repo: no secrets. */
  brief?: string
  /** Set when a machine wrote the TASK file into Milo's folder. */
  handed?: { at: string; machine: 'windows' | 'ubuntu' }
}
export interface TeamState {
  v: 1
  driver: { who: 'claude' | 'milo'; since: string | null }
  machines: Partial<Record<'windows' | 'ubuntu', { seen: string; note?: string }>>
  tasks: TeamTask[]
  next: number
}
export interface LogLine {
  time: string
  who: string
  type: string
  what: string
}
export type TeamAction =
  | { type: 'add'; title?: string; project: Project; owner: Owner; kind?: 'code' | 'idea'; job?: Job; red?: boolean; brief?: string }
  | { type: 'approve' | 'cancel'; id: string }
  | { type: 'driver'; who: 'claude' | 'milo' }

export const PROJECTS = core.PROJECTS as Project[]
export const JOBS = core.JOBS as Job[]
export const isOnline = core.isOnline as (m: { seen: string } | undefined, nowMs: number) => boolean
/** Apply an action locally (checks it the same way the workflow will). */
export const applyAction = core.applyAction as (s: TeamState, a: TeamAction, now: string, by: string) => { state: TeamState; log: unknown }

/** Only these actions may come from the browser; machines use claim/finish/beat through git directly. */
export function checkAction(a: unknown): TeamAction | null {
  if (!a || typeof a !== 'object') return null
  const x = a as Record<string, unknown>
  if (x.type === 'approve' || x.type === 'cancel') return typeof x.id === 'string' && /^T\d{1,6}$/.test(x.id) ? { type: x.type, id: x.id } : null
  if (x.type === 'driver') return x.who === 'claude' || x.who === 'milo' ? { type: 'driver', who: x.who } : null
  if (x.type !== 'add') return null
  try {
    // throws on anything the workflow would refuse
    applyAction(core.emptyTeam(), x as TeamAction, new Date(0).toISOString(), 'check')
  } catch {
    return null
  }
  return {
    type: 'add',
    title: typeof x.title === 'string' ? x.title.slice(0, 300) : undefined,
    project: x.project as Project,
    owner: x.owner as Owner,
    kind: x.kind === 'idea' ? 'idea' : 'code',
    job: typeof x.job === 'string' ? (x.job as Job) : undefined,
    red: x.red === true,
    ...(typeof x.brief === 'string' && x.brief.trim() ? { brief: x.brief.slice(0, 4000) } : {}),
  }
}

/** The last rows of LOG.md, newest first. */
export function parseLog(md: string, n = 12): LogLine[] {
  return md
    .split('\n')
    .filter((l) => /^\| \d{4}-\d\d-\d\d/.test(l))
    .map((l) => l.split('|').map((c) => c.trim()))
    .map((c) => ({ time: c[1], who: c[2], type: c[3], what: c[4] }))
    .slice(-n)
    .reverse()
}

// ---- server side (Worker) ----

const GH = (token: string | null, raw = false) => ({ ...(token ? { authorization: `Bearer ${token}` } : {}), accept: raw ? 'application/vnd.github.raw' : 'application/vnd.github+json', 'user-agent': 'neo-hub', 'x-github-api-version': '2022-11-28' })
const file = (path: string) => `https://api.github.com/repos/${NOVA_REPO}/contents/docs/handoff/${path}?ref=handoff-log`

export async function readTeam(token: string | null, f: typeof fetch = fetch): Promise<{ team: TeamState; log: LogLine[] } | null> {
  const [a, b] = await Promise.all([f(file('team.json'), { headers: GH(token, true) }).catch(() => null), f(file('LOG.md'), { headers: GH(token, true) }).catch(() => null)])
  if (!a?.ok) return null
  const team = (await a.json().catch(() => null)) as TeamState | null
  if (!team) return null
  return { team, log: b?.ok ? parseLog(await b.text()) : [] }
}

export async function sendAction(a: unknown, token: string | null, f: typeof fetch = fetch): Promise<'ok' | 'nokey' | 'refused' | 'bad'> {
  const action = checkAction(a)
  if (!action) return 'bad'
  if (!token) return 'nokey'
  const r = await f(`https://api.github.com/repos/${NOVA_REPO}/actions/workflows/team-update.yml/dispatches`, {
    method: 'POST',
    headers: { ...GH(token), 'content-type': 'application/json' },
    body: JSON.stringify({ ref: 'main', inputs: { action: JSON.stringify(action), who: 'chanh' } }),
  }).catch(() => null)
  return r?.status === 204 ? 'ok' : 'refused'
}
