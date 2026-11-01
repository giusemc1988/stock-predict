import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { AGENT_VERSIONS } from '../src/data/agentVersions'
import { APP_VERSION, RELEASES } from '../src/data/releases'

// the displayed app version, the newest What's new entry and package.json must agree (AGENTS.md "Every change")
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }
assert.equal(APP_VERSION, pkg.version, 'APP_VERSION (src/data/releases.ts) must equal package.json version')
assert.equal(RELEASES[0].version, APP_VERSION, 'the top RELEASES entry must be the current version')
for (const r of RELEASES) assert.equal(r.changes.length, r.changesVi?.length, `${r.version}: EN and VI lists differ`)

for (const [id, v] of Object.entries(AGENT_VERSIONS)) assert.match(v as string, /^\d+\.\d+\.\d+$/, `agent ${id} version`)
for (const id of ['volt', 'nexus', 'echo', 'lumi']) assert.ok(AGENT_VERSIONS[id as keyof typeof AGENT_VERSIONS], `${id} has a version`)
console.log('versions: ok')
