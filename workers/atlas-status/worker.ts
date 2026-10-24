/**
 * Atlas (Stock Predictor) - read-only status endpoint
 * Serves live metrics from practice trading account without Cloudflare Access protection
 */
import type { PracticeState } from '../../src/lib/practice'

interface Env {
  PRACTICE: KVNamespace
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  })

const etDay = (ms: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms))

/** Why Atlas did or didn't trade: last scan, what the scan saw, and today's decision log. Read-only. */
function diagnostics(s: PracticeState) {
  const sv = s.server
  const lastRun = sv?.lastRun ?? null
  const day = lastRun ? etDay(lastRun) : null
  const verdicts: Record<string, number> = {}
  for (const p of sv?.picks ?? []) verdicts[p.verdict ?? 'none'] = (verdicts[p.verdict ?? 'none'] ?? 0) + 1
  const audit = (s.audit ?? []).filter((e) => e.account === 'practice' && day && etDay(e.time) === day)
  const blocked: Record<string, number> = {}
  for (const e of audit) if (!e.accepted) blocked[e.blockedBy ?? 'Other'] = (blocked[e.blockedBy ?? 'Other'] ?? 0) + 1
  return {
    lastRun: lastRun ? new Date(lastRun).toISOString() : null,
    minutesAgo: lastRun ? Math.round((Date.now() - lastRun) / 60_000) : null,
    scanned: sv?.picks?.length ?? 0,
    failed: sv?.failed ?? [],
    lastScanVerdicts: verdicts,
    today: { day, decisions: audit.length, accepted: audit.filter((e) => e.accepted).length, blocked },
    recentEvents: (s.events ?? []).slice(0, 8).map((e) => ({ at: new Date(e.time).toISOString(), kind: e.kind, symbol: e.symbol, en: e.en })),
    recentDecisions: (s.audit ?? []).slice(0, 8).map((e) => ({ at: new Date(e.time).toISOString(), symbol: e.symbol, accepted: e.accepted, blockedBy: e.blockedBy ?? null, en: e.en })),
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)

    if (url.pathname === '/' && req.method === 'GET') {
      try {
        const stored = await env.PRACTICE.get('state')
        const state: PracticeState = stored ? JSON.parse(stored) : null

        if (!state) {
          return json({
            equity: 10000,
            trades: 0,
            open: 0,
            wr: null,
            pf: null,
            learning: 'n/a',
            brakes: 'normal',
            kelly: 'n/a',
            return: 0
          })
        }

        // Calculate metrics from closed trades
        const trades = state.trades || []
        const equity = 10000 + (state.realized ?? 0)
        const ret = (state.realized ?? 0) / 10000

        let wins = 0, winSum = 0, lossSum = 0
        for (const t of trades) {
          if (t.pnl > 0) {
            wins++
            winSum += t.pnl
          } else {
            lossSum += Math.abs(t.pnl)
          }
        }

        const wr = trades.length > 0 ? (wins / trades.length) : null
        const pf = lossSum > 0 && winSum > 0 ? winSum / lossSum : (winSum > 0 ? null : 0)

        // Estimate brake status from realized loss
        const brakeStatus = ret >= -0.03 ? 'normal' : ret >= -0.06 ? 'HALF (-3%)' : ret >= -0.15 ? 'QUARTER (-6%)' : 'STOPPED (-15%)'

        // Estimate learning status
        const learningStatus = wr != null && wr < 0.4 ? `PAUSED (WR ${(wr * 100).toFixed(0)}%)` : wr != null ? `active (WR ${(wr * 100).toFixed(0)}%)` : 'n/a'

        // Kelly status
        const kellyStatus = wr != null && wr >= 0.5 && trades.length >= 10 ? `${(0.25 * 100).toFixed(1)}% Kelly` : 'n/a'

        return json({
          equity: parseFloat(equity.toFixed(2)),
          trades: trades.length,
          open: (state.open || []).length,
          wr: wr ? parseFloat((wr * 100).toFixed(1)) : null,
          pf: pf ? parseFloat(pf.toFixed(2)) : null,
          return: parseFloat((ret * 100).toFixed(2)),
          learning: learningStatus,
          brakes: brakeStatus,
          kelly: kellyStatus,
          diag: { ...diagnostics(state), cronLast: await env.PRACTICE.get('cronLast', 'json').catch(() => null) },
        })
      } catch (e) {
        console.error('Atlas status error:', e)
        return json({ error: String(e) }, 500)
      }
    }

    return json({ error: 'Not found' }, 404)
  }
}
