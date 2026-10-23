import assert from 'node:assert/strict'
import { asksRuns, describeRuns, latestRuns, parseRun, requestRun, startRun, WORKFLOWS } from '../src/lib/hubRuns'
import { describeAction, parseCommand } from '../src/lib/jarvisActions'
import { chatReply } from '../src/lib/jarvisChat'
import { DEFAULT_AI_RULES } from '../src/lib/aiRules'

// the whitelist: unique ids and files, both languages, no deploy or secrets workflow
assert.equal(new Set(WORKFLOWS.map((w) => w.id)).size, WORKFLOWS.length)
assert.equal(new Set(WORKFLOWS.map((w) => w.file)).size, WORKFLOWS.length)
assert.ok(WORKFLOWS.every((w) => w.label.en && w.label.vi && !/deploy/.test(w.file)))

// spoken asks, English and Vietnamese, accents ignored
assert.equal(parseRun('dựng video Nova')?.id, 'nova-render')
assert.equal(parseRun('chạy Iris snapshot')?.id, 'iris-snapshot')
assert.equal(parseRun('làm mới ảnh chụp máy bay')?.id, 'iris-snapshot')
assert.equal(parseRun('build app Android')?.id, 'android')
assert.equal(parseRun('run the Kronos test')?.id, 'kronos')
assert.equal(parseRun('sao lưu dữ liệu')?.id, 'backup')
// no verb, or nothing it knows: not a run
assert.equal(parseRun('Nova thế nào?'), null)
assert.equal(parseRun('chạy đi'), null)
assert.ok(asksRuns('lần chạy gần nhất thế nào?') && asksRuns('how did the last run go') && !asksRuns('mở Nova'))

// only Neo's chat gets runs; the Brain tab keeps its old list
assert.deepEqual(parseCommand('chạy Iris snapshot', [], { runs: true }), { kind: 'run', id: 'iris-snapshot' })
assert.equal(parseCommand('chạy Iris snapshot', []), null)
// "start practice" stays the practice switch, not a workflow
assert.deepEqual(parseCommand('start practice', [], { runs: true }), { kind: 'rule', key: 'practiceMode', value: true })
assert.ok(describeAction({ kind: 'run', id: 'android' }).vi.includes('Android'))

// the Worker starts only whitelisted files, with the saved key
const calls: string[] = []
const fake = (status: number, body: unknown = {}) =>
  (async (url: string | URL | Request) => {
    calls.push(String(url))
    return new Response(status === 204 ? null : JSON.stringify(body), { status })
  }) as typeof fetch
assert.equal(await startRun('android', null, fake(204)), 'nokey')
assert.equal(await startRun('deploy', 'k', fake(204)), 'unknown')
assert.equal(await startRun('android', 'k', fake(204)), 'ok')
assert.ok(calls.at(-1)!.endsWith('/actions/workflows/android.yml/dispatches'))
assert.equal(await startRun('android', 'k', fake(403)), 'refused')

// newest run per workflow, and the answer read out
const runs = await latestRuns(
  null,
  fake(200, {
    workflow_runs: [
      { path: '.github/workflows/android.yml', status: 'completed', conclusion: 'success', updated_at: '2026-10-23T10:00:00Z', html_url: 'u1' },
      { path: '.github/workflows/android.yml', status: 'completed', conclusion: 'failure', updated_at: '2026-10-22T10:00:00Z', html_url: 'u0' },
      { path: '.github/workflows/argus-snapshot.yml', status: 'in_progress', conclusion: null, updated_at: '2026-10-23T11:55:00Z', html_url: 'u2' },
      { path: '.github/workflows/deploy.yml', status: 'completed', conclusion: 'success', updated_at: '2026-10-23T11:00:00Z', html_url: 'u3' },
    ],
  }),
)
assert.deepEqual(runs.map((r) => r.id).sort(), ['android', 'iris-snapshot'])
const said = describeRuns(runs, Date.parse('2026-10-23T12:00:00Z'))
assert.ok(said.some((l) => l.en.includes('finished OK') && l.en.includes('2 h ago')))
assert.ok(said.some((l) => l.vi.includes('đang chạy') && l.vi.includes('5 phút trước')))

// the browser side turns each server answer into plain words
assert.ok((await requestRun('android', fake(200, { result: 'ok' }))).en.startsWith('Started'))
assert.ok((await requestRun('android', fake(409, { result: 'nokey' }))).vi.includes('Nova'))
assert.ok((await requestRun('android', fake(502, { result: 'refused' }))).en.includes('refused'))

// the chat proposes a run (it waits for "Do it") and answers "how did the runs go"
const ctx = { state: { v: 1, realized: 0, peak: 10000, open: [], trades: [], events: [], curve: [] }, rules: DEFAULT_AI_RULES, journal: [], killSwitch: false, priceOf: () => 0, skills: [], learn: null } as never
const deps = { ctx, name: 'Chanh', known: [], watchlist: [], canAct: true, canStock: false, canReplay: false, canShow: false, canRun: true }
const r = chatReply('dựng video Nova', deps)
assert.deepEqual(r.action, { kind: 'run', id: 'nova-render' })
assert.ok(r.text[0].vi.includes('Chạy luôn không?'))
assert.equal(chatReply('lần chạy gần nhất thế nào', deps).runs, true)
assert.equal(chatReply('dựng video Nova', { ...deps, canRun: false }).action, undefined)
assert.equal(DEFAULT_AI_RULES.hubRuns, true)

console.log('hub runs tests passed')
