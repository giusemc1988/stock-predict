/**
 * /api/hub/run and /api/hub/runs: Neo starts a whitelisted workflow (see src/lib/hubRuns.ts) with the
 * GitHub key saved in Nova, and reads how each one's newest run went.
 */
import { sameOrigin, type KeyStore } from '../lib/brainKeys'
import { latestRuns, startRun } from '../lib/hubRuns'
import { GITHUB_KEY } from '../lib/studioJobs'

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

export async function hubRoute(req: Request, pathname: string, settings?: KeyStore): Promise<Response | null> {
  if (pathname !== '/api/hub/run' && pathname !== '/api/hub/runs') return null
  const token = settings ? await settings.get(GITHUB_KEY) : null
  if (pathname === '/api/hub/runs') {
    if (req.method !== 'GET') return json({ error: 'GET only' }, 405)
    return json({ runs: await latestRuns(token), key: !!token })
  }
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  if (!sameOrigin(req)) return json({ error: 'Not allowed' }, 403)
  const id = ((await req.json().catch(() => null)) as { id?: unknown } | null)?.id
  const result = await startRun(typeof id === 'string' ? id : '', token)
  return json({ result }, result === 'ok' ? 200 : result === 'unknown' ? 400 : result === 'nokey' ? 409 : 502)
}
