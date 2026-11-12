import assert from 'node:assert/strict'
import { appendSpeech, buildPrompt, tidySpeech, CLAUDE_PROJECT_URL } from '../src/lib/voiceRequest'

assert.equal(tidySpeech(''), '')
assert.equal(tidySpeech('   '), '')
assert.equal(tidySpeech('ờ ừm làm làm cái nút này đi'), 'Làm cái nút này đi.')
assert.equal(tidySpeech('thêm một ô  voice  , uh please'), 'Thêm một ô voice, please.')
assert.equal(tidySpeech('Sao nó chậm vậy?'), 'Sao nó chậm vậy?')
assert.equal(tidySpeech('fix the the bug'), 'Fix the bug.')
// no mangling of real words that contain a filler
assert.equal(tidySpeech('hãy làm màu xanh'), 'Hãy làm màu xanh.')
assert.equal(buildPrompt('  '), '')
const p = buildPrompt('làm ô voice trong Max')
assert.match(p, /Làm ô voice trong Max\./)
assert.match(p, /Muse/)
assert.match(p, /miễn phí/)
assert.equal(appendSpeech('', ' a '), 'a')
assert.equal(appendSpeech('a', 'b'), 'a b')
assert.equal(appendSpeech('a', '  '), 'a')
assert.match(CLAUDE_PROJECT_URL, /^https:\/\/claude\.ai\//)
console.log('voicereq ok')
import { captionLang, MAX_RECORD_MS, WHISPER_HINT } from '../src/lib/voiceRequest'
assert.equal(captionLang('auto'), 'vi-VN')
assert.equal(captionLang('en'), 'en-US')
assert.ok(MAX_RECORD_MS <= 180_000 && WHISPER_HINT.length < 400)
import { cleanHeard } from '../src/lib/lumiTranslate'
const long = 'a '.repeat(1000)
assert.equal(cleanHeard({ text: long, language: 'vietnamese' }).text.length, 600)
assert.ok(cleanHeard({ text: long, language: 'vietnamese' }, 3000).text.length > 600)
