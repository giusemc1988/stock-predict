// Apply one team action to docs/handoff/team.json (+ QUEUE.md, LOG.md) in the current checkout.
// Usage: node scripts/team-apply.mjs '<action json>' <who> [dir]
// Used by .github/workflows/team-update.yml (dir = the handoff-log checkout) and team-bridge.mjs.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { applyAction, emptyTeam, lessonRow, LESSONS_HEAD, logRow, renderQueue, updateLog } from './team-core.mjs'

export function applyInDir(dir, action, who, now = new Date().toISOString()) {
  const p = (f) => join(dir, 'docs/handoff', f)
  const state = existsSync(p('team.json')) ? JSON.parse(readFileSync(p('team.json'), 'utf8')) : emptyTeam()
  const { state: next, log } = applyAction(state, action, now, who)
  writeFileSync(p('team.json'), JSON.stringify(next, null, 2) + '\n')
  writeFileSync(p('QUEUE.md'), renderQueue(next))
  const logMd = existsSync(p('LOG.md')) ? readFileSync(p('LOG.md'), 'utf8') : ''
  writeFileSync(p('LOG.md'), updateLog(logMd, next, log ? logRow(now, log) : null))
  if (log?.lesson) writeFileSync(p('LESSONS.md'), (existsSync(p('LESSONS.md')) ? readFileSync(p('LESSONS.md'), 'utf8') : LESSONS_HEAD).replace(/\n*$/, '\n') + lessonRow(now, log) + '\n')
  return { next, log }
}

if (/team-apply\.mjs$/.test(process.argv[1] ?? '')) {
  const [, , json, who = 'chanh', dir = '.'] = process.argv
  const { log } = applyInDir(dir, JSON.parse(json), who)
  console.log(log ? `${log.type}: ${log.what}` : 'ok')
}
