/**
 * Neo runs the hub's GitHub workflows: a short whitelist, started with the GitHub key saved in Nova
 * (Actions: write on this repo), only after you tap "Do it". No workflow here touches money, secrets
 * or the main branch; deploys stay with the normal merge-to-main path.
 */
import type { Bi } from './hubText'
import { fold } from './toolHub'
import { NOVA_REPO } from './studioJobs'

export interface HubWorkflow {
  id: string
  /** file in .github/workflows */
  file: string
  /** which project it belongs to (for the answer), by display name */
  project: string
  label: Bi
  /** words that ask for it, accents removed */
  words: string[]
}

export const WORKFLOWS: HubWorkflow[] = [
  { id: 'nova-render', file: 'nova-render.yml', project: 'Nova', label: { en: 'render the queued Nova videos', vi: 'dựng các video Nova đang chờ' }, words: ['render', 'dung video', 'nova'] },
  { id: 'iris-snapshot', file: 'argus-snapshot.yml', project: 'Iris', label: { en: 'refresh the Iris flight snapshot', vi: 'làm mới ảnh chụp máy bay của Iris' }, words: ['snapshot', 'may bay', 'flights'] },
  { id: 'iris-build', file: 'argus.yml', project: 'Iris', label: { en: 'rebuild the Iris globe (fresh satellite orbits)', vi: 'dựng lại địa cầu Iris (quỹ đạo vệ tinh mới)' }, words: ['ve tinh', 'satellite', 'build iris', 'dung lai iris', 'rebuild iris'] },
  { id: 'android', file: 'android.yml', project: 'Nexus', label: { en: 'build the Android app', vi: 'build app Android' }, words: ['android', 'apk'] },
  { id: 'practice', file: 'practice.yml', project: 'Atlas', label: { en: 'run one Atlas practice cycle', vi: 'chạy một vòng luyện tập Atlas' }, words: ['luyen tap', 'practice'] },
  { id: 'learn', file: 'auto-learn.yml', project: 'Atlas', label: { en: 'run the Atlas learning cycle', vi: 'chạy vòng tự học của Atlas' }, words: ['tu hoc', 'learn'] },
  { id: 'kronos', file: 'kronos-shadow.yml', project: 'Atlas', label: { en: 'run the Kronos shadow test', vi: 'chạy thử Kronos' }, words: ['kronos'] },
  { id: 'ruview-check', file: 'ruview-update.yml', project: 'Echo', label: { en: 'check for a RuView update', vi: 'kiểm tra bản cập nhật RuView' }, words: ['ruview', 'cap nhat echo', 'update echo'] },
  { id: 'backup', file: 'backup-kv.yml', project: 'Atlas', label: { en: 'back up the saved data', vi: 'sao lưu dữ liệu đã lưu' }, words: ['sao luu', 'backup', 'back up'] },
]

const clean = (s: string) => ` ${fold(s).replace(/['’]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()} `
const RUN = / (chay|run|start|bat dau|kich hoat|trigger|lam moi|refresh|build|dung|kiem tra|check|sao luu|back up|backup) /
const LAST = / (lan chay|lan cuoi|gan nhat|last run|latest run|runs|workflow|ket qua chay) /

/** The workflow a sentence asks Neo to start; null when none, or not clearly one. */
export function parseRun(text: string): HubWorkflow | null {
  const t = clean(text)
  if (!RUN.test(t)) return null
  const hits = WORKFLOWS.filter((w) => w.words.some((x) => t.includes(` ${x} `)))
  // the more specific ask wins: "build Android" over "build", "rebuild Iris" over "Iris"
  if (hits.length > 1) {
    const best = hits.map((w) => ({ w, n: Math.max(...w.words.filter((x) => t.includes(` ${x} `)).map((x) => x.length)) })).sort((a, b) => b.n - a.n)
    return best[0].n > best[1].n ? best[0].w : null
  }
  return hits[0] ?? null
}

/** "How did the last runs go?" */
export const asksRuns = (text: string) => LAST.test(clean(text))

export const workflowById = (id: string) => WORKFLOWS.find((w) => w.id === id) ?? null

export interface RunInfo {
  id: string
  status: string
  conclusion: string | null
  updated: string
  url: string
}

/** One line per workflow's newest run, for the chat. */
export function describeRuns(runs: RunInfo[], now = Date.now()): Bi[] {
  if (!runs.length) return [{ en: 'No runs found yet.', vi: 'Chưa thấy lần chạy nào.' }]
  return runs.map((r) => {
    const w = workflowById(r.id)
    const mins = Math.max(0, Math.round((now - Date.parse(r.updated)) / 60000))
    const when: Bi = mins < 60 ? { en: `${mins} min ago`, vi: `${mins} phút trước` } : mins < 2880 ? { en: `${Math.round(mins / 60)} h ago`, vi: `${Math.round(mins / 60)} giờ trước` } : { en: `${Math.round(mins / 1440)} days ago`, vi: `${Math.round(mins / 1440)} ngày trước` }
    const state: Bi =
      r.status !== 'completed'
        ? { en: 'running now', vi: 'đang chạy' }
        : r.conclusion === 'success'
          ? { en: 'finished OK', vi: 'xong, ổn' }
          : r.conclusion === 'cancelled' || r.conclusion === 'skipped'
            ? { en: 'was cancelled', vi: 'đã bị hủy' }
            : { en: 'FAILED', vi: 'LỖI' }
    return { en: `${w?.project ?? ''}: ${w?.label.en ?? r.id}: ${state.en}, ${when.en}.`, vi: `${w?.project ?? ''}: ${w?.label.vi ?? r.id}: ${state.vi}, ${when.vi}.` }
  })
}

// ---- browser side ----

/** Ask the Worker to start a workflow; the answer to read out. */
export async function requestRun(id: string, f: typeof fetch = fetch): Promise<Bi> {
  const w = workflowById(id)
  const r = await f('/api/hub/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => null)
  const result = r ? ((await r.json().catch(() => null)) as { result?: string } | null)?.result : null
  if (result === 'ok') return { en: `Started: ${w?.label.en ?? id}. It usually takes a few minutes; ask me "how did the last runs go?".`, vi: `Đã chạy: ${w?.label.vi ?? id}. Thường mất vài phút; hỏi em "lần chạy gần nhất thế nào?".` }
  if (result === 'nokey') return { en: 'I need the GitHub key first: open Nova, step 5, "GitHub key", and save it there. The same key lets me start these.', vi: 'Em cần key GitHub trước: mở Nova, bước 5, ô "Key GitHub", lưu key ở đó. Cùng key đó cho em chạy các việc này.' }
  if (result === 'refused') return { en: 'GitHub refused. The saved key may have expired or lack "Actions: write"; save a new one in Nova step 5.', vi: 'GitHub từ chối. Key đã lưu có thể hết hạn hoặc thiếu quyền "Actions: write"; lưu key mới ở Nova bước 5.' }
  return { en: "I couldn't reach the server. Try again in a moment.", vi: 'Em không gọi được máy chủ. Thử lại sau chút nhé.' }
}

/** The newest run of each workflow, read out. */
export async function fetchRuns(f: typeof fetch = fetch): Promise<Bi[]> {
  const r = await f('/api/hub/runs').catch(() => null)
  const j = r?.ok ? ((await r.json().catch(() => null)) as { runs?: RunInfo[] } | null) : null
  return j?.runs ? describeRuns(j.runs) : [{ en: "I couldn't read the runs from GitHub right now.", vi: 'Em chưa đọc được các lần chạy từ GitHub.' }]
}

// ---- server side (Worker) ----

const GH = (token: string) => ({ authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'neo-hub', 'x-github-api-version': '2022-11-28' })

/** Start a whitelisted workflow on main. 'nokey' when no GitHub key is saved, 'refused' when GitHub said no. */
export async function startRun(id: string, token: string | null, f: typeof fetch = fetch): Promise<'ok' | 'nokey' | 'refused' | 'unknown'> {
  const w = workflowById(id)
  if (!w) return 'unknown'
  if (!token) return 'nokey'
  const r = await f(`https://api.github.com/repos/${NOVA_REPO}/actions/workflows/${w.file}/dispatches`, { method: 'POST', headers: { ...GH(token), 'content-type': 'application/json' }, body: JSON.stringify({ ref: 'main' }) }).catch(() => null)
  return r?.status === 204 ? 'ok' : 'refused'
}

/** The newest run of each whitelisted workflow (public repo: works with or without the key). */
export async function latestRuns(token: string | null, f: typeof fetch = fetch): Promise<RunInfo[]> {
  const r = await f(`https://api.github.com/repos/${NOVA_REPO}/actions/runs?per_page=60&branch=main`, { headers: token ? GH(token) : { accept: 'application/vnd.github+json', 'user-agent': 'neo-hub' } }).catch(() => null)
  if (!r?.ok) return []
  const j = (await r.json()) as { workflow_runs?: { path?: string; status: string; conclusion: string | null; updated_at: string; html_url: string }[] }
  const out: RunInfo[] = []
  for (const w of WORKFLOWS) {
    const run = j.workflow_runs?.find((x) => x.path?.endsWith(`/${w.file}`))
    if (run) out.push({ id: w.id, status: run.status, conclusion: run.conclusion, updated: run.updated_at, url: run.html_url })
  }
  return out
}
