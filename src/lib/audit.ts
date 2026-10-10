/**
 * Decision log: every AI buy or sell decision, accepted or rejected, with the data
 * (source, label, age), price and checks behind it. Practice decisions are saved with
 * the practice account (and in public/practice.json for the server); robot orders on
 * your paper account are saved in this browser.
 */
import type { DataStamp } from './dataGuard'

export interface AuditEntry {
  id: string
  time: number // ms
  symbol: string
  side: 'buy' | 'sell'
  /** practice = practice account, robot = your paper account's auto-trader. */
  account: 'practice' | 'robot'
  accepted: boolean
  en: string
  vi: string
  price: number
  /** Bar the decision used (unix seconds), when there was one. */
  barTime?: number
  data?: DataStamp
  verdict?: string
  tradeScore?: number | null
  /** Checks that passed (names only) and the one that stopped it, if any. */
  passed?: string[]
  blockedBy?: string
  /** Skill ids and versions that fed the decision, e.g. "analyst@2". */
  skills?: string[]
}

export const MAX_AUDIT = 400

let seq = 0
export function pushAudit(list: AuditEntry[], e: Omit<AuditEntry, 'id'>, cap = MAX_AUDIT) {
  list.unshift({ ...e, id: `${e.time.toString(36)}a${(seq++).toString(36)}` })
  if (list.length > cap) list.length = cap
}

// ---------- robot orders on the paper account (this browser only) ----------

const KEY = 'arc.robotAudit.v1'

export function loadRobotAudit(): AuditEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export function logRobot(e: Omit<AuditEntry, 'id' | 'account'>) {
  const list = loadRobotAudit()
  pushAudit(list, { ...e, account: 'robot' }, 200)
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* storage blocked: the log is kept for this visit only */
  }
}
