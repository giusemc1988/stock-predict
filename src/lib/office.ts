/**
 * Neo Hub "Office" view: turns the team board (team.json) into what each little window shows.
 * Pure logic, no network and no AI. OfficeView.tsx draws it; scripts/office.test.ts checks it.
 */
import { isOnline, type Owner, type TeamState, type TeamTask } from './team'

export type OfficeWho = 'muse' | 'hermesWin' | 'hermesUbu' | 'ubuntuPc'
export type OfficeState = 'working' | 'idle' | 'waiting' | 'error' | 'off'

export interface OfficeSeat {
  who: OfficeWho
  state: OfficeState
  /** the task being worked on (or the one waiting / failed), if any */
  task?: TeamTask
  /** open tasks (not done, dropped or failed) that belong to this seat */
  queued: number
  /** ISO time the machine was last seen; machines only */
  seen?: string
  note?: string
  /** last few tasks of this seat, newest first, for the details panel */
  recent: TeamTask[]
}

const OPEN = (t: TeamTask) => t.status === 'needs-ok' || t.status === 'todo' || t.status === 'running'
const newest = (a: TeamTask, b: TeamTask) => Date.parse(b.updated) - Date.parse(a.updated)

/** error only while the newest finished task of the seat is a failure (a later success clears it) */
function failed(mine: TeamTask[]): TeamTask | undefined {
  const last = mine.filter((t) => t.status === 'done' || t.status === 'failed').sort(newest)[0]
  return last?.status === 'failed' ? last : undefined
}

function seat(who: OfficeWho, owner: Owner, team: TeamState, nowMs: number, opts: { machine?: 'windows' | 'ubuntu'; lead?: boolean }): OfficeSeat {
  const mine = team.tasks.filter((t) => t.owner === owner).sort(newest)
  const open = mine.filter(OPEN)
  const running = open.find((t) => t.status === 'running')
  const needsOk = open.find((t) => t.status === 'needs-ok')
  const todo = open.find((t) => t.status === 'todo')
  const bad = failed(mine)
  const m = opts.machine ? team.machines[opts.machine] : undefined
  const base = { who, queued: open.length, seen: m?.seen, note: m?.note, recent: mine.slice(0, 4) }

  if (opts.machine && !isOnline(m, nowMs)) return { ...base, state: 'off' }
  if (running) return { ...base, state: 'working', task: running }
  if (bad) return { ...base, state: 'error', task: bad }
  if (needsOk) return { ...base, state: 'waiting', task: needsOk }
  if (todo) return { ...base, state: opts.lead ? 'working' : 'waiting', task: todo }
  return { ...base, state: 'idle' }
}

/** The four seats of the office, from the team board. */
export function officeSeats(team: TeamState, nowMs: number): OfficeSeat[] {
  const museLead = team.driver.who === 'milo'
  const muse = seat('muse', 'milo', team, nowMs, { lead: museLead })
  const win = seat('hermesWin', 'windows', team, nowMs, { machine: 'windows' })
  const ubu = seat('hermesUbu', 'ubuntu', team, nowMs, { machine: 'ubuntu' })
  // the Ubuntu PC itself: on or off, and busy while Hermes Ubuntu works on it
  const pc: OfficeSeat = { ...ubu, who: 'ubuntuPc', state: ubu.state === 'off' ? 'off' : ubu.state === 'working' ? 'working' : 'idle', task: ubu.state === 'working' ? ubu.task : undefined }
  return [muse, win, ubu, pc]
}
