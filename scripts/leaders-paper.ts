/**
 * Atlas Leaders paper slot: reads public/leaders.json (tonight's list) and public/leaders-paper.json (yesterday's book),
 * fetches free Yahoo daily bars, moves the paper book forward and writes public/leaders-paper.json. Paper only.
 *   npm run leaders:paper
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import type { Candle } from '../src/types'
import { parseLeaders } from '../src/lib/leaders'
import { addSetups, advance, dayOf, paperReport, parsePaper, stateOf } from '../src/lib/leadersPaper'

const UA = { 'User-Agent': 'Mozilla/5.0 (atlas leaders paper)' }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
type Quote = { open: (number | null)[]; high: (number | null)[]; low: (number | null)[]; close: (number | null)[]; volume: (number | null)[] }
type YahooJson = { chart: { result?: { timestamp?: number[]; indicators: { quote: Quote[]; adjclose?: { adjclose: (number | null)[] }[] } }[] } }

async function yahooDaily(symbol: string): Promise<Candle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y`
  for (let i = 0; i < 3; i++) {
    const res = await fetch(url, { headers: UA }).catch(() => null)
    if (res?.ok) {
      const r = ((await res.json()) as YahooJson).chart.result?.[0]
      const q = r?.indicators.quote[0]
      const adj = r?.indicators.adjclose?.[0]?.adjclose
      if (!r?.timestamp || !q) return []
      const out: Candle[] = []
      r.timestamp.forEach((t, k) => {
        const [o, h, l, c, v] = [q.open[k], q.high[k], q.low[k], q.close[k], q.volume[k]]
        if (o == null || h == null || l == null || c == null || !(c > 0)) return
        const f = adj?.[k] != null ? adj[k]! / c : 1
        out.push({ time: t, open: (o > 0 ? o : c) * f, high: h * f, low: l * f, close: c * f, volume: v ?? 0 })
      })
      // today's bar while the US market is still open is not a close yet
      if (out.length && dayOf(out[out.length - 1].time) === new Date().toISOString().slice(0, 10) && new Date().getUTCHours() < 21) out.pop()
      return out
    }
    await sleep(1500 * (i + 1))
  }
  throw new Error(`Yahoo failed for ${symbol}`)
}

const leaders = parseLeaders(JSON.parse(readFileSync('public/leaders.json', 'utf8')))
if (!leaders) throw new Error('public/leaders.json is missing or broken')
const prev = existsSync('public/leaders-paper.json') ? parsePaper(JSON.parse(readFileSync('public/leaders-paper.json', 'utf8'))) : null
const state = stateOf(prev)
const symbols = [...new Set([...leaders.leaders.map((l) => l.symbol), ...state.watching.map((w) => w.symbol), ...state.open.map((p) => p.symbol)])]

const bars: Record<string, Candle[]> = {}
let failed = 0
for (let i = 0; i < symbols.length; i += 5) {
  await Promise.all(
    symbols.slice(i, i + 5).map(async (s) => {
      try {
        bars[s] = await yahooDaily(s)
      } catch {
        failed++
      }
    }),
  )
  await sleep(300)
}
if (failed > symbols.length * 0.3) throw new Error(`${failed} of ${symbols.length} Yahoo fetches failed; keeping the old file`)

const moved = advance(state, bars)
const next = addSetups(moved, leaders.leaders.map((l) => l.symbol), bars)
const rep = paperReport(next, new Date().toISOString())
writeFileSync('public/leaders-paper.json', JSON.stringify(rep, null, 1))
console.log(`leaders paper: asOf ${rep.asOf}, watching ${rep.watching.length}, open ${rep.open.length}, closed ${rep.closed.length}, status ${rep.score.status}, fetch failures ${failed}`)
