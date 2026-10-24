/**
 * Lemo-Opuscar renderer for Nova, on your own PC.
 *
 *   npm run lemo            (needs Claude Code with the lemo-opuscar plugin, Node 20+)
 *
 * Every minute it asks the Worker for a Lemo job with the home agent's token (~/.jarvis-agent/token,
 * the same value as the Worker secret HOME_AGENT_TOKEN). That ask is also how Nova knows the PC is on:
 * while this window runs, Nova offers Lemo-Opuscar; when it stops, Nova makes videos on the server farm.
 * For a job it runs `claude -p` in ~/lemo-films/<day>-<id>/ in auto permission mode (Claude's safety
 * check stays on), then sends the MP4 back to Nova in 20 MiB parts. It never posts anywhere.
 */
import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { join } from 'node:path'
import { lemoPrompt, rememberStyle, type LemoJob } from '../src/lib/lemoRender'

const SITE = (process.env.NOVA_SITE ?? 'https://stock-predict.chanhmn1011.workers.dev').replace(/\/$/, '')
const HOME = process.env.AGENT_HOME ?? join(os.homedir(), '.jarvis-agent')
const FILMS = process.env.LEMO_FILMS ?? join(os.homedir(), 'lemo-films')
const EVERY_MS = 60_000
/** a film that is not done in two hours is stopped */
const FILM_TIMEOUT_MS = 2 * 3600_000
const CHUNK = 20 * 1024 * 1024
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function token(): string {
  if (process.env.AGENT_TOKEN) return process.env.AGENT_TOKEN
  const file = join(HOME, 'token')
  if (!existsSync(file)) {
    console.error(`Chưa có token máy nhà (${file}). Chạy "npm run agent" một lần để tạo, rồi lưu đúng token đó vào HOME_AGENT_TOKEN của Worker.`)
    process.exit(1)
  }
  return readFileSync(file, 'utf8').trim()
}
const TOKEN = token()
const auth = { authorization: `Bearer ${TOKEN}` }

async function api(path: string, init: RequestInit = {}) {
  const r = await fetch(SITE + path, { ...init, headers: { ...auth, ...init.headers }, signal: AbortSignal.timeout(120_000) })
  if (r.status === 403) throw new Error('Worker từ chối token: HOME_AGENT_TOKEN trên Worker phải giống file token trên máy này')
  if (!r.ok) throw new Error(`${path.split('?')[0]}: HTTP ${r.status}`)
  return r.json() as Promise<Record<string, unknown>>
}

/** Newest MP4 in the folder or below it, if Claude did not copy one to out.mp4. */
function findMp4(dir: string): string | null {
  let best: { p: string; t: number } | null = null
  const walk = (d: string, depth: number) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name)
      const s = statSync(p)
      if (s.isDirectory() && depth < 4 && name !== 'node_modules') walk(p, depth + 1)
      else if (name.toLowerCase().endsWith('.mp4') && (!best || s.mtimeMs > best.t)) best = { p, t: s.mtimeMs }
    }
  }
  walk(dir, 0)
  return best ? (best as { p: string }).p : null
}

function runClaude(dir: string, prompt: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      'claude',
      ['-p', prompt, '--permission-mode', 'auto', '--disallowedTools', 'WebFetch', 'WebSearch', '--output-format', 'text'],
      { cwd: dir, timeout: FILM_TIMEOUT_MS, windowsHide: true, maxBuffer: 16 << 20 },
      (e) => resolve(e ? (e.killed ? 'quá 2 giờ, đã dừng' : e.message.slice(0, 300)) : null),
    )
  })
}

async function make(job: LemoJob) {
  const dir = join(FILMS, `${new Date().toISOString().slice(0, 10)}-${job.id.slice(0, 8)}`)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'job.json'), JSON.stringify(job, null, 2))
  const memo = join(FILMS, 'styles-used.txt')
  const recent = existsSync(memo) ? readFileSync(memo, 'utf8').split('\n').filter(Boolean) : []
  console.log(`[${new Date().toLocaleTimeString()}] Bắt đầu phim ${job.id.slice(0, 8)} (${job.lang}, ${job.aspect}) trong ${dir}`)

  // keep saying "still here" so Nova doesn't think the PC went off during a long film
  const beat = setInterval(() => void api('/api/studio/lemo/pick?busy', { method: 'POST' }).catch(() => {}), EVERY_MS)
  let failed: string | null
  try {
    failed = await runClaude(dir, lemoPrompt(job, recent))
  } finally {
    clearInterval(beat)
  }
  // after a failure, a stray MP4 may be a half-made draft: only out.mp4 counts then
  const mp4 = existsSync(join(dir, 'out.mp4')) ? join(dir, 'out.mp4') : failed ? null : findMp4(dir)
  if (!mp4) {
    await api(`/api/studio/lemo/done?id=${job.id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: false, error: failed ?? 'Claude did not make an MP4' }) })
    return console.log(`Phim ${job.id.slice(0, 8)} lỗi: ${failed ?? 'không có file MP4'}`)
  }
  const result = (() => {
    try {
      return JSON.parse(readFileSync(join(dir, 'result.json'), 'utf8')) as { style?: string; duration?: number }
    } catch {
      return {}
    }
  })()
  const data = readFileSync(mp4)
  const parts = Math.ceil(data.length / CHUNK)
  for (let i = 0; i < parts; i++) {
    await api(`/api/studio/lemo/part?id=${job.id}&i=${i}`, { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: data.subarray(i * CHUNK, (i + 1) * CHUNK) })
  }
  await api(`/api/studio/lemo/done?id=${job.id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: true, size: data.length, parts, duration: result.duration, style: result.style }) })
  if (result.style) writeFileSync(memo, rememberStyle(recent, result.style).join('\n'))
  console.log(`Xong phim ${job.id.slice(0, 8)}: ${(data.length / 1e6).toFixed(1)} MB, style ${result.style ?? '?'}. Đã gửi về Nova.`)
}

async function tick() {
  const r = await api('/api/studio/lemo/pick', { method: 'POST' })
  const job = r.job as LemoJob | null
  if (!job || !UUID.test(job.id)) return
  await make(job)
}

mkdirSync(FILMS, { recursive: true })
console.log(`Lemo-Opuscar cho Nova đang chạy. Nova thấy máy nhà đang mở khi cửa sổ này còn chạy. Phim lưu ở ${FILMS}.`)
for (;;) {
  await tick().catch((e: unknown) => console.error(`[${new Date().toLocaleTimeString()}] ${e instanceof Error ? e.message : String(e)}`))
  await new Promise((r) => setTimeout(r, EVERY_MS))
}
