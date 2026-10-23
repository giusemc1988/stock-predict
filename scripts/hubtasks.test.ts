import assert from 'node:assert/strict'
import { asksCodeChange, asksTasks, describeTasks, fileTask, listTasks, requestTask, taskIssue } from '../src/lib/hubTasks'
import { parseCommand } from '../src/lib/jarvisActions'
import { chatReply } from '../src/lib/jarvisChat'
import { DEFAULT_AI_RULES } from '../src/lib/aiRules'

// code-change asks, Vietnamese and English; questions and runs are not
assert.ok(asksCodeChange('sửa lỗi nút Gửi trong Nova không bấm được'))
assert.ok(asksCodeChange('tạo app ghi chú chi tiêu hằng ngày'))
assert.ok(asksCodeChange('fix the Iris page, the globe is blank'))
assert.ok(asksCodeChange('thêm tính năng xuất PDF cho Atlas'))
assert.ok(!asksCodeChange('Nova thế nào?'))
assert.ok(!asksCodeChange('build app Android'))
assert.ok(!asksCodeChange('fix'))
assert.ok(asksTasks('việc code thế nào?') && asksTasks('how are the code tasks') && !asksTasks('mở Nova'))

// a task wins over a run when both could match; the Brain tab never files tasks
assert.deepEqual(parseCommand('sửa lỗi build Android', [], { runs: true, tasks: true }), { kind: 'task', text: 'sửa lỗi build Android' })
assert.equal(parseCommand('sửa lỗi nút Gửi', []), null)

// the issue keeps Chanh's words and where he asked from, title capped
const long = 'sửa lỗi ' + 'x'.repeat(200)
const issue = taskIssue(long, 'Nova (studio page)')
assert.ok(issue.title.length <= 80 && issue.title.endsWith('…'))
assert.ok(issue.body.includes('Nova (studio page)') && issue.body.includes('x'.repeat(150)))

// the Worker dispatches agent-task.yml with the saved key and the issue as inputs
let sent: { url: string; body: string } | null = null
const fake = (status: number, body: unknown = {}) =>
  (async (url: string | URL | Request, init?: RequestInit) => {
    sent = { url: String(url), body: String(init?.body ?? '') }
    return new Response(status === 204 ? null : JSON.stringify(body), { status })
  }) as typeof fetch
assert.equal(await fileTask('sửa lỗi nút Gửi', 'Nova', null, fake(204)), 'nokey')
assert.equal(await fileTask('  ', 'Nova', 'k', fake(204)), 'empty')
assert.equal(await fileTask(42, 'Nova', 'k', fake(204)), 'empty')
assert.equal(await fileTask('sửa lỗi nút Gửi', 'Nova', 'k', fake(204)), 'ok')
assert.ok(sent!.url.endsWith('/actions/workflows/agent-task.yml/dispatches'))
const payload = JSON.parse(sent!.body) as { ref: string; inputs: { title: string; body: string } }
assert.equal(payload.ref, 'main')
assert.equal(payload.inputs.title, 'sửa lỗi nút Gửi')
assert.equal(await fileTask('sửa lỗi nút Gửi', 'Nova', 'k', fake(403)), 'refused')

// the list: pull requests left out, state from labels and close reason
const tasks = await listTasks(
  null,
  fake(200, [
    { number: 9, title: 'tạo app chi tiêu', state: 'open', html_url: 'u9', labels: [{ name: 'agent-task' }] },
    { number: 8, title: 'sửa nút Gửi', state: 'open', html_url: 'u8', labels: [{ name: 'agent-task' }, { name: 'agent-pr' }] },
    { number: 7, title: 'PR row', state: 'open', html_url: 'u7', pull_request: {} },
    { number: 6, title: 'fix Iris', state: 'closed', state_reason: 'completed', html_url: 'u6' },
    { number: 5, title: 'old', state: 'closed', state_reason: 'not_planned', html_url: 'u5' },
  ]),
)
assert.deepEqual(tasks.map((t) => [t.number, t.state]), [[9, 'waiting'], [8, 'pr'], [6, 'done'], [5, 'closed']])
assert.ok(describeTasks(tasks)[1].vi.includes('đã có PR chờ anh duyệt'))
assert.ok(describeTasks([])[0].vi.includes('Chưa có việc code'))

// the browser side reads each server answer out in plain words
assert.ok((await requestTask('sửa lỗi nút Gửi', 'Nova', fake(200, { result: 'ok' }))).vi.includes('mở PR'))
assert.ok((await requestTask('sửa lỗi nút Gửi', 'Nova', fake(409, { result: 'nokey' }))).en.includes('GitHub key'))

// the chat proposes a task (waits for "Do it") and answers "how are the code tasks"
const ctx = { state: { v: 1, realized: 0, peak: 10000, open: [], trades: [], events: [], curve: [] }, rules: DEFAULT_AI_RULES, journal: [], killSwitch: false, priceOf: () => 0, skills: [], learn: null } as never
const deps = { ctx, name: 'Chanh', known: [], watchlist: [], canAct: true, canStock: false, canReplay: false, canShow: false, canRun: true, canTask: true }
const r = chatReply('sửa lỗi nút Gửi trong Nova', deps)
assert.deepEqual(r.action, { kind: 'task', text: 'sửa lỗi nút Gửi trong Nova' })
assert.ok(r.text[0].vi.includes('Ghi luôn không?'))
assert.equal(chatReply('việc code thế nào', deps).tasks, true)
assert.equal(chatReply('sửa lỗi nút Gửi trong Nova', { ...deps, canTask: false }).action, undefined)
assert.equal(DEFAULT_AI_RULES.hubTasks, true)

console.log('hub tasks tests passed')
