// Machine bridge for the Neo Hub "Văn phòng" (team) board. Runs on Hermes Windows / Hermes Ubuntu from the
// watcher every 5 minutes: heartbeat, then run at most one whitelisted job assigned to this machine.
// No AI model involved: jobs are fixed scripts (Chanh 2026-11-12). Never deploys, never merges.
// Usage: node team-bridge.mjs --machine windows|ubuntu --home <folder for clones> [--neohub <clone>] [--bayready <clone>] [--bayready-src <folder>] [--out <zip folder>] [--milo-dir <Milo's task folder>]
// With --milo-dir it also carries board tasks for Milo: writes TASK-board-<id>.md there and reads PROGRESS-board-<id>.md and RESULT-board-<id>.md back (plain files, no AI).
// Each run also keeps the two newest BayReady versions zipped on the Desktop (bayready-backup.mjs).
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statfsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { handedOpen, isOnline, JOBS, MACHINES, nextJob, ONLINE_MS, progressFileName, readProgress, resultFileName, taskFile, taskFileName, toHandOff } from './team-core.mjs'
import { applyInDir } from './team-apply.mjs'
import { backupBayReady } from './bayready-backup.mjs'

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 ? process.argv[i + 1] : d
}
const machine = arg('machine')
if (!MACHINES.includes(machine)) throw new Error('--machine windows|ubuntu')
const home = arg('home', process.cwd())
const repo = 'https://github.com/giusemc1988/stock-predict.git'
const hand = join(home, 'handoff-repo')
const neohub = arg('neohub', join(home, 'neohub-repo'))
const bayready = arg('bayready', join(home, 'bayready-repo'))
const out = arg('out', join(home, 'dist'))
// Only npm needs a shell on Windows (npm.cmd); git runs directly so its arguments (commit message) stay intact.
const run = (cmd, args, cwd, timeout = 120000) => execFileSync(cmd, args, { cwd, timeout, encoding: 'utf8', shell: process.platform === 'win32' && cmd === 'npm', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
const git = (args, cwd = hand) => run('git', args, cwd)
const tail = (s) => String(s ?? '').trim().split('\n').slice(-6).join(' / ').slice(-600)

function sync() {
  if (!existsSync(join(hand, '.git'))) run('git', ['clone', '--quiet', '--branch', 'handoff-log', '--single-branch', repo, hand], home)
  git(['fetch', '--quiet', 'origin', 'handoff-log'])
  git(['reset', '--quiet', '--hard', 'origin/handoff-log'])
}
const state = () => JSON.parse(readFileSync(join(hand, 'docs/handoff/team.json'), 'utf8'))

/** Apply one action and push; on a race, start again from the remote (the action is re-applied). */
function act(action) {
  for (let i = 0; i < 4; i++) {
    sync()
    const { log } = applyInDir(hand, action, `hermes-${machine === 'windows' ? 'win' : 'ubuntu'}`)
    git(['add', 'docs/handoff'])
    const subject = `team: ${log ? `${log.type} ${log.what}`.slice(0, 70) : `beat ${machine}`}`.replace(/["\r\n]/g, ' ')
    git(['-c', `user.name=hermes-${machine}`, '-c', 'user.email=hermes@neo-hub.local', 'commit', '--quiet', '-m', subject, '-m', `agent: hermes-${machine === 'windows' ? 'win' : 'ubuntu'}`])
    try {
      git(['push', '--quiet', 'origin', 'HEAD:handoff-log'])
      return
    } catch {
      /* someone else pushed first: retry from the new remote */
    }
  }
  throw new Error('push failed 4 times')
}

const jobs = {
  status: () => {
    const fs = statfsSync(home)
    const free = ((fs.bavail * fs.bsize) / 1e9).toFixed(1)
    return `node ${process.version}, disk free ${free} GB, git ${run('git', ['--version']).trim().replace('git version ', '')}`
  },
  'neohub-test': () => {
    if (!existsSync(join(neohub, '.git'))) run('git', ['clone', '--quiet', repo, neohub], home)
    run('git', ['pull', '--ff-only', '--quiet'], neohub)
    run('npm', ['ci', '--silent'], neohub, 900000)
    run('npm', ['test'], neohub, 900000)
    run('npm', ['run', 'build'], neohub, 900000)
    return `tests + build passed at ${run('git', ['log', '-1', '--format=%h %s'], neohub).trim()}`
  },
  'bayready-pull': () => {
    if (!existsSync(join(bayready, '.git'))) throw new Error(`no BayReady clone at ${bayready}`)
    run('git', ['pull', '--ff-only', '--quiet'], bayready)
    return `BayReady at ${run('git', ['log', '-1', '--format=%h %s'], bayready).trim()}`
  },
  'bayready-zip': () => {
    if (!existsSync(join(bayready, '.git'))) throw new Error(`no BayReady clone at ${bayready}`)
    run('git', ['pull', '--ff-only', '--quiet'], bayready)
    const v = JSON.parse(readFileSync(join(bayready, 'manifest.json'), 'utf8')).version
    mkdirSync(out, { recursive: true })
    const zip = join(out, `bayready-v${v}.zip`)
    run('git', ['archive', '--format=zip', '-o', zip, 'HEAD'], bayready)
    return `built ${zip}`
  },
}

try {
  run('git', ['pull', '--ff-only', '--quiet'], neohub) // keep this script and the jobs current for the next run
} catch {
  /* not fatal */
}
process.on('uncaughtException', (e) => {
  console.log(`bridge failed: ${tail(e.stderr || e.message)}`)
  process.exit(1)
})
try {
  // the BayReady repo clone when it exists, else a local copy given with --bayready-src
  const saved = backupBayReady(existsSync(join(bayready, '.git')) ? bayready : arg('bayready-src'))
  if (saved) console.log(`backup: ${saved}`)
} catch (e) {
  console.log(`backup failed: ${tail(e.message)}`)
}
sync()
// Milo tasks from the board: write the TASK file, then pick up the RESULT file when Milo has written it.
const miloDir = arg('milo-dir')
if (miloDir && existsSync(miloDir)) {
  for (const t of toHandOff(state()).slice(0, 3)) {
    try {
      writeFileSync(join(miloDir, taskFileName(t.id)), taskFile(t))
      act({ type: 'handoff', id: t.id, machine })
      console.log(`${t.id} handed to Milo`)
    } catch (e) {
      console.log(`handoff ${t.id} skipped: ${tail(e.message)}`) // the other machine got there first
    }
  }
  for (const t of handedOpen(state(), machine)) {
    const f = join(miloDir, resultFileName(t.id))
    // Milo's PROGRESS file: picked up, where the work is, what Milo needs from Chanh (sent only when it changed)
    const pf = join(miloDir, progressFileName(t.id))
    if (!existsSync(f) && existsSync(pf)) {
      try {
        const n = readProgress(readFileSync(pf, 'utf8'))
        if ((n.text || n.need) && (t.status !== 'running' || (t.progress ?? '') !== n.text || (t.need ?? '') !== n.need)) {
          act({ type: 'note', id: t.id, text: n.text, need: n.need })
          console.log(`${t.id} progress read`)
        }
      } catch (e) {
        console.log(`progress ${t.id} skipped: ${tail(e.message)}`)
      }
    }
    if (!existsSync(f)) continue
    try {
      const txt = readFileSync(f, 'utf8').trim()
      act({ type: 'finish', id: t.id, ok: !/^\W*FAILED/i.test(txt), result: txt })
      console.log(`${t.id} result read`)
    } catch (e) {
      console.log(`result ${t.id} skipped: ${tail(e.message)}`)
    }
  }
}
const s = state()
const job = nextJob(s, machine)
if (!job && isOnline(s.machines[machine], Date.now() + ONLINE_MS - 30 * 60 * 1000)) process.exit(0) // beat at most every 30 min when idle
act({ type: 'beat', machine, note: job ? `running ${job.job}` : 'idle' })
if (!job) process.exit(0)
if (!JOBS.includes(job.job)) throw new Error(`job ${job.job} not allowed`)
act({ type: 'claim', id: job.id })
let ok = true
let result = ''
try {
  result = jobs[job.job]()
} catch (e) {
  ok = false
  result = tail(e.stderr || e.stdout || e.message)
}
act({ type: 'finish', id: job.id, ok, result })
console.log(`${job.id} ${job.job}: ${ok ? 'done' : 'failed'} ${result}`)
