import assert from 'node:assert/strict'
import { buildGroupPrompt, cleanLines, cleanTripSave, fallbackGroup, mergeTrips, parseGroupResponse, parseTrips, type LumiLine, type LumiTrip } from '../src/lib/lumiTranslate'

// cleanLines: drops empty, trims, caps count and length
{
  const lines: LumiLine[] = [
    { text: '  hello there  ', lang: 'en', at: 1 },
    { text: '   ', lang: 'en', at: 2 },
    { text: 'x'.repeat(500), lang: 'en', at: 3 },
  ]
  const c = cleanLines(lines)
  assert.equal(c.length, 2)
  assert.equal(c[0].text, 'hello there')
  assert.equal(c[1].text.length, 300)
}

// buildGroupPrompt: numbers the lines, includes mode-specific scope text
{
  const lines: LumiLine[] = [{ text: 'hi', lang: 'en', at: 1 }, { text: 'hola', lang: 'es', at: 2 }]
  const talk = buildGroupPrompt(lines, 'talk')
  assert.ok(talk.includes('1. [en] hi'))
  assert.ok(talk.includes('2. [es] hola'))
  assert.ok(/one person talking directly/i.test(talk))
  const ambient = buildGroupPrompt(lines, 'ambient')
  assert.ok(/several nearby conversations/i.test(ambient))
}

// parseGroupResponse: matches line numbers back to the original lines, drops empty groups
{
  const lines: LumiLine[] = [{ text: 'rent is high', lang: 'en', at: 1 }, { text: 'maybe wait', lang: 'en', at: 2 }, { text: 'hola amigo', lang: 'es', at: 3 }]
  const ai = '```json\n{"conversations":[{"lang":"en","lineNumbers":[1,2],"summaryVi":"Hai người bàn chuyện thuê nhà."},{"lang":"es","lineNumbers":[3],"summaryVi":""}]}\n```'
  const groups = parseGroupResponse(ai, lines)
  assert.equal(groups.length, 1) // the empty-summary group is dropped
  assert.equal(groups[0].lang, 'en')
  assert.equal(groups[0].lines.length, 2)
  assert.equal(groups[0].summaryVi, 'Hai người bàn chuyện thuê nhà.')
}
// parseGroupResponse: garbage text -> no groups, never throws
assert.deepEqual(parseGroupResponse('not json at all', []), [])
assert.deepEqual(parseGroupResponse('{"conversations": "nope"}', []), [])

// fallbackGroup: one bucket per language, no AI call needed
{
  const lines: LumiLine[] = [{ text: 'a', lang: 'en', at: 1 }, { text: 'b', lang: 'en', at: 2 }, { text: 'c', lang: 'es', at: 3 }]
  const g = fallbackGroup(lines)
  assert.equal(g.length, 2)
  assert.equal(g.find((x) => x.lang === 'en')?.lines.length, 2)
}

// cleanTripSave: only a valid mode + non-empty Vietnamese summaries are kept
assert.equal(cleanTripSave({ mode: 'bad', conversations: [] }), null)
assert.equal(cleanTripSave({ mode: 'talk', conversations: [{ lang: 'en', summaryVi: '' }] }), null)
{
  const saved = cleanTripSave({ mode: 'ambient', conversations: [{ lang: 'en', summaryVi: 'Tóm tắt' }, { lang: 'xx', summaryVi: 123 }] })
  assert.equal(saved?.conversations.length, 1)
  assert.equal(saved?.mode, 'ambient')
}

// mergeTrips: adds to the front, caps the list so the key never grows without bound
{
  const existing: LumiTrip[] = Array.from({ length: 20 }, (_, i) => ({ id: `t${i}`, at: i, mode: 'ambient', conversations: [] }))
  const next = mergeTrips(existing, { mode: 'talk', conversations: [{ lang: 'en', summaryVi: 'x' }] }, 'new', 999)
  assert.equal(next.length, 20)
  assert.equal(next[0].id, 'new')
  assert.equal(next[19].id, existing[18].id) // the oldest one fell off
}

// parseTrips: tolerant of missing/garbage KV content
assert.deepEqual(parseTrips(null), [])
assert.deepEqual(parseTrips('not json'), [])
assert.deepEqual(parseTrips('{"not":"an array"}'), [])
assert.equal(parseTrips('[{"id":"a","at":1,"mode":"talk","conversations":[]}]').length, 1)

console.log('lumi: ok')
