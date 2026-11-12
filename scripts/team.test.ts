import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// @ts-expect-error plain JS modules
import { applyAction, emptyTeam, isOnline, nextJob, renderQueue, updateLog, logRow } from './team-core.mjs'
// @ts-expect-error plain JS modules
import { applyInDir } from './team-apply.mjs'
import { checkAction, parseLog, readTeam, sendAction } from '../src/lib/team'

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

console.log('team: ok')
