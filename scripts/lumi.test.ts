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

// ---- travel tools ----
import { addWord, buildSayPrompt, parseSayResponse, parseVocab, removeWord } from '../src/lib/lumiTranslate'
import { convert, findMoney, formatVnd, parseAmount, parseRates, parseStoredRates, ratesFresh } from '../src/lib/lumiMoney'
import { CULTURE, LANG_EN, LUMI_LANGS, PHRASES, phrasesFor } from '../src/lib/lumiPhrases'

// money: amounts in common written forms
assert.equal(parseAmount('1,500'), 1500)
assert.equal(parseAmount('12.50'), 12.5)
assert.equal(parseAmount('1.500,50'), 1500.5)
assert.equal(parseAmount('3,5'), 3.5)
assert.equal(parseAmount('abc'), null)
{
  const m = findMoney('It costs ten euros, or $5.50, and the hotel is 12,000 yen')
  assert.deepEqual(m.map((x) => [x.amount, x.cur]).sort(), [[10, 'EUR'], [12000, 'JPY'], [5.5, 'USD']].sort())
  assert.deepEqual(findMoney('twenty five dollars please').map((x) => [x.amount, x.cur]), [[25, 'USD']])
  assert.deepEqual(findMoney('300 baht'), [{ amount: 300, cur: 'THB' }])
  assert.deepEqual(findMoney('see you at five'), [])
}
{
  const r = parseRates({ result: 'success', time_last_update_unix: 1000, rates: { USD: 1, EUR: 0.9, VND: 26000, JPY: 150 } })!
  assert.ok(r)
  assert.equal(r.at, 1_000_000)
  assert.equal(Math.round(convert(9, 'EUR', 'VND', r)!), 260000)
  assert.equal(convert(1, 'XXX', 'VND', r), null)
  assert.equal(parseRates({ result: 'error' }), null)
  assert.ok(formatVnd(260123).includes('260.000'))
  assert.equal(ratesFresh(r, 1_000_000 + 3600_000), true)
  assert.equal(ratesFresh(r, 1_000_000 + 13 * 3600_000), false)
  assert.deepEqual(parseStoredRates(JSON.stringify(r)), r)
  assert.equal(parseStoredRates('{bad'), null)
}

// two-way: prompt direction + parsing
assert.ok(/Translate this Vietnamese sentence into natural, polite Japanese/.test(buildSayPrompt('xin chào', 'vi2x', 'Japanese')))
assert.ok(/Translate this Japanese sentence into natural, polite Vietnamese/.test(buildSayPrompt('こんにちは', 'x2vi', 'Japanese')))
assert.deepEqual(parseSayResponse('```json\n{"text":"こんにちは","roman":"konnichiwa"}\n```'), { text: 'こんにちは', roman: 'konnichiwa' })
assert.deepEqual(parseSayResponse('{"text":"Hello"}'), { text: 'Hello' })
assert.equal(parseSayResponse('{"text":""}'), null)
assert.equal(parseSayResponse('no json'), null)

// vocab: add, dedupe, remove, parse
{
  let v = addWord([], { lang: 'ja', text: 'お会計', vi: 'tính tiền' }, 1)
  v = addWord(v, { lang: 'ja', text: 'お会計', vi: 'tính tiền' }, 2)
  assert.equal(v.length, 1)
  v = addWord(v, { lang: 'en', text: '  ', vi: 'x' }, 3)
  assert.equal(v.length, 1)
  assert.deepEqual(parseVocab(JSON.stringify(v)), v)
  assert.equal(removeWord(v, v[0].id).length, 0)
  assert.deepEqual(parseVocab('nope'), [])
}

// phrasebook + culture: every phrase/tip exists in every language, no empty strings
for (const p of PHRASES) for (const l of LUMI_LANGS) assert.ok(p.t[l.code]?.trim(), `${p.id} missing ${l.code}`)
for (const l of LUMI_LANGS) {
  assert.ok(CULTURE[l.code].tips.length >= 3)
  assert.ok(LANG_EN[l.code])
}
assert.equal(phrasesFor('eat', 'ja').every((p) => p.text && p.vi), true)
assert.ok(new Set(PHRASES.map((p) => p.id)).size === PHRASES.length)
console.log('lumi travel tools: ok')

// ---- batch 2: scam alert, menu photo, trip notebook ----
import { MENU_PROMPT, parseImageDataUrl, parseMenuResponse, tripsToText } from '../src/lib/lumiTranslate'
import { SCAMS } from '../src/lib/lumiPhrases'
{
  const lines: LumiLine[] = [{ text: 'palace closed today, my friend takes you by tuk-tuk for 20 baht', lang: 'en', at: 1 }]
  assert.ok(/alertVi/.test(buildGroupPrompt(lines, 'talk')))
  const g = parseGroupResponse('{"conversations":[{"lang":"en","lineNumbers":[1],"summaryVi":"Mời đi tuk-tuk","alertVi":"Có thể là chiêu lừa"}]}', lines)
  assert.equal(g[0].alertVi, 'Có thể là chiêu lừa')
  const g2 = parseGroupResponse('{"conversations":[{"lang":"en","lineNumbers":[1],"summaryVi":"x"}]}', lines)
  assert.equal('alertVi' in g2[0], false)
  const saved = cleanTripSave({ mode: 'talk', conversations: [{ lang: 'en', summaryVi: 'a', alertVi: 'b' }, { lang: 'en', summaryVi: 'c' }] })!
  assert.equal(saved.conversations[0].alertVi, 'b')
  assert.equal('alertVi' in saved.conversations[1], false)
}
{
  assert.ok(/Never invent/.test(MENU_PROMPT))
  const items = parseMenuResponse('```json\n{"items":[{"orig":"Pad Thai","vi":"Phở xào Thái","note":"có đậu phộng","price":"฿80"},{"orig":"","vi":"x"}]}\n```')
  assert.deepEqual(items, [{ orig: 'Pad Thai', vi: 'Phở xào Thái', note: 'có đậu phộng', price: '฿80' }])
  assert.deepEqual(parseMenuResponse('{"items":[]}'), [])
  assert.deepEqual(parseMenuResponse('garbage'), [])
  assert.deepEqual(findMoney('฿80'), [{ amount: 80, cur: 'THB' }])
  assert.deepEqual(parseImageDataUrl('data:image/jpeg;base64,QUJD'), { mime: 'image/jpeg', b64: 'QUJD' })
  assert.equal(parseImageDataUrl('data:text/html;base64,QUJD'), null)
  assert.equal(parseImageDataUrl('data:image/png;base64,' + 'A'.repeat(100), 10), null)
  assert.equal(parseImageDataUrl(42), null)
}
{
  const at = Date.UTC(2026, 10, 1, 10, 0)
  const txt = tripsToText([{ id: '1', at, mode: 'talk', conversations: [{ lang: 'ja', summaryVi: 'Hỏi đường', alertVi: 'cẩn thận' }] }], 'en-US')
  assert.ok(txt.startsWith('Sổ tay chuyến đi'))
  assert.ok(txt.includes('[ja] Hỏi đường (⚠ cẩn thận)'))
  for (const l of LUMI_LANGS) assert.ok(SCAMS[l.code].length >= 2)
}
console.log('lumi batch 2: ok')

// ---- live captions ----
import { audioFileName, buildLiveViPrompt, cleanHeard, cleanLiveVi, langCode } from '../src/lib/lumiTranslate'
assert.equal(langCode('english'), 'en')
assert.equal(langCode('Japanese'), 'ja')
assert.equal(langCode('en'), 'en')
assert.equal(langCode(undefined), 'und')
assert.deepEqual(cleanHeard({ text: ' Bro, can I ask you something? ', language: 'english', segments: [{ no_speech_prob: 0.02 }] }), { text: 'Bro, can I ask you something?', lang: 'en' })
assert.equal(cleanHeard({ text: 'Thank you.', language: 'english', segments: [{ no_speech_prob: 0.1 }] }).text, '', 'silence hallucination dropped')
assert.equal(cleanHeard({ text: 'hello there', language: 'english', segments: [{ no_speech_prob: 0.9 }, { no_speech_prob: 0.8 }] }).text, '', 'mostly no-speech dropped')
assert.equal(cleanHeard({ text: 'hello there', language: 'english' }).text, 'hello there', 'no segments: keep')
assert.ok(/language: en/.test(buildLiveViPrompt('hi', 'en')))
assert.ok(/ONLY the Vietnamese translation/.test(buildLiveViPrompt('hi', 'und')))
assert.equal(cleanLiveVi('"Anh bạn, cho tôi hỏi một chuyện?"'), 'Anh bạn, cho tôi hỏi một chuyện?')
assert.equal(cleanLiveVi('Vietnamese: Xin chào'), 'Xin chào')
assert.equal(cleanLiveVi(null), '')
assert.equal(audioFileName('audio/webm;codecs=opus'), 'chunk.webm')
assert.equal(audioFileName('audio/mp4'), 'chunk.mp4')
console.log('lumi live captions: ok')
