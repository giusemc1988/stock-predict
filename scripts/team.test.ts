import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// @ts-expect-error plain JS modules
import { applyAction, emptyTeam, isOnline, nextJob, renderQueue, updateLog, logRow, toHandOff, handedOpen, taskFile, taskFileName, resultFileName, miloOpen, miloStage, isStuck, miloPrompt, readProgress, sinceClaude, needsChanh, progressFileName } from './team-core.mjs'
// @ts-expect-error plain JS modules
import { applyInDir } from './team-apply.mjs'
import { checkAction, parseLog, readTeam, sendAction } from '../src/lib/team'
// @ts-expect-error plain JS modules
import { backupBayReady, cmpVersion, toPrune } from './bayready-backup.mjs'
import { readdirSync } from 'node:fs'

const NOW = '2026-11-12T01:00:00.000Z'
let s = emptyTeam()

// add: code task for Claude, red waits for Chanh
let r = applyAction(s, { type: 'add', title: 'Fix TRANG card', project: 'bayready', owner: 'claude', red: true }, NOW, 'chanh')
s = r.state
assert.equal(s.tasks[0].id, 'T1')
assert.equal(s.tasks[0].status, 'needs-ok')
assert.equal(s.tasks[0].kind, 'code')
assert.match(r.log.what, /needs Chanh OK/)
// approve, then a second approve throws
s = applyAction(s, { type: 'approve', id: 'T1' }, NOW, 'chanh').state
assert.equal(s.tasks[0].status, 'todo')
assert.throws(() => applyAction(s, { type: 'approve', id: 'T1' }, NOW, 'chanh'))

// machine work must be a whitelisted script, never free text
assert.throws(() => applyAction(s, { type: 'add', title: 'rm -rf /', project: 'neohub', owner: 'windows' }, NOW, 'chanh'))
s = applyAction(s, { type: 'add', project: 'neohub', owner: 'windows', job: 'neohub-test' }, NOW, 'chanh').state
assert.equal(s.tasks[1].kind, 'job')
assert.equal(nextJob(s, 'windows')?.id, 'T2')
assert.equal(nextJob(s, 'ubuntu'), null)
// claim + finish
s = applyAction(s, { type: 'claim', id: 'T2' }, NOW, 'windows').state
assert.equal(nextJob(s, 'windows'), null)
s = applyAction(s, { type: 'finish', id: 'T2', ok: true, result: 'tests pass' }, NOW, 'windows').state
assert.equal(s.tasks[1].status, 'done')

// idea gets a default title; empty code title throws
s = applyAction(s, { type: 'add', kind: 'idea', project: 'atlas', owner: 'claude' }, NOW, 'chanh').state
assert.match(s.tasks[2].title, /ideas for atlas/)
assert.throws(() => applyAction(s, { type: 'add', title: ' ', project: 'atlas', owner: 'claude' }, NOW, 'chanh'))

// driver switch, and the same driver twice throws
r = applyAction(s, { type: 'driver', who: 'milo' }, NOW, 'chanh')
assert.equal(r.state.driver.who, 'milo')
assert.equal(r.log.type, 'OUT')
assert.throws(() => applyAction(r.state, { type: 'driver', who: 'milo' }, NOW, 'chanh'))

// heartbeat and online window
s = applyAction(s, { type: 'beat', machine: 'ubuntu', note: 'ok' }, NOW, 'ubuntu').state
assert.ok(isOnline(s.machines.ubuntu, Date.parse(NOW) + 10 * 60000))
assert.ok(!isOnline(s.machines.ubuntu, Date.parse(NOW) + 60 * 60000))
assert.ok(!isOnline(undefined, Date.parse(NOW)))

// rendered views
assert.match(renderQueue(s), /\| T2 \| job: neohub-test \| neohub \| windows \| done \|/)
const md = updateLog('driver: Claude since x\n\n| a |\n', r.state, logRow(NOW, r.log))
assert.match(md.split('\n')[0], /^driver: Milo since 2026-11-12 01:00/)
assert.match(md, /\| 2026-11-12 01:00 \| chanh \| OUT \|/)
assert.equal(parseLog(md)[0].type, 'OUT')

// the browser may only send add / approve / cancel / driver
assert.equal(checkAction({ type: 'claim', id: 'T1' }), null)
assert.equal(checkAction({ type: 'beat', machine: 'windows' }), null)
assert.equal(checkAction({ type: 'approve', id: 'x; rm' }), null)
assert.equal(checkAction({ type: 'add', project: 'neohub', owner: 'ubuntu', job: 'evil' }), null)
assert.deepEqual(checkAction({ type: 'driver', who: 'claude' }), { type: 'driver', who: 'claude' })
assert.equal(checkAction({ type: 'add', title: 'Build a page', project: 'neohub', owner: 'claude' })?.kind, 'code')

// apply in a folder (what the workflow does)
const dir = mkdtempSync(join(tmpdir(), 'team-'))
const hd = join(dir, 'docs/handoff')
mkdirSync(hd, { recursive: true })
writeFileSync(join(hd, 'LOG.md'), 'driver: Claude since 2026-11-11 23:30 UTC\n\n| h |\n')
applyInDir(dir, { type: 'add', title: 'First task', project: 'neohub', owner: 'milo' }, 'chanh', NOW)
assert.equal(JSON.parse(readFileSync(join(hd, 'team.json'), 'utf8')).tasks[0].id, 'T1')
assert.match(readFileSync(join(hd, 'QUEUE.md'), 'utf8'), /First task/)
assert.match(readFileSync(join(hd, 'LOG.md'), 'utf8'), /ADD \| T1 First task/)

// Worker side with a fake GitHub
const calls: { url: string; init?: RequestInit }[] = []
const fake = (async (url: string, init?: RequestInit) => {
  calls.push({ url, init })
  if (url.includes('/dispatches')) return new Response(null, { status: 204 })
  if (url.includes('team.json')) return new Response(JSON.stringify(s))
  return new Response(md)
}) as typeof fetch
assert.equal(await sendAction({ type: 'approve', id: 'T1' }, null, fake), 'nokey')
assert.equal(await sendAction({ type: 'bogus' }, 'k', fake), 'bad')
assert.equal(await sendAction({ type: 'approve', id: 'T1' }, 'k', fake), 'ok')
const sent = JSON.parse(String(calls.at(-1)?.init?.body))
assert.equal(sent.ref, 'main')
assert.deepEqual(JSON.parse(sent.inputs.action), { type: 'approve', id: 'T1' })
assert.match(calls.at(-1)!.url, /team-update\.yml\/dispatches$/)
const read = await readTeam('k', fake)
assert.equal(read?.team.tasks.length, s.tasks.length)
assert.equal(read?.log[0].type, 'OUT')
assert.ok(calls.some((c) => c.url.includes('ref=handoff-log')))

// BayReady Desktop backups: two newest versions, never other files
assert.ok(cmpVersion('2.63', '2.9') > 0 && cmpVersion('2.48', '2.48') === 0)
assert.deepEqual(toPrune(['bayready-v2.48.zip', 'notes.txt', 'bayready-v2.63.zip', 'bayready-v2.9.zip']), ['bayready-v2.9.zip'])
const src = mkdtempSync(join(tmpdir(), 'br-src-'))
const bk = mkdtempSync(join(tmpdir(), 'br-bk-'))
writeFileSync(join(bk, 'keep-me.txt'), 'x')
for (const v of ['2.61', '2.62', '2.63']) {
  writeFileSync(join(src, 'manifest.json'), JSON.stringify({ version: v }))
  assert.match(backupBayReady(src, bk), new RegExp(`saved bayready-v${v}`))
}
assert.equal(backupBayReady(src, bk), null) // same version: nothing to do
assert.deepEqual(readdirSync(bk).sort(), ['bayready-v2.62.zip', 'bayready-v2.63.zip', 'keep-me.txt'])
assert.equal(backupBayReady(join(src, 'nope'), bk), null)

console.log('team: ok')

// ---- board tasks for Milo: brief, hand-off by a machine, result read back ----
{
  let m = emptyTeam()
  m = applyAction(m, { type: 'add', title: 'Add autostart for the serve script', project: 'bayready', owner: 'milo', brief: 'Step 1: check.\n\n\n\nStep 2:   register   task.\r\nDo not touch watcher.' }, NOW, 'chanh').state
  const t = m.tasks[0]
  assert.equal(t.brief, 'Step 1: check.\n\nStep 2: register task.\nDo not touch watcher.')
  assert.equal(toHandOff(m).length, 1)
  assert.match(taskFile(t), /Goal: Add autostart/)
  assert.match(taskFile(t), /RESULT-board-T1\.md/)
  assert.equal(taskFileName('T1'), 'TASK-board-T1.md')
  assert.equal(resultFileName('T1'), 'RESULT-board-T1.md')
  // a machine job never carries a brief; a Claude task is never handed off
  const j = applyAction(m, { type: 'add', project: 'neohub', owner: 'windows', job: 'status', brief: 'x' }, NOW, 'chanh').state
  assert.equal(j.tasks[1].brief, undefined)
  const c2 = applyAction(m, { type: 'add', title: 'Claude work', project: 'neohub', owner: 'claude' }, NOW, 'chanh').state
  assert.throws(() => applyAction(c2, { type: 'handoff', id: 'T2', machine: 'windows' }, NOW, 'hermes-win'))
  assert.throws(() => applyAction(m, { type: 'handoff', id: 'T1', machine: 'mac' }, NOW, 'hermes-win'))
  const h = applyAction(m, { type: 'handoff', id: 'T1', machine: 'ubuntu' }, NOW, 'hermes-ubuntu')
  assert.equal(h.log.type, 'HANDOFF')
  assert.deepEqual(h.state.tasks[0].handed, { at: NOW, machine: 'ubuntu' })
  assert.equal(toHandOff(h.state).length, 0)
  assert.throws(() => applyAction(h.state, { type: 'handoff', id: 'T1', machine: 'windows' }, NOW, 'hermes-win')) // only once
  assert.equal(handedOpen(h.state, 'ubuntu').length, 1)
  assert.equal(handedOpen(h.state, 'windows').length, 0)
  const d = applyAction(h.state, { type: 'finish', id: 'T1', ok: true, result: 'DONE task registered' }, NOW, 'hermes-ubuntu').state
  assert.equal(d.tasks[0].status, 'done')
  assert.equal(handedOpen(d, 'ubuntu').length, 0)
  // red Milo task is not handed off until Chanh approves
  const rd = applyAction(emptyTeam(), { type: 'add', title: 'Change live rule', project: 'atlas', owner: 'milo', red: true }, NOW, 'chanh').state
  assert.equal(toHandOff(rd).length, 0)
  // the browser may send a brief; it may not send handoff
  assert.equal(checkAction({ type: 'add', title: 'Do it', project: 'neohub', owner: 'milo', brief: 'steps' })?.type, 'add')
  assert.equal((checkAction({ type: 'add', title: 'Do it', project: 'neohub', owner: 'milo', brief: 'steps' }) as { brief?: string }).brief, 'steps')
  assert.equal(checkAction({ type: 'handoff', id: 'T1', machine: 'windows' }), null)
}
console.log('team board: Milo hand-off ok')

// Milo prompt is built from the board with no AI, and stages follow the task
{
  let s = applyAction(emptyTeam(), { type: 'add', title: 'Fix the status tiles', project: 'bayready', owner: 'milo', brief: 'Step 1: open content.js' }, '2026-11-12T10:00:00.000Z', 'chanh').state
  s = applyAction(s, { type: 'add', title: 'Other work', project: 'neohub', owner: 'claude' }, '2026-11-12T10:00:00.000Z', 'chanh').state
  assert.deepEqual(miloOpen(s).map((t: { id: string }) => t.id), ['T1'])
  assert.equal(miloStage(s.tasks[0]), 1)
  s = applyAction(s, { type: 'handoff', id: 'T1', machine: 'windows' }, '2026-11-12T10:01:00.000Z', 'hermes-win').state
  assert.equal(miloStage(s.tasks[0]), 2)
  assert.equal(isStuck(s.tasks[0], Date.parse('2026-11-12T10:10:00.000Z')), false)
  assert.equal(isStuck(s.tasks[0], Date.parse('2026-11-12T10:30:00.000Z')), true)
  const p = miloPrompt(miloOpen(s), 2)
  assert.match(p, /Goal: Fix the status tiles/)
  assert.match(p, /Step 1: open content\.js/)
  assert.match(p, /2 pictures/)
  assert.match(p, /RESULT-board-T1\.md/)
  assert.match(p, /TASK-board-T1\.md is already in milo-shared on the windows machine/)
  assert.equal(miloPrompt([]), '')
  s = applyAction(s, { type: 'finish', id: 'T1', ok: true, result: 'DONE' }, '2026-11-12T10:40:00.000Z', 'hermes-win').state
  assert.equal(miloStage(s.tasks[0]), 4)
  assert.equal(miloOpen(s).length, 0)
}

// progress notes, what needs Chanh, catch-up for Claude, lessons
{
  let s = applyAction(emptyTeam(), { type: 'add', title: 'Fix the tiles', project: 'bayready', owner: 'milo' }, '2026-11-12T10:00:00.000Z', 'claude').state
  assert.equal(s.claudeSeen, '2026-11-12T10:00:00.000Z')
  assert.equal(sinceClaude(s).length, 0)
  s = applyAction(s, { type: 'handoff', id: 'T1', machine: 'windows' }, '2026-11-12T10:01:00.000Z', 'hermes-win').state
  assert.match(taskFile(s.tasks[0]), /PROGRESS-board-T1\.md/)
  assert.match(taskFile(s.tasks[0]), /LESSON:/)
  assert.equal(progressFileName('T1'), 'PROGRESS-board-T1.md')
  assert.deepEqual(readProgress('# reading content.js\n- editing kpis()\nNEED: which tiles count as main?\n'), { text: 'editing kpis()', need: 'which tiles count as main?' })
  assert.equal(needsChanh(s, Date.parse('2026-11-12T10:30:00.000Z')).length, 1) // handed 29 min ago, nobody opened it
  let r = applyAction(s, { type: 'note', id: 'T1', text: 'editing kpis()', need: 'which tiles count as main?' }, '2026-11-12T10:31:00.000Z', 'hermes-win')
  s = r.state
  assert.equal(r.log.type, 'NEED')
  assert.equal(s.tasks[0].status, 'running')
  assert.equal(s.tasks[0].started, '2026-11-12T10:31:00.000Z')
  assert.equal(miloStage(s.tasks[0]), 3)
  assert.equal(needsChanh(s, Date.parse('2026-11-12T10:32:00.000Z'))[0].need, 'which tiles count as main?')
  assert.throws(() => applyAction(s, { type: 'note', id: 'T1', text: 'editing kpis()', need: 'which tiles count as main?' }, '2026-11-12T10:33:00.000Z', 'hermes-win'), /nothing new/)
  s = applyAction(s, { type: 'note', id: 'T1', text: 'testing' }, '2026-11-12T10:35:00.000Z', 'hermes-win').state
  assert.equal(s.tasks[0].need, undefined)
  assert.deepEqual(sinceClaude(s).map((t: { id: string }) => t.id), ['T1'])
  assert.match(renderQueue(s), /New since Claude last looked[\s\S]*T1 \*\*running\*\* by hermes-win/)
  assert.throws(() => applyAction(s, { type: 'seen' }, '2026-11-12T10:36:00.000Z', 'chanh'), /only Claude/)
  r = applyAction(s, { type: 'finish', id: 'T1', ok: true, result: 'DONE\nchanged kpis()\nLESSON: check the label list before hiding a tile' }, '2026-11-12T10:40:00.000Z', 'hermes-win')
  assert.equal(r.state.tasks[0].lesson, 'check the label list before hiding a tile')
  assert.equal(r.log.lesson, 'check the label list before hiding a tile')
  s = applyAction(r.state, { type: 'seen' }, '2026-11-12T11:00:00.000Z', 'claude').state
  assert.equal(sinceClaude(s).length, 0)
  // LESSONS.md is appended by the apply step
  const d = mkdtempSync(join(tmpdir(), 'team-lesson-'))
  mkdirSync(join(d, 'docs/handoff'), { recursive: true })
  applyInDir(d, { type: 'add', title: 'Lesson flow', project: 'neohub', owner: 'milo' }, 'chanh', '2026-11-12T10:00:00.000Z')
  applyInDir(d, { type: 'finish', id: 'T1', ok: false, result: 'FAILED\nLESSON: run the helper, never unzip by hand' }, 'hermes-win', '2026-11-12T10:05:00.000Z')
  assert.match(readFileSync(join(d, 'docs/handoff/LESSONS.md'), 'utf8'), /\| 2026-11-12 \| T1 \| neohub \| hermes-win \| run the helper, never unzip by hand \|/)
  console.log('team board: progress, catch-up, lessons ok')
}

// a long pasted request keeps all of its text (T9 on 2026-11-13 lost everything after 300 characters)
{
  const longText = 'Fix two sign-in errors. ' + 'Step detail number one is here. '.repeat(30) + 'LAST-WORD'
  const s = applyAction(emptyTeam(), { type: 'add', title: longText, project: 'neohub', owner: 'milo', brief: 'extra note' }, NOW, 'chanh').state
  assert.ok(s.tasks[0].title.length < 200)
  assert.match(s.tasks[0].title, /full text in the brief/)
  assert.match(s.tasks[0].brief, /LAST-WORD/)
  assert.match(s.tasks[0].brief, /extra note$/)
  assert.match(taskFile(s.tasks[0]), /LAST-WORD/)
  assert.equal(checkAction({ type: 'add', title: longText, project: 'neohub', owner: 'milo' })?.type === 'add' && checkAction({ type: 'add', title: longText, project: 'neohub', owner: 'milo' })!.title, longText)
  const short = applyAction(emptyTeam(), { type: 'add', title: 'Short one', project: 'neohub', owner: 'milo' }, NOW, 'chanh').state
  assert.equal(short.tasks[0].brief, undefined)
  console.log('team board: long request kept whole ok')
}
