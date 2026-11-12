import assert from 'node:assert/strict'
import { officeSeats } from '../src/lib/office.ts'
import type { TeamState, TeamTask } from '../src/lib/team.ts'

const NOW = Date.parse('2026-11-12T08:00:00Z')
const iso = (minAgo: number) => new Date(NOW - minAgo * 60000).toISOString()
const task = (id: string, owner: TeamTask['owner'], status: TeamTask['status'], minAgo = 5): TeamTask => ({ id, title: id, project: 'neohub', kind: 'code', owner, status, created: iso(minAgo + 1), updated: iso(minAgo) })
const team = (tasks: TeamTask[], over: Partial<TeamState> = {}): TeamState => ({ v: 1, driver: { who: 'claude', since: null }, machines: { windows: { seen: iso(1) }, ubuntu: { seen: iso(1) } }, tasks, next: 9, ...over })
const by = (s: ReturnType<typeof officeSeats>, w: string) => s.find((x) => x.who === w)!

// everything quiet: machines on and idle, Muse standing by
let s = officeSeats(team([]), NOW)
assert.equal(s.length, 4)
assert.deepEqual(s.map((x) => x.state), ['idle', 'idle', 'idle', 'idle'])

// a running task makes that seat work; a queued one for a machine waits; the other seats stay idle
s = officeSeats(team([task('T1', 'windows', 'running'), task('T2', 'ubuntu', 'todo')]), NOW)
assert.equal(by(s, 'hermesWin').state, 'working')
assert.equal(by(s, 'hermesWin').task?.id, 'T1')
assert.equal(by(s, 'hermesUbu').state, 'waiting')
assert.equal(by(s, 'muse').state, 'idle')

// a machine that has not sent a heartbeat is off, even with work queued
s = officeSeats(team([task('T3', 'windows', 'todo')], { machines: { windows: { seen: iso(600) }, ubuntu: { seen: iso(1) } } }), NOW)
assert.equal(by(s, 'hermesWin').state, 'off')
s = officeSeats(team([], { machines: {} }), NOW)
assert.equal(by(s, 'hermesWin').state, 'off')
assert.equal(by(s, 'ubuntuPc').state, 'off')

// error shows only while the newest finished task failed; a later success clears it
s = officeSeats(team([task('T4', 'windows', 'failed', 30)]), NOW)
assert.equal(by(s, 'hermesWin').state, 'error')
s = officeSeats(team([task('T4', 'windows', 'failed', 30), task('T5', 'windows', 'done', 10)]), NOW)
assert.equal(by(s, 'hermesWin').state, 'idle')

// needs-ok waits for Chanh; when Milo is in charge a queued task means Muse is working
s = officeSeats(team([task('T6', 'milo', 'needs-ok')]), NOW)
assert.equal(by(s, 'muse').state, 'waiting')
s = officeSeats(team([task('T7', 'milo', 'todo')], { driver: { who: 'milo', since: iso(5) } }), NOW)
assert.equal(by(s, 'muse').state, 'working')
s = officeSeats(team([task('T7', 'milo', 'todo')]), NOW)
assert.equal(by(s, 'muse').state, 'waiting')

// the Ubuntu PC is on while Hermes Ubuntu waits, and busy while it works; recent tasks are newest first
s = officeSeats(team([task('T8', 'ubuntu', 'running'), task('T9', 'ubuntu', 'done', 60)]), NOW)
assert.equal(by(s, 'ubuntuPc').state, 'working')
assert.deepEqual(by(s, 'hermesUbu').recent.map((t) => t.id), ['T8', 'T9'])

console.log('office tests passed')
