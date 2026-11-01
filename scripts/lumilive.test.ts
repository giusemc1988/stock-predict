import assert from 'node:assert/strict'
import { buildFastPrompt, buildGistPrompt, draftWorthIt, parseGist, speechTagFor, VAD, vadReset, vadStart, vadStep } from '../src/lib/lumiLive'

// VAD: speech then a pause cuts; silence alone is dropped; long speech is capped
{
  let s = vadStart(0.02)
  let cutAt = -1
  for (let t = 0; t < 4000; t += 100) {
    const level = t < 2000 ? 0.2 : 0.01 // 2 s of speech, then quiet
    const r = vadStep(s, level, 100)
    s = r.state
    if (r.cut) { cutAt = t; assert.equal(r.drop, false); break }
  }
  assert.ok(cutAt >= 2000 + VAD.pauseMs - 100 && cutAt <= 2000 + VAD.pauseMs + 100, `cut right after the pause, got ${cutAt}`)
  s = vadReset(s)
  assert.equal(s.speechMs, 0)
}
{
  let s = vadStart(0.02)
  let r = vadStep(s, 0.01, 100)
  for (let t = 0; t < VAD.maxChunkMs; t += 100) { r = vadStep(s, 0.01, 100); s = r.state; if (r.cut) break }
  assert.equal(r.cut, true)
  assert.equal(r.drop, true, 'pure silence is not sent')
}
{
  let s = vadStart(0.02)
  let r = vadStep(s, 0.3, 100)
  for (let t = 0; t < 20000; t += 100) { r = vadStep(s, 0.3, 100); s = r.state; if (r.cut) break }
  assert.equal(r.cut, true)
  assert.ok(s.chunkMs <= VAD.maxChunkMs, 'non-stop talk is cut at the max')
}
{
  // a quieter room (floor) does not make normal speech look like silence
  let s = vadStart(0.005)
  const r = vadStep(s, 0.05, 100)
  assert.equal(r.speaking, true)
}

// fast prompt: last line only, context included but capped
{
  const p = buildFastPrompt('You left it there!', 'en', ['a', 'b', 'c', 'Does everybody see your hair?'])
  assert.ok(p.includes('LAST LINE: You left it there!'))
  assert.ok(p.includes('- Does everybody see your hair?'))
  assert.ok(!p.includes('- a\n'), 'only the last 3 context lines')
  assert.ok(!buildFastPrompt('hi', 'und', []).includes('Earlier lines'))
}

// gist
{
  const lines = [{ text: 'How much for the tuk-tuk to the night market?', lang: 'en' }]
  assert.ok(/replies": \[\]/.test(buildGistPrompt(lines, false)))
  assert.ok(/3 short, polite/.test(buildGistPrompt(lines, true)))
  const g = parseGist('```json\n{"topicVi":"Đang trả giá tuk-tuk","replies":[{"text":"Can you do 100 baht?","vi":"100 baht được không?"},{"text":"","vi":"x"}]}\n```')
  assert.deepEqual(g, { topicVi: 'Đang trả giá tuk-tuk', replies: [{ text: 'Can you do 100 baht?', vi: '100 baht được không?' }] })
  assert.equal(parseGist('{"topicVi":""}'), null)
  assert.equal(parseGist('nope'), null)
  assert.equal(parseGist(null), null)
}

assert.equal(speechTagFor('en'), 'en-US')
assert.equal(speechTagFor('ja'), 'ja-JP')
assert.equal(speechTagFor('xx'), null)
assert.equal(draftWorthIt('hello', 'hello there my friend'), true)
assert.equal(draftWorthIt('hello there', 'hello there my'), false)
assert.equal(draftWorthIt('こんにちは', 'こんにちは、今日はいい天気'), true)

console.log('lumilive: ok')
