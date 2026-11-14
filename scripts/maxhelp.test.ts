import assert from 'node:assert/strict'
import { HELP } from '../src/lib/maxHelp'

const keys = Object.keys(HELP) as (keyof typeof HELP)[]
assert.ok(keys.length >= 25, 'every button has an entry')
for (const k of keys) {
  for (const lang of ['en', 'vi'] as const) {
    assert.ok(HELP[k].line[lang].trim().length >= 8, `${k} line ${lang}`)
    assert.ok(HELP[k].line[lang].length <= 70, `${k} line ${lang} is short (${HELP[k].line[lang].length})`)
    assert.ok(HELP[k].more[lang].trim().length >= 30, `${k} more ${lang}`)
  }
}
// the question Chanh asked: what does Drop do
assert.match(HELP.drop.more.vi, /không xoá gì/)
assert.match(HELP.drop.more.en, /Nothing is deleted/)
console.log('maxhelp: ok')
