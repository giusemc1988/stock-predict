// Wake-up for Milo's board tasks (no AI in this script). Runs from a scheduled task every few minutes.
// 1. Reads the board (docs/handoff/team.json on branch handoff-log, own read-only clone).
// 2. A task for Milo that is open, already has its TASK file in --milo-dir and has no PROGRESS/RESULT file:
//    send the same prompt as the board button "Sao chep loi nhac cho Milo", once per task, to the Hermes gateway
//    (signed POST to its localhost webhook route neohub-wake; Hermes is the agent on this PC). If the gateway does
//    not answer, fall back to `hermes chat --query-file <prompt> --oneshot` started in the background.
// 3. Still unclaimed after --alert-min minutes (15): one Telegram message to Chanh (Bot API sendMessage with the
//    token and chat Hermes already has in its .env; sending only, never getUpdates; the token is never printed)
//    and one red line on the board ("say" action).
// Never deploys, never merges, never polls Telegram. Usage:
//   node team-wake.mjs --home <folder for the clone> --milo-dir <milo-shared> [--alert-min 15] [--dry] [--only T23,T24]
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { applyInDir } from './team-apply.mjs'
import { miloPrompt, progressFileName, resultFileName, taskFileName } from './team-core.mjs'

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 ? process.argv[i + 1] : d
}
const dry = process.argv.includes('--dry')
const home = arg('home', process.cwd())
const miloDir = arg('milo-dir')
const alertMs = Number(arg('alert-min', '15')) * 60 * 1000
if (!miloDir || !existsSync(miloDir)) throw new Error('--milo-dir <folder> is required')
const repo = arg('repo', 'https://github.com/giusemc1988/stock-predict.git')
const clone = join(home, 'wake-repo')
const stateFile = join(miloDir, 'wake-state.json')
const hermes = arg('hermes', 'hermes')
const hermesEnv = arg('hermes-env', join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'hermes', '.env'))
const run = (cmd, args, cwd, timeout = 120000) => execFileSync(cmd, args, { cwd, timeout, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
const log = (m) => console.log(`${new Date().toISOString()} ${m}`)

function sync() {
  if (!existsSync(join(clone, '.git'))) run('git', ['clone', '--quiet', '--branch', 'handoff-log', '--single-branch', repo, clone], home)
  run('git', ['fetch', '--quiet', 'origin', 'handoff-log'], clone)
  run('git', ['reset', '--quiet', '--hard', 'origin/handoff-log'], clone)
}
const board = () => JSON.parse(readFileSync(join(clone, 'docs/handoff/team.json'), 'utf8'))

/** One line on the board's team feed; retries from the remote when someone pushed first. */
function say(text, ref) {
  for (let i = 0; i < 4; i++) {
    sync()
    applyInDir(clone, { type: 'say', from: 'wake', to: 'chanh', text, ref }, 'wake')
    run('git', ['add', 'docs/handoff'], clone)
    run('git', ['-c', 'user.name=milo-wake', '-c', 'user.email=wake@neo-hub.local', 'commit', '--quiet', '-m', `team: say ${ref}`, '-m', 'agent: wake'], clone)
    try {
      run('git', ['push', '--quiet', 'origin', 'HEAD:handoff-log'], clone)
      return
    } catch {
      /* someone pushed first: start again from the remote */
    }
  }
  throw new Error('push failed 4 times')
}

/** Telegram sendMessage to Chanh's own chat with the Hermes bot. Throws a message that never contains the token. */
async function telegram(text) {
  const env = Object.fromEntries(readFileSync(hermesEnv, 'utf8').split(/\r?\n/).map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]))
  const chat = env.TELEGRAM_HOME_CHANNEL || (env.TELEGRAM_ALLOWED_USERS ?? '').split(',')[0]
  if (!env.TELEGRAM_BOT_TOKEN || !chat) throw new Error('no Telegram bot or chat in the Hermes .env')
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chat.trim(), text: text.slice(0, 4000) }), signal: AbortSignal.timeout(30000) })
  if (!r.ok) throw new Error(`Telegram answered ${r.status} ${String((await r.json().catch(() => ({}))).description ?? '').slice(0, 100)}`)
}

const via = arg('via', 'webhook') // webhook = the running Hermes gateway (route neohub-wake, localhost only); oneshot = a separate `hermes chat --oneshot` run
const readEnv = () => Object.fromEntries(readFileSync(hermesEnv, 'utf8').split(/\r?\n/).map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]))
/** POST the prompt to the Hermes gateway webhook, signed with its secret (HMAC-SHA256, X-Hub-Signature-256). Throws unless accepted. */
async function webhook(prompt) {
  const env = readEnv()
  if (!env.WEBHOOK_SECRET) throw new Error('no WEBHOOK_SECRET in the Hermes .env')
  const body = JSON.stringify({ prompt })
  const sig = `sha256=${createHmac('sha256', env.WEBHOOK_SECRET).update(body).digest('hex')}`
  const r = await fetch(`http://127.0.0.1:${env.WEBHOOK_PORT || 8644}/webhooks/neohub-wake`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': sig }, body, signal: AbortSignal.timeout(20000) })
  if (r.status !== 202) throw new Error(`gateway answered ${r.status}`)
}

const load = () => {
  try {
    return JSON.parse(readFileSync(stateFile, 'utf8'))
  } catch {
    return { tasks: {} }
  }
}
const save = (st) => writeFileSync(stateFile, JSON.stringify(st, null, 2))
const alive = (pid) => {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

sync()
const st = load()
const now = Date.now()
const only = arg('only') // test switch: wake only these task ids, e.g. --only T23,T24
const open = board().tasks.filter((t) => t.owner === 'milo' && t.kind === 'code' && (t.status === 'todo' || t.status === 'running') && (!only || only.split(',').includes(t.id)))
for (const t of open) {
  const claimed = existsSync(join(miloDir, progressFileName(t.id))) || existsSync(join(miloDir, resultFileName(t.id)))
  const rec = st.tasks[t.id] ?? {}
  if (claimed) {
    if (rec.sentAt && !rec.pickedAt) {
      rec.pickedAt = now
      log(`${t.id} picked up ${Math.round((now - rec.sentAt) / 1000)}s after the prompt was sent`)
    }
    st.tasks[t.id] = rec
    continue
  }
  if (!existsSync(join(miloDir, taskFileName(t.id)))) continue // the bridge has not written the TASK file yet
  if (!rec.sentAt) {
    // one Hermes run at a time
    if (Object.values(st.tasks).some((r) => r.pickedAt === undefined && alive(r.pid))) continue
    const prompt = `${miloPrompt([t])}\n\nThe full order file is ${join(miloDir, taskFileName(t.id))}. milo-shared is ${miloDir}.\n`
    const pf = join(miloDir, `wake-prompt-${t.id}.txt`)
    if (dry) {
      log(`dry: would send ${t.id} (${prompt.length} chars)`)
      continue
    }
    try {
      if (via !== 'webhook') throw new Error('oneshot requested')
      await webhook(prompt)
      Object.assign(rec, { sentAt: now, via: 'webhook' })
      log(`${t.id} prompt sent to the Hermes gateway webhook`)
    } catch (e) {
      if (via === 'webhook') log(`${t.id} webhook failed (${String(e.message).slice(0, 120)}), using hermes chat --oneshot`)
      writeFileSync(pf, prompt)
      mkdirSync(join(miloDir, 'wake-logs'), { recursive: true })
      const out = openSync(join(miloDir, 'wake-logs', `${t.id}.log`), 'a')
      const child = spawn(hermes, ['chat', '--query-file', pf, '--oneshot', '-Q'], { cwd: miloDir, detached: true, stdio: ['ignore', out, out], windowsHide: true })
      child.unref()
      Object.assign(rec, { sentAt: now, pid: child.pid, via: 'oneshot' })
      log(`${t.id} prompt sent to Hermes (pid ${child.pid})`)
    }
  } else if (!rec.alertedAt && now - rec.sentAt > alertMs) {
    const mins = Math.round((now - rec.sentAt) / 60000)
    const msg = `Milo chưa nhận việc ${t.id} sau ${mins} phút: ${t.title}\nBấm "Sao chép lời nhắc cho Milo" trên bảng Max rồi dán vào chat Milo. File việc: ${taskFileName(t.id)}.`
    if (dry) log(`dry: would alert ${t.id}`)
    else {
      try {
        await telegram(msg)
        rec.alertedAt = now
        say(`[ĐỎ] ${t.id} chưa ai nhận sau ${mins} phút. Dán lời nhắc cho Milo.`, t.id)
        log(`${t.id} alert sent`)
      } catch (e) {
        log(`${t.id} alert failed: ${String(e.message).replace(/bot\d+:[\w-]+/g, 'bot<hidden>').slice(0, 300)}`) // retried next run
      }
    }
  }
  st.tasks[t.id] = rec
}
if (!dry) save(st)
