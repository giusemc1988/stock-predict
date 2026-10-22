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
        })
      } catch (e) {
        console.error('Atlas status error:', e)
        return json({ error: String(e) }, 500)
      }
    }

    return json({ error: 'Not found' }, 404)
  }
}
