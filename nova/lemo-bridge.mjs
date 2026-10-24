// Nova's Lemo-Opuscar bridge. Runs on Chanh's PC only, never on GitHub: Lemo needs Claude Code with the
// lemo-opuscar plugin, and renders with this PC's Node, ffmpeg and browser.
//   $env:CLOUDFLARE_API_TOKEN = '<token with Workers KV Storage: Edit only>'
//   node nova/lemo-bridge.mjs
// Every minute it tells Nova the PC is on (queue.mjs ping), then takes one queued Lemo job, asks Claude Code
// to make it, and stores the MP4 back in Nova (queue.mjs store). Close it or turn the PC off and Nova stops
// offering Lemo within 3 minutes; it never hands a Lemo job to another engine.
// Nothing is posted anywhere: finished videos only appear in Nova, and posting stays Chanh's call.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const WORK = process.env.NOVA_LEMO_DIR ?? join(os.homedir(), 'nova-lemo')
const QUEUE = fileURLToPath(new URL('./queue.mjs', import.meta.url))
const EVERY_MS = 60 * 1000
// a Lemo film takes an agent 30-60 minutes
const FILM_TIMEOUT_MS = 90 * 60 * 1000
// styles of the last few films, so the channel never repeats one back to back
const LOG = join(WORK, 'styles.json')
const KEEP_STYLES = 5
// only what a film needs: run its render tools and write its own files
const TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash(node:*)', 'Bash(npm:*)', 'Bash(npx:*)', 'Bash(python:*)', 'Bash(python3:*)', 'Bash(pip:*)', 'Bash(sh:*)', 'Bash(bash:*)', 'Bash(ffmpeg:*)', 'Bash(ffprobe:*)', 'Bash(mkdir:*)', 'Bash(ls:*)', 'Bash(cp:*)', 'Bash(mv:*)', 'Bash(cd:*)', 'Skill']

if (!process.env.CLOUDFLARE_API_TOKEN) throw new Error('Set CLOUDFLARE_API_TOKEN first (see the top of this file)')
mkdirSync(join(WORK, 'out'), { recursive: true })

const queue = (...args) => {
  const r = spawnSync(process.execPath, [QUEUE, ...args], { encoding: 'utf8', env: process.env })
  if (r.status !== 0) throw new Error(`queue.mjs ${args[0]}: ${(r.stderr || r.stdout).trim().slice(0, 300)}`)
  return r.stdout.trim()
}
const recentStyles = () => {
  try {
    return JSON.parse(readFileSync(LOG, 'utf8')).slice(-KEEP_STYLES)
  } catch {
    return []
  }
}

function prompt(job, out) {
  const avoid = recentStyles()
  return [
    'Use the lemo-opuscar skill to make one short film. Work without asking questions: nobody is watching this run.',
    `Topic: ${job.topic}`,
    `Narration language: ${job.lang === 'vi' ? 'Vietnamese' : 'English'}, ${job.voice} voice. Aspect ratio ${job.aspect}.`,
    'Narration, in this order (you may tighten the wording, keep the facts):',
    ...job.lines.map((l, i) => `${i + 1}. ${l}`),
    `Pick the library style that fits the topic best${avoid.length ? `, but not any of these recent ones: ${avoid.join(', ')}` : ''}. Vary the opening, ending, pacing and music from a template look.`,
    'Original story only: no other people\'s characters, logos or music.',
    `Put the finished film at ${join(out, `${job.id}.mp4`)} and write only the style's slug to ${join(out, `${job.id}.style.txt`)}.`,
  ].join('\n')
}

/** Claude Code in headless mode; the prompt goes in on stdin so Windows never has to quote it. */
function claude(text, cwd) {
  // cmd.exe needs the tool patterns quoted: they hold ( ) and *
  const q = (a) => (process.platform === 'win32' ? `"${a}"` : a)
  const args = ['-p', '--permission-mode', 'acceptEdits', '--allowedTools', ...TOOLS.map(q)]
  return new Promise((resolve) => {
    const child = spawn('claude', args, { cwd, shell: process.platform === 'win32', stdio: ['pipe', 'inherit', 'inherit'] })
    const timer = setTimeout(() => child.kill(), FILM_TIMEOUT_MS)
    child.on('error', () => resolve({ code: -1, timedOut: false }))
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      resolve({ code, timedOut: !!signal })
    })
    child.stdin.end(text)
  })
}

async function render(id) {
  const job = JSON.parse(readFileSync(join(WORK, 'jobs', `${id}.json`), 'utf8'))
  const out = join(WORK, 'out')
  const dir = join(WORK, 'films', id)
  mkdirSync(dir, { recursive: true })
  console.log(`${new Date().toISOString()} making ${id}: ${job.topic}`)
  const r = await claude(prompt(job, out), dir)
  const mp4 = join(out, `${id}.mp4`)
  const ok = existsSync(mp4)
  const error = ok ? undefined : r.timedOut ? 'Lemo took longer than 90 minutes' : `Lemo made no video${r.code ? ` (exit ${r.code})` : ''}`
  writeFileSync(join(out, `${id}.json`), JSON.stringify({ ok, error, duration: null }))
  const style = existsSync(join(out, `${id}.style.txt`)) ? readFileSync(join(out, `${id}.style.txt`), 'utf8').trim().slice(0, 60) : ''
  if (ok && style) writeFileSync(LOG, JSON.stringify([...recentStyles(), style].slice(-KEEP_STYLES * 4)))
  queue('store', WORK, id)
  console.log(`${new Date().toISOString()} ${ok ? `done (${style || 'style unknown'})` : `failed: ${error}`}`)
}

for (;;) {
  try {
    queue('ping')
    const id = queue('pick-lemo', WORK)
    if (id) {
      // keep telling Nova the PC is on while a film renders
      const beat = setInterval(() => { try { queue('ping') } catch { /* next beat */ } }, EVERY_MS)
      try {
        await render(id)
      } finally {
        clearInterval(beat)
      }
      continue
    }
  } catch (e) {
    console.error(`${new Date().toISOString()} ${e.message}`)
  }
  await new Promise((r) => setTimeout(r, EVERY_MS))
}
