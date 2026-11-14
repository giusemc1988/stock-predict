// Scout: the finder of the Max pipeline. Fixed checks, no AI, no tokens. A finding becomes a proposal ("Đề xuất")
// on the Max board; the board remembers every key, so a finding is proposed once and a dropped one never comes back.
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { gate } from './bayready-gate.mjs'

/** How often one machine runs the scout when nothing else asks for it. */
export const SCOUT_EVERY_MS = 6 * 3600 * 1000
export const scoutDue = (m, nowMs) => !m?.scoutAt || nowMs - Date.parse(m.scoutAt) > SCOUT_EVERY_MS

const short = (x) => createHash('sha1').update(x).digest('hex').slice(0, 8)

/** Returns proposals: { title, project, risk, evidence, check, key }. `src` = the BayReady source folder on this machine. */
export function scout({ src }) {
  const out = []
  if (src && existsSync(join(src, 'manifest.json'))) {
    const bad = gate(src, null)
    if (bad.length) {
      out.push({
        title: `BayReady: kiểm tra tự động báo ${bad.length} lỗi trong code nguồn`,
        project: 'bayready',
        risk: 'low',
        evidence: bad.slice(0, 5).join('; ').slice(0, 600),
        check: `node bayready-gate.mjs <source folder> prints "GATE: green"`,
        key: `bayready-gate:${short(bad.slice().sort().join('|'))}`,
      })
    }
  }
  return out
}
