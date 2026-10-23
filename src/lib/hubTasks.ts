/**
 * Neo's code tasks: "fix the X button" or "make an app that..." becomes a GitHub issue labeled
 * agent-task (through .github/workflows/agent-task.yml), after you tap "Do it". A scheduled Claude
 * session picks open ones up and opens a pull request; nothing merges without Chanh. The Max card
 * and the chat read the list back.
 */
import type { Bi } from './hubText'
import { fold } from './toolHub'
import { NOVA_REPO } from './studioJobs'

export const TASK_WORKFLOW = 'agent-task.yml'
export const TASK_LABEL = 'agent-task'
/** set by the Claude session once it has opened a pull request for the issue */
export const TASK_PR_LABEL = 'agent-pr'
const MAX_TEXT = 1500

const clean = (s: string) => ` ${fold(s).replace(/['’]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()} `
const ASK = / (sua loi|sua code|sua giup|fix|bug|loi o|tao app|tao mot app|lam app|lam mot app|make an app|build an app|create an app|them tinh nang|add a feature|them nut|add a button|doi giao dien|change the design|nang cap|upgrade the) /
const LIST = / (viec code|code task|code tasks|cac viec code|task code|pr nao|pull request|claude dang lam|viec sua code) /

/** True when the sentence asks for a code change (bug fix, new feature or new app). */
export const asksCodeChange = (text: string) => text.trim().length >= 8 && ASK.test(clean(text))
/** "How are the code tasks going?" */
export const asksTasks = (text: string) => LIST.test(clean(text))

/** Title and body for the issue: Chanh's words, and where he was when he asked. */
export function taskIssue(text: string, where: string): { title: string; body: string } {
  const t = text.trim().replace(/\s+/g, ' ').slice(0, MAX_TEXT)
  const title = t.length > 80 ? `${t.slice(0, 77).trimEnd()}…` : t
  return { title, body: `**Chanh asked Neo:** ${t}\n\n**Asked from:** ${where}` }
}

export interface TaskInfo {
  number: number
  title: string
  state: 'waiting' | 'pr' | 'done' | 'closed'
  url: string
}

/** One line per task, newest first, for the chat. */
export function describeTasks(tasks: TaskInfo[]): Bi[] {
  if (!tasks.length) return [{ en: 'No code tasks yet. Say "fix ..." or "make an app that ..." and I will file one.', vi: 'Chưa có việc code nào. Nói "sửa lỗi ..." hay "tạo app ..." là em ghi lại cho Claude.' }]
  const word: Record<TaskInfo['state'], Bi> = {
    waiting: { en: 'waiting for Claude', vi: 'đang chờ Claude' },
    pr: { en: 'pull request ready for you', vi: 'đã có PR chờ anh duyệt' },
    done: { en: 'done', vi: 'xong' },
    closed: { en: 'closed', vi: 'đã đóng' },
  }
  return tasks.slice(0, 5).map((t) => ({ en: `#${t.number} ${t.title}: ${word[t.state].en}.`, vi: `#${t.number} ${t.title}: ${word[t.state].vi}.` }))
}

// ---- browser side ----

/** File the task through the Worker; the answer to read out. */
export async function requestTask(text: string, where: string, f: typeof fetch = fetch): Promise<Bi> {
  const r = await f('/api/hub/task', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, where }) }).catch(() => null)
  const result = r ? ((await r.json().catch(() => null)) as { result?: string } | null)?.result : null
  if (result === 'ok') return { en: 'Filed for Claude. It picks tasks up about once an hour and opens a pull request for you to check; ask me "how are the code tasks?".', vi: 'Đã ghi việc cho Claude. Khoảng mỗi giờ Claude nhận việc một lần và mở PR để anh duyệt; hỏi em "việc code thế nào?".' }
  if (result === 'nokey') return { en: 'I need the GitHub key first: open Nova, step 5, "GitHub key", and save it there.', vi: 'Em cần key GitHub trước: mở Nova, bước 5, ô "Key GitHub", lưu key ở đó.' }
  if (result === 'refused') return { en: 'GitHub refused. The saved key may have expired or lack "Actions: write"; save a new one in Nova step 5.', vi: 'GitHub từ chối. Key đã lưu có thể hết hạn hoặc thiếu quyền "Actions: write"; lưu key mới ở Nova bước 5.' }
  return { en: "I couldn't reach the server. Try again in a moment.", vi: 'Em không gọi được máy chủ. Thử lại sau chút nhé.' }
}

export async function fetchTasks(f: typeof fetch = fetch): Promise<Bi[]> {
  const r = await f('/api/hub/tasks').catch(() => null)
  const j = r?.ok ? ((await r.json().catch(() => null)) as { tasks?: TaskInfo[] } | null) : null
  return j?.tasks ? describeTasks(j.tasks) : [{ en: "I couldn't read the tasks from GitHub right now.", vi: 'Em chưa đọc được danh sách việc từ GitHub.' }]
}

// ---- server side (Worker) ----

const GH = (token: string | null) => ({ ...(token ? { authorization: `Bearer ${token}` } : {}), accept: 'application/vnd.github+json', 'user-agent': 'neo-hub', 'x-github-api-version': '2022-11-28' })

/** Start agent-task.yml, which files the issue. */
export async function fileTask(text: unknown, where: unknown, token: string | null, f: typeof fetch = fetch): Promise<'ok' | 'nokey' | 'refused' | 'empty'> {
  if (typeof text !== 'string' || text.trim().length < 3) return 'empty'
  if (!token) return 'nokey'
  const issue = taskIssue(text, typeof where === 'string' ? where.slice(0, 80) : 'the hub')
  const r = await f(`https://api.github.com/repos/${NOVA_REPO}/actions/workflows/${TASK_WORKFLOW}/dispatches`, { method: 'POST', headers: { ...GH(token), 'content-type': 'application/json' }, body: JSON.stringify({ ref: 'main', inputs: issue }) }).catch(() => null)
  return r?.status === 204 ? 'ok' : 'refused'
}

/** The newest agent tasks and where each one stands. */
export async function listTasks(token: string | null, f: typeof fetch = fetch): Promise<TaskInfo[]> {
  const r = await f(`https://api.github.com/repos/${NOVA_REPO}/issues?labels=${TASK_LABEL}&state=all&per_page=10`, { headers: GH(token) }).catch(() => null)
  if (!r?.ok) return []
  const rows = (await r.json()) as { number: number; title: string; state: string; state_reason?: string | null; html_url: string; labels?: { name: string }[]; pull_request?: unknown }[]
  return rows
    .filter((x) => !x.pull_request)
    .map((x) => ({
      number: x.number,
      title: x.title,
      url: x.html_url,
      state: x.state === 'closed' ? (x.state_reason === 'completed' ? 'done' : 'closed') : x.labels?.some((l) => l.name === TASK_PR_LABEL) ? 'pr' : 'waiting',
    }))
}
