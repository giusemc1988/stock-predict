/**
 * Shadow leads runner (L1 D1+VIX gate, L2 hold winners overnight, L3 ETF trend core; logic in src/lib/shadowLeads.ts).
 * Runs inside the existing Worker cron after the live cycle, at most once per trading day after the close.
 * Record-only: it READS the `state` KV key and writes only `shadow:leads`, `shadow:work` and `shadowLast`.
 *
 * Fetching: Yahoo's multi-symbol spark endpoint works (verified 2026-11-01: up to 20 symbols per request, closes
 * only), so the 94 stocks + 23 ETFs + VIX need 7 requests a day instead of 118. The next-day OPENS that L1 entries
 * and L2 fills need are not in spark, so those come from the chart endpoint, one request per name with a pending
 * entry (about 10 to 15). wrangler.jsonc sets no plan limit and the live cycle already makes about 40 subrequests
 * per tick, so the work is also SPREAD over cron ticks: at most FETCH_BUDGET requests per tick, progress in
 * `shadow:work`. The day is finished (and `doneDay` written) once every request is done or has failed 3 times.
 */
import type { AiRules } from '../lib/aiRules'
import { costsFrom } from '../lib/costs'
import { dayKey, sessionEnd } from '../lib/practice'
import { ETF_UNIVERSE } from '../lib/replayRound2'
import { STOCKS } from '../lib/replayUniverse'
import { emptyLeads, etfCompact, l1Step, l2Candidates, l2Step, l3Step, parseLeads, type EtfData, type Opens, type Px, type ShadowLeads } from '../lib/shadowLeads'
import type { WorkerEnv } from './practiceCycle'

const UA = { 'User-Agent': 'Mozilla/5.0 (arc-analyst practice)' }
const SPARK_MAX = 20
/** External requests per cron tick, kept small so the live cycle's own ~40 stay clear of the 50-request cap. */
export const FETCH_BUDGET = 5
const MAX_TRIES = 3
/** Runs this long after the 15:55 ET live close (same delay as the Telegram summary) so the day's bar is final. */
const AFTER_CLOSE_MS = 10 * 60_000
const TAIL = 12

const VIX = '^VIX'
const ETF_SET = new Set(ETF_UNIVERSE)
const chunk = <T>(a: T[], n: number): T[][] => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n))
/** Spark batches: ETFs + VIX need two years of closes (12-1 month signal, VIX median); stocks only the last month. */
export const BATCHES: { id: string; symbols: string[]; range: '2y' | '1mo' }[] = [
  ...chunk([...ETF_UNIVERSE, VIX], SPARK_MAX).map((symbols, i) => ({ id: `e${i}`, symbols, range: '2y' as const })),
  ...chunk(STOCKS.filter((s) => !ETF_SET.has(s)), SPARK_MAX).map((symbols, i) => ({ id: `s${i}`, symbols, range: '1mo' as const })),
]

interface Work {
  day: string
  /** Tries per task id ('e0', 's3', 'o:AAPL'); a task with MAX_TRIES tries and no data is given up. */
  tries: Record<string, number>
  done: string[]
  stocks: Record<string, Px>
  etf: Record<string, EtfData>
  /** Last TAIL closes of every ETF (the 3 ETFs inside the L1 universe need them for the 5-day rank). */
  tail: Record<string, Px>
  vix: number[] | null
  opens: Opens
}
const newWork = (day: string): Work => ({ day, tries: {}, done: [], stocks: {}, etf: {}, tail: {}, vix: null, opens: {} })

type Fetch = typeof fetch
type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

function toPx(ts: number[] | undefined, vals: (number | null)[] | undefined): Px {
  const out: Px = []
  ;(ts ?? []).forEach((t, i) => {
    const v = vals?.[i]
    if (v != null && Number.isFinite(v)) out.push([dayKey(t * 1000), v])
  })
  // one bar per day: the later one wins (a live bar can repeat the day)
  return out.filter((x, i) => i === out.length - 1 || out[i + 1][0] !== x[0])
}

async function getJson(f: Fetch, url: string): Promise<Json> {
  const res = await f(url, { headers: UA })
  if (!res.ok) throw new Error(`Yahoo ${res.status}`)
  return (await res.json()) as Json
}

async function runBatch(f: Fetch, b: (typeof BATCHES)[number], w: Work) {
  const j = await getJson(f, `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${b.symbols.map(encodeURIComponent).join(',')}&range=${b.range}&interval=1d`)
  const rows: Json[] = j.spark?.result
  if (!Array.isArray(rows) || !rows.length) throw new Error('spark: no result')
  for (const r of rows) {
    const resp = r.response?.[0]
    const px = toPx(resp?.timestamp, resp?.indicators?.quote?.[0]?.close)
    if (!px.length) continue
    if (r.symbol === VIX) w.vix = px.map(([, c]) => c)
    else if (ETF_SET.has(r.symbol)) {
      const e = etfCompact(px)
      if (e) w.etf[r.symbol] = e
      w.tail[r.symbol] = px.slice(-TAIL)
    } else w.stocks[r.symbol] = px.slice(-TAIL)
  }
}

async function runOpen(f: Fetch, sym: string, w: Work) {
  const j = await getJson(f, `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`)
  const r = j.chart?.result?.[0]
  const px = toPx(r?.timestamp, r?.indicators?.quote?.[0]?.open)
  if (!px.length) throw new Error('chart: no bars')
  w.opens[sym] = px
}

/** Names whose next open is needed today: pending L1 entries and L2 fills whose day is already over. */
function openSymbols(leads: ShadowLeads, state: StateLite | null, day: string): string[] {
  const out = new Set<string>()
  for (const p of leads.l1.pending) if (p.signalDay < day) out.add(p.sym)
  for (const p of leads.l2.pending) out.add(p.sym)
  for (const c of l2Candidates(state?.trades ?? [], leads.l2.seen, leads.l2.since || day)) if (c.closedDay < day) out.add(c.sym) // closed today: its next open is tomorrow
  return [...out].sort()
}

/** The slice of the live state this reads (never written). */
type StateLite = { trades: Parameters<typeof l2Step>[1]['trades'] }

async function readState(env: WorkerEnv): Promise<StateLite | null> {
  const raw = await env.PRACTICE.get('state')
  if (!raw) return null
  const s = JSON.parse(raw) as { trades?: unknown }
  return Array.isArray(s.trades) ? { trades: s.trades as StateLite['trades'] } : null
}

/** Today's finished data to the three leads. Pure given its inputs. */
export function applyDay(leads: ShadowLeads, w: Work, state: StateLite | null, rules: Pick<AiRules, 'costsOn' | 'feeBps' | 'spreadBps' | 'slippageBps'>): ShadowLeads {
  const day = w.day
  const costs = costsFrom(rules)
  const spyDay = w.etf.SPY?.lastDay
  if (spyDay !== day) return { ...leads, doneDay: day } // holiday, or Yahoo has no bar for today: nothing to record
  const series: Record<string, Px> = { ...w.stocks }
  for (const s of STOCKS) if (ETF_SET.has(s) && w.tail[s]) series[s] = w.tail[s]
  // a decile of a partly missing universe is not the lab's decile: with under 90% of the names there are no new signals
  const rankOk = STOCKS.filter((x) => series[x]?.at(-1)?.[0] === day).length >= STOCKS.length * 0.9
  return {
    ...leads,
    doneDay: day,
    l1: l1Step(leads.l1, { day, series, opens: w.opens, vix: w.vix, rankOk, costs }),
    l2: l2Step(leads.l2, { day, trades: state?.trades ?? [], opens: w.opens }),
    l3: l3Step(leads.l3, { day, etf: w.etf, costs }),
  }
}

export interface StepResult {
  note: string
  /** True when the day was recorded (leads written), false when more ticks are needed. */
  finished: boolean
}

/**
 * One cron tick of the shadow work. Returns null when there was nothing to do. Throws on a real error: the caller
 * catches it, so a shadow failure can never touch the live cycle.
 */
export async function shadowStep(env: WorkerEnv, now: number, rules: AiRules, f: Fetch = fetch): Promise<StepResult | null> {
  if (!rules.shadowLeads) return null
  if (now < sessionEnd('stock', now) + AFTER_CLOSE_MS) return null
  const day = dayKey(now)
  const leads = parseLeads(JSON.parse((await env.PRACTICE.get('shadow:leads')) ?? 'null')) ?? emptyLeads()
  if (leads.doneDay === day) return null // idempotent: today is finished

  let w: Work = newWork(day)
  try {
    const stored = JSON.parse((await env.PRACTICE.get('shadow:work')) ?? 'null') as Work | null
    if (stored?.day === day) w = stored
  } catch {
    /* unreadable progress: start the day again */
  }
  const state = await readState(env).catch(() => null)

  // the requests still to do, in order: ETF/VIX batches first (the first one holds SPY, which tells a holiday), stocks, then opens
  const notDone = (id: string) => !w.done.includes(id)
  const holiday = w.done.includes('e0') && w.etf.SPY?.lastDay !== day
  const todo: { id: string; run: () => Promise<void> }[] = holiday
    ? []
    : [
        ...BATCHES.filter((b) => notDone(b.id)).map((b) => ({ id: b.id, run: () => runBatch(f, b, w) })),
        ...openSymbols(leads, state, day).filter((x) => notDone(`o:${x}`)).map((x) => ({ id: `o:${x}`, run: () => runOpen(f, x, w) })),
      ]
  const batch = todo.slice(0, FETCH_BUDGET)
  await Promise.all(
    batch.map(async (t) => {
      try {
        await t.run()
        w.done.push(t.id)
      } catch {
        w.tries[t.id] = (w.tries[t.id] ?? 0) + 1
        if (w.tries[t.id] >= MAX_TRIES) w.done.push(t.id) // give up on this one; the day still finishes
      }
    }),
  )
  if (todo.some((t) => notDone(t.id))) {
    await env.PRACTICE.put('shadow:work', JSON.stringify(w)) // progress for the next tick
    return { note: `shadow ${day}: ${w.done.length} requests done, more next tick`, finished: false }
  }
  const next = applyDay(leads, w, state, rules)
  await env.PRACTICE.put('shadow:leads', JSON.stringify(next))
  await env.PRACTICE.delete('shadow:work').catch(() => {})
  return { note: `shadow ${day}: ${w.etf.SPY?.lastDay === day ? 'recorded' : 'no session'}; L1 ${next.l1.agg.n} closed, ${next.l1.open.length} open; L2 ${next.l2.agg.n}; L3 ${next.l3 ? next.l3.equity : 'n/a'}`, finished: true }
}

/** Called from scheduled(): never throws. Writes KV `shadowLast` (cronLast style) when a day finishes or a tick fails. */
export async function shadowGuarded(env: WorkerEnv, now: number, rules: AiRules, f: Fetch = fetch): Promise<void> {
  const t0 = Date.now()
  try {
    const r = await shadowStep(env, now, rules, f)
    if (r?.finished) await env.PRACTICE.put('shadowLast', JSON.stringify({ at: now, ok: true, ms: Date.now() - t0, message: r.note }))
  } catch (e) {
    console.log('Shadow leads error:', e instanceof Error ? e.message : e)
    await env.PRACTICE.put('shadowLast', JSON.stringify({ at: now, ok: false, ms: Date.now() - t0, error: e instanceof Error ? `${e.message}
${e.stack ?? ''}`.slice(0, 1500) : String(e) })).catch(() => {})
  }
}
