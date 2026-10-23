import assert from 'node:assert/strict'
import { LIBRARY } from '../src/lib/studio/script'
import { DEFAULT_KIT, cleanKitSettings, cleanTag, fallbackKit, fillKit, fullCaption, itemPrompt, kitPrompt, parseItem, parseKit } from '../src/lib/studio/postkit'
import { cleanKitAsk } from '../src/lib/studioServer'

const s = LIBRARY[0]

// settings are clamped and cleaned
const k = cleanKitSettings({ hooks: 99, titles: 0, tone: 'rude', platforms: ['tiktok', 'myspace', 'tiktok'], hashtags: -3, langs: ['fr'] })
assert.equal(k.hooks, 10)
assert.equal(k.titles, 1)
assert.equal(k.tone, 'curious')
assert.deepEqual(k.platforms, ['tiktok'])
assert.equal(k.hashtags, 0)
assert.deepEqual(k.langs, DEFAULT_KIT.langs)
assert.deepEqual(cleanKitSettings(null), DEFAULT_KIT)

// the no-AI kit gives exactly the asked counts, in both languages, for each platform
for (const n of [1, 4, 10]) {
  const kit = fallbackKit(s, { ...DEFAULT_KIT, hooks: n, titles: n })
  for (const l of ['en', 'vi'] as const) {
    assert.equal(kit[l]!.hooks.length, Math.min(n, 9), `${l} hooks ${n}`)
    assert.equal(new Set(kit[l]!.hooks).size, kit[l]!.hooks.length)
    assert.equal(kit[l]!.titles.length, Math.min(n, 10), `${l} titles ${n}`)
    assert.deepEqual(Object.keys(kit[l]!.captions).sort(), ['facebook', 'instagram', 'tiktok', 'youtube'])
  }
}
const vi = fallbackKit(s, DEFAULT_KIT).vi!
assert.equal(vi.hooks[0], s.vi[0])
assert.ok(vi.hooks.every((h) => !/Nobody|truth about/.test(h)), 'Vietnamese hooks are Vietnamese')
assert.equal(vi.hashtags.length, DEFAULT_KIT.hashtags)
assert.ok(vi.hashtags.every((t) => !t.startsWith('#') && !/\s/.test(t)))
// emoji and call to action switches
const plain = fallbackKit(s, { ...DEFAULT_KIT, emoji: false, cta: false }).en!
assert.ok(!/\p{Extended_Pictographic}/u.test(plain.captions.tiktok!))
assert.ok(!/Follow/.test(plain.captions.tiktok!))
assert.match(fallbackKit(s, DEFAULT_KIT).en!.captions.tiktok!, /Follow for part 2/)
assert.ok(fallbackKit(s, { ...DEFAULT_KIT, length: 'long' }).en!.captions.youtube!.length > fallbackKit(s, { ...DEFAULT_KIT, length: 'short' }).en!.captions.youtube!.length)
assert.equal(fallbackKit(s, { ...DEFAULT_KIT, hashtags: 0 }).en!.hashtags.length, 0)

// prompts carry the counts and settings
assert.match(kitPrompt('en', { ...DEFAULT_KIT, hooks: 7 }, s)[0], /Write 7 opening hooks/)
assert.match(kitPrompt('vi', { ...DEFAULT_KIT, titles: 3, platforms: ['youtube'] }, s)[0], /Viết 3 tiêu đề.*"youtube": "\.\.\."/)
assert.match(kitPrompt('vi', DEFAULT_KIT, s)[0], /Không dịch/)
assert.match(itemPrompt('en', DEFAULT_KIT, s, 'hook', ['Old one'])[1], /Already there:\n- Old one/)

// AI answers: JSON in chatter, hashtags cleaned, captions lose trailing hashtags, counts cut
const ai = parseKit('Sure!\n```json\n{"hooks":["A","B","C"],"titles":["T1"],"captions":{"tiktok":"Hi there #fyp #ocean","myspace":"x"},"hashtags":["#Ocean Facts","deep sea","biển"]}\n```', { ...DEFAULT_KIT, hooks: 2 })!
assert.deepEqual(ai.hooks, ['A', 'B'])
assert.equal(ai.captions.tiktok, 'Hi there')
assert.equal('myspace' in ai.captions, false)
assert.deepEqual(ai.hashtags, ['OceanFacts', 'deepsea', 'biển'])
assert.equal(parseKit('no json here', DEFAULT_KIT), null)
assert.equal(parseKit('{"hooks": [', DEFAULT_KIT), null)
assert.equal(cleanTag('##Hello-World!'), 'HelloWorld')

// short AI answers are filled from the no-AI kit
const filled = fillKit(ai, fallbackKit(s, DEFAULT_KIT).en!, DEFAULT_KIT)
assert.equal(filled.hooks.length, 5)
assert.deepEqual(filled.hooks.slice(0, 2), ['A', 'B'])
assert.equal(filled.captions.tiktok, 'Hi there')
assert.ok(filled.captions.youtube)

// one item
assert.equal(parseItem('1. "A new hook"\nextra', 'hook'), 'A new hook')
assert.equal(parseItem('Line one\nLine two #tag #more', 'caption'), 'Line one\nLine two')

// full caption = caption + hashtags, inside the platform limit
assert.equal(fullCaption({ hooks: [], titles: [], captions: { tiktok: 'Hello' }, hashtags: ['a', 'b'] }, 'tiktok'), 'Hello\n\n#a #b')
assert.equal(fullCaption({ hooks: [], titles: [], captions: { tiktok: 'x'.repeat(3000) }, hashtags: [] }, 'tiktok').length, 2200)

// the Worker's request cleaner
assert.equal(cleanKitAsk({ script: { topic: ' ' } }), null)
const a = cleanKitAsk({ script: { topic: 'Sea', en: ['a'], vi: ['b'], mode: 'trip' }, settings: { hooks: 3 }, only: { lang: 'vi', kind: 'caption', platform: 'youtube', avoid: ['x'] } })!
assert.equal(a.script.mode, 'trip')
assert.equal(a.script.topic.vi, 'Sea')
assert.equal(a.settings.hooks, 3)
assert.deepEqual(a.only, { lang: 'vi', kind: 'caption', platform: 'youtube', avoid: ['x'] })
assert.equal(cleanKitAsk({ script: { topic: 'Sea' }, only: { lang: 'fr', kind: 'hook' } })!.only, undefined)

// presets: cleaned, one per name (newest wins), newest first, capped
{
  const { cleanPresets, MAX_PRESETS } = await import('../src/lib/studio/presets')
  const list = cleanPresets([
    { name: '  TikTok  VI ', at: 1, mode: 'trip', aspect: '1:1', kit: { hooks: 99 }, video: { subSize: 1 } },
    { name: 'tiktok vi', at: 5, mode: 'nope' },
    { name: '', at: 9 },
    'junk',
    { name: 'YT', at: 3, aspect: '4:3' },
  ])
  assert.deepEqual(list.map((p) => p.name), ['tiktok vi', 'YT'])
  assert.equal(list[0].mode, 'faceless')
  assert.equal(list[1].aspect, '9:16')
  assert.equal(cleanPresets([{ name: 'A', mode: 'trip', aspect: '1:1', kit: { hooks: 99 }, video: { subSize: 1 } }])[0].kit.hooks, 10)
  assert.equal(cleanPresets([{ name: 'A', video: { subSize: 1 } }])[0].video.subSize, 36)
  assert.equal(cleanPresets(Array.from({ length: 30 }, (_, i) => ({ name: `p${i}`, at: i }))).length, MAX_PRESETS)
  assert.deepEqual(cleanPresets(null), [])
}

console.log('novapostkit ok')
