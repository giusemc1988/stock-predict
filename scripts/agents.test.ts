import assert from 'node:assert/strict'
import { agentName, answerHub, hubFactsForAi, namedProject, parseHubAsk, type HubFacts } from '../src/lib/agents'
import { chatReply } from '../src/lib/jarvisChat'
import { DEFAULT_AI_RULES } from '../src/lib/aiRules'

const facts: HubFacts = {
  on: { net: true, ruview: false, godseye: true, studio: true },
  equity: 10250,
  changePct: 2.5,
  openTrades: 2,
  buyCalls: 3,
  scanning: true,
  killSwitch: false,
  version: '1.44.0',
  updates: 80,
  posts: { scheduled: 1, published: 4, draft: 2 },
  channels: { linked: 2, total: 4 },
}

// each page has its own agent; Neo answers on the Hub
assert.equal(agentName('home'), 'Neo')
assert.equal(agentName('trade'), 'Atlas')
assert.equal(agentName('godseye'), 'Iris')
assert.equal(agentName('studio'), 'Nova')
assert.equal(agentName('net'), 'Nexus')

// projects are found by name, old name or plain words, in either language, accents ignored
assert.equal(namedProject('Iris thế nào?')?.id, 'argus')
assert.equal(namedProject("how is god's eye")?.id, 'argus')
assert.equal(namedProject('mở phòng ESP32')?.id, 'volt')
assert.equal(namedProject('Argus')?.id, 'argus')
assert.equal(namedProject('forge')?.id, 'forge')
assert.equal(namedProject('Nova với Iris'), null)

// open, status, list and who, from any page
assert.deepEqual(parseHubAsk('mở Nova', 'trade'), { kind: 'open', project: namedProject('nova') })
assert.equal(parseHubAsk('open the hub', 'studio')?.kind, 'open')
assert.equal(parseHubAsk('Nova đang thế nào?', 'home')?.kind, 'status')
assert.equal(parseHubAsk('các dự án đang ra sao', 'home')?.kind, 'list')
assert.equal(parseHubAsk('em là ai', 'godseye')?.kind, 'who')
// on a project page, "how is it going" means that project; on Atlas it stays a trading question
assert.equal((parseHubAsk('đang thế nào', 'studio') as { project: { id: string } }).project.id, 'nova')
assert.equal(parseHubAsk('đang thế nào', 'trade'), null)
assert.equal(parseHubAsk('why TSLA?', 'trade'), null)

// answers come from the app's data and open only pages that are on
const open = answerHub({ kind: 'open', project: namedProject('iris')! }, 'home', facts)
assert.equal(open.open, 'godseye')
const off = answerHub({ kind: 'open', project: namedProject('echo')! }, 'home', facts)
assert.equal(off.open, undefined)
assert.ok(off.text[0].vi.includes('đang tắt'))
assert.equal(answerHub({ kind: 'open', project: namedProject('max')! }, 'home', facts).open, undefined)
const atlas = answerHub({ kind: 'status', project: namedProject('atlas')! }, 'home', facts).text[0]
assert.ok(atlas.en.includes('$10,250') && atlas.en.includes('+2.5%') && atlas.en.includes('2 open practice trades') && atlas.en.includes('Paper money only'))
assert.ok(atlas.vi.includes('tiền ảo'))
const vt = answerHub({ kind: 'status', project: namedProject('viraltech')! }, 'home', facts).text[0]
assert.ok(vt.en.includes('2 of 4 channels'))
const list = answerHub({ kind: 'list' }, 'home', facts).text
assert.equal(list.length, 10)
assert.ok(list[0].en.startsWith('6 of 9 projects are on'))

// the free-AI helper hears who is speaking first, and stays within its 12 facts
const ai = hubFactsForAi('godseye', facts)
assert.ok(ai[0].includes('Iris') && ai.length === 3 && ai.every((l) => l.length <= 400))

// the chat routes hub questions before trading ones, and only when the agents are switched on
const ctx = { state: { v: 1, realized: 0, peak: 10000, open: [], trades: [], events: [], curve: [] }, rules: DEFAULT_AI_RULES, journal: [], killSwitch: false, priceOf: () => 0, skills: [], learn: null } as never
const deps = { ctx, name: 'Chanh', known: [], watchlist: [], canAct: false, canStock: false, canReplay: false, canShow: false }
assert.equal(chatReply('mở Nova', { ...deps, hub: { page: 'home', facts } }).open, 'studio')
assert.equal(chatReply('mở Nova', deps).open, undefined)
const away = chatReply('blah blah', { ...deps, hub: { page: 'studio', facts } })
assert.ok(away.unsure && away.text[1].en.includes('Nova'))
assert.equal(DEFAULT_AI_RULES.hubAgents, true)

console.log('agents tests passed')
