import assert from 'node:assert/strict'
import { missingVi } from '../src/lib/i18n'
import { HUB_TEXT, hubText } from '../src/lib/hubText'
import { NET_TEXT } from '../src/lib/netText'
import { RELEASES } from '../src/data/releases'

// every app label has a Vietnamese version
assert.deepEqual(missingVi(), [])

// every hub label has both languages, and the same {slots} in each
for (const [k, b] of [...Object.entries(HUB_TEXT), ...Object.entries(NET_TEXT)]) {
  assert.ok(b.en.trim() && b.vi.trim(), `hub label ${k} is missing a language`)
  const slots = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join()
  assert.equal(slots(b.en), slots(b.vi), `hub label ${k} has different {slots}`)
}
assert.equal(hubText('vi', 'agentsAgree', { n: 4 }), '4/6 agent đồng ý')
assert.equal(hubText('en', 'agentsAgree', { n: 4 }), '4 of 6 agents agree')

// the newest What's new entry is written in both languages, line for line
const top = RELEASES[0]
assert.ok(top.changesVi && top.changesVi.length === top.changes.length, `release ${top.version} needs a Vietnamese line for each change`)

console.log('i18n tests passed')
