#!/usr/bin/env node
// Atlas trade ledger: where do the closed practice trades win or lose? Pure script, no AI, no network.
// usage: node scripts/ledger.mjs <practice.json> [outDir]   (file = KV backup with .state, or a bare practice state)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const [, , file, outDir = 'ledger'] = process.argv
if (!file) {
  console.error('usage: node scripts/ledger.mjs <practice.json> [outDir]')
  process.exit(1)
}
let raw = JSON.parse(readFileSync(file, 'utf8'))
if (raw.state) raw = typeof raw.state === 'string' ? JSON.parse(raw.state) : raw.state
const trades = Array.isArray(raw.trades) ? raw.trades : []

const etHour = (ms) => Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false }).format(new Date(ms))) % 24
const etDay = (ms) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(new Date(ms))
const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null)
const band = (v, cuts, labels) => {
  if (v == null) return 'unknown'
  for (let i = 0; i < cuts.length; i++) if (v < cuts[i]) return labels[i]
  return labels[cuts.length]
}

const dims = {
  kind: (t) => t.kind ?? 'unknown',
  source: (t) => t.info?.pick?.source ?? 'unknown',
  'hour ET': (t) => String(etHour(t.openedAt)).padStart(2, '0') + ':00',
  weekday: (t) => etDay(t.openedAt),
  'stop %': (t) => {
    const e = num(t.entry)
    const s = num(t.stop)
    return band(e && s ? ((e - s) / e) * 100 : null, [1, 2, 3], ['<1%', '1-2%', '2-3%', '3%+'])
  },
  'volume x': (t) => band(num(t.info?.pick?.volVsAvg), [1, 1.5, 3], ['<1x', '1-1.5x', '1.5-3x', '3x+']),
  price: (t) => band(num(t.entry), [10, 30, 100], ['<$10', '$10-30', '$30-100', '$100+']),
  'held min': (t) => band(t.closedAt && t.openedAt ? (t.closedAt - t.openedAt) / 60000 : null, [30, 90, 240], ['<30m', '30-90m', '1.5-4h', '4h+']),
  'exit reason': (t) => t.exitReason ?? 'unknown',
  regime: (t) => t.info?.regime ?? 'unknown',
  grade: (t) => t.info?.grade ?? 'unknown',
  'passes filters': (t) => (t.info?.shadow ? (t.info.shadow.pass ? 'yes' : 'no') : 'untagged'),
}

function agg(list) {
  let wins = 0
  let gw = 0
  let gl = 0
  let net = 0
  let cost = 0
  for (const t of list) {
    const p = num(t.pnl) ?? 0
    net += p
    cost += num(t.costPaid) ?? 0
    if (p > 0) {
      wins++
      gw += p
    } else gl += -p
  }
  const n = list.length
  return {
    n,
    wr: n ? +((100 * wins) / n).toFixed(1) : 0,
    net: +net.toFixed(2),
    cost: +cost.toFixed(2),
    pf: gl ? +(gw / gl).toFixed(2) : gw ? 99 : 0,
  }
}

const out = { asOf: new Date().toISOString(), all: agg(trades), last50: agg(trades.slice(-50)), dims: {} }
for (const [name, f] of Object.entries(dims)) {
  const g = new Map()
  for (const t of trades) {
    const k = f(t)
    if (!g.has(k)) g.set(k, [])
    g.get(k).push(t)
  }
  out.dims[name] = [...g].map(([k, l]) => ({ key: k, ...agg(l) })).sort((a, b) => a.net - b.net)
}

const row = (r) => `| ${r.key} | ${r.n} | ${r.wr}% | ${r.pf} | ${r.net} | ${r.cost} |`
let md = `# Atlas ledger (auto, no AI)\n\nAs of ${out.asOf}. All: ${out.all.n} trades, WR ${out.all.wr}%, PF ${out.all.pf}, net $${out.all.net}, costs $${out.all.cost}. Last 50: WR ${out.last50.wr}%, PF ${out.last50.pf}, net $${out.last50.net}.\n\nBuckets under 30 trades are noise. Sorted worst net first.\n`
for (const [name, rows] of Object.entries(out.dims)) {
  md += `\n## ${name}\n| bucket | n | WR | PF | net $ | costs $ |\n|---|---|---|---|---|---|\n${rows.map(row).join('\n')}\n`
}
mkdirSync(outDir, { recursive: true })
writeFileSync(`${outDir}/ledger.json`, JSON.stringify(out, null, 1))
writeFileSync(`${outDir}/LEDGER.md`, md)
console.log(md.split('\n').slice(0, 3).join('\n'))
