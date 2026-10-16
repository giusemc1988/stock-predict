/**
 * Fallback server for practice mode (the Cloudflare Worker runs it every 5 minutes; see src/worker.ts).
 * Reads and writes public/practice.json, which the app shows on the chart, in the feed and in the report.
 *
 *   npm run practice                        live Yahoo Finance 15-minute bars and stock movers, CoinGecko crypto movers
 *   npm run practice -- --out x.json        write somewhere else (for testing)
 *
 * The server can't see the rules saved in a browser, so it uses the default AI rules.
 * Paper only: nothing here places an order.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { parseState } from '../src/lib/autoLearn'
import type { JournalEntry } from '../src/lib/journal'
import { emptyPractice, parsePractice, type PracticeState } from '../src/lib/practice'
import { runPracticeCycle } from '../src/lib/practiceServer'

const args = process.argv.slice(2)
const outIdx = args.indexOf('--out')
const file = outIdx >= 0 ? args[outIdx + 1] : 'public/practice.json'
/** Without a new trade, rewrite the file (one commit, one redeploy) at most this often. */
const QUIET_WRITE_MS = 60 * 60_000

let prev: PracticeState = emptyPractice()
try {
  prev = parsePractice(JSON.parse(readFileSync(file, 'utf8'))) ?? prev
} catch {
  /* first run: start fresh */
}
let journal: JournalEntry[] = []
try {
  journal = parseState(JSON.parse(readFileSync('public/auto-learning.json', 'utf8')))?.journal ?? []
} catch {
  /* no learner yet: its opinion is n/a */
}

const now = Date.now()
try {
  const { next, traded, log } = await runPracticeCycle(prev, journal, now)
  for (const l of log) console.log(l)
  if (traded || now - (prev.server?.lastRun ?? 0) >= QUIET_WRITE_MS) writeFileSync(file, JSON.stringify(next))
  else console.log('No new trades; not rewriting the file this run.')
} catch (e) {
  console.error(`${(e as Error).message}; leaving the saved state unchanged.`)
  process.exit(1)
}
