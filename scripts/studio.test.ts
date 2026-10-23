import assert from 'node:assert/strict'
import { LIBRARY, fromText, parseScenes, studioPrompt, titleLab } from '../src/lib/studio/script'
import { FADE, frameCount, plan, visible } from '../src/lib/studio/render'
import { lufs, normalise, SAMPLE_RATE, TARGET_LUFS } from '../src/lib/studio/audio'
import { rgbaToI420 } from '../src/lib/studio/encode'
import { cleanWriteAsk } from '../src/lib/studioServer'
import { STUDIO_TEXT } from '../src/lib/studio/text'
import { debugExposed, layerState, GE_TEXT } from '../src/lib/godsEye'
import { toOpenSky } from '../argus/adsbLol'
import { AREAS, merge, slim } from '../argus/snapshot'

// AI answers are cleaned into scene lines
assert.deepEqual(parseScenes('1. First line\n- Second line\n\n"Third"\n```', 5), ['First line', 'Second line', 'Third'])
assert.deepEqual(parseScenes('aa\nbb\ncc', 2), ['aa', 'bb'])

// each language is asked separately and told not to translate
const [sysVi] = studioPrompt('vi', 'faceless', 'x', 5)
assert.match(sysVi, /Không dịch/)
assert.match(studioPrompt('en', 'philosophy', 'x', 4)[0], /exactly 4 lines/)

// library: every script has EN and VI with the same scene count, and they are not copies
for (const s of LIBRARY) {
  assert.equal(s.en.length, s.vi.length, s.topic.en)
  assert.ok(s.en.every((l, i) => l !== s.vi[i]))
}
// typed scripts are cut to the shorter side
assert.equal(fromText('t', 'faceless', 'a1\na2\na3', 'b1\nb2').en.length, 2)

// timing: fades overlap neighbours by 0.7 s, never past the end
const s = LIBRARY[0]
const p = plan(s, '9:16', true)
assert.equal(p.spans.length, s.en.length)
assert.ok(Math.abs(p.spans[1].start - (p.spans[0].end - FADE)) < 1e-9)
assert.equal(visible(p, p.spans[1].start + FADE / 2).length, 2)
assert.ok(frameCount(p) > 0 && frameCount(p) === Math.ceil(p.duration * 30))
const flat = plan(s, '16:9', false)
assert.equal(flat.spans[1].start, flat.spans[0].end)

// Title Lab: titles and captions in both languages, hashtags start with #
const lab = titleLab(s)
assert.ok(lab.titles.en.length >= 3 && lab.titles.vi.length >= 3)
assert.ok(lab.hashtags.every((h) => /^#\S+$/.test(h)))
assert.ok(lab.caption.vi.includes(s.vi[0]))

// loudness: a 1 kHz sine at -20 dBFS peak is about -23 LUFS; normalising lands on the target
const n = SAMPLE_RATE * 3
const sine = () => Float32Array.from({ length: n }, (_, i) => 0.1 * Math.sin((2 * Math.PI * 1000 * i) / SAMPLE_RATE))
const before = lufs([sine(), sine()])
assert.ok(before > -24 && before < -19, `sine loudness ${before}`)
const ch = [sine(), sine()]
const after = normalise(ch)
assert.ok(Math.abs(after - TARGET_LUFS) < 0.2, `normalised to ${after}`)
assert.equal(lufs([new Float32Array(n), new Float32Array(n)]), -Infinity)

// colour: BT.709 limited range, white -> 235, black -> 16, grey chroma -> 128
const px = (r: number, g: number, b: number) => new Uint8ClampedArray([r, g, b, 255, r, g, b, 255, r, g, b, 255, r, g, b, 255])
let yuv = rgbaToI420(px(255, 255, 255), 2, 2)
assert.deepEqual([...yuv], [235, 235, 235, 235, 128, 128])
yuv = rgbaToI420(px(0, 0, 0), 2, 2)
assert.deepEqual([...yuv], [16, 16, 16, 16, 128, 128])

// server input is cleaned
assert.equal(cleanWriteAsk({ topic: '  ' }), null)
assert.deepEqual(cleanWriteAsk({ topic: 'x', mode: 'nope', scenes: 99 }), { topic: 'x', topicVi: 'x', mode: 'faceless', scenes: 12 })

// God's Eye layer reading
const J = 'application/json'
assert.equal(layerState('military', { status: 200, contentType: J, body: '{"ac":[]}' }).state, 'ok')
assert.equal(layerState('vessels', { status: 503, contentType: J, body: '{"status":"missing-key","hasKey":false}' }).state, 'key')
assert.equal(layerState('satellites', { status: 200, contentType: 'text/html', body: '<!DOCTYPE html>' }).state, 'noproxy')
assert.equal(layerState('flights', { status: 502, contentType: J, body: '{"error":"Flights unavailable"}' }).detail, 'HTTP 502 · Flights unavailable')
assert.equal(layerState('flights', null).state, 'down')
assert.equal(debugExposed({ status: 200, contentType: J, body: '[]' }), true)
assert.equal(debugExposed({ status: 200, contentType: 'text/html', body: '' }), false)

// Argus flights fallback: adsb.lol rows become OpenSky vectors (adsb.fi "aircraft" too), bad rows and duplicates dropped
const os = toOpenSky({ now: 1_700_000_000_000, ac: [{ hex: 'ABC123', flight: 'DAL1 ', lat: 40, lon: -74, alt_baro: 1000, gs: 100, track: 90 }, { hex: 'abc123', lat: 1, lon: 1 }, { hex: 'x', lat: 95, lon: 0 }] })
assert.equal(os.time, 1_700_000_000)
assert.equal(os.states.length, 1)
assert.deepEqual(os.states[0].slice(0, 2), ['abc123', 'DAL1'])
assert.ok(Math.abs((os.states[0][7] as number) - 304.8) < 1e-9 && Math.abs((os.states[0][9] as number) - 51.4444) < 1e-9)

assert.equal(toOpenSky({ now: 1, aircraft: [{ hex: 'aa', lat: 1, lon: 2 }] }).states.length, 1)

// Argus snapshot: keeps only the fields the globe reads, one row per aircraft (freshest wins), and still converts
assert.deepEqual(slim({ hex: 'a1', lat: 1, lon: 2, gs: 3, emergency: 'none', mlat: [] }), { hex: 'a1', lat: 1, lon: 2, gs: 3 })
assert.equal(slim({ hex: 'a1', lat: null, lon: 2 }), null)
const snap = merge([{ ac: [{ hex: 'A1', lat: 1, lon: 2, seen: 5 }] }, { aircraft: [{ hex: 'a1', lat: 3, lon: 4, seen: 1 }, { hex: 'b2', lat: 5, lon: 6 }] }], 1_700_000_000_000)
assert.equal(snap.ac.length, 2)
assert.equal(snap.ac.find((r) => String(r.hex).toLowerCase() === 'a1')?.lat, 3)
assert.equal(toOpenSky(snap).states.length, 2)
assert.ok(AREAS.length >= 20 && AREAS.every(([, la, lo]) => Math.abs(la) <= 90 && Math.abs(lo) <= 180))

// every label has both languages
for (const [k, v] of Object.entries({ ...STUDIO_TEXT, ...GE_TEXT })) assert.ok(v.en.trim() && v.vi.trim(), k)
console.log('studio ok')
