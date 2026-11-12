/**
 * /api/hub/run and /api/hub/runs: Neo starts a whitelisted workflow (see src/lib/hubRuns.ts) with the
 * GitHub key saved in Nova, and reads how each one's newest run went. /api/hub/task and /tasks: a code
 * change Chanh asked for becomes an agent-task issue (src/lib/hubTasks.ts), and the list reads back.
 * /api/team and /api/team/act: the "Văn phòng" board (src/lib/team.ts) reads team.json on handoff-log
 * and sends one checked action to the team-update workflow.
 */
import { sameOrigin, type KeyStore } from '../lib/brainKeys'
import { latestRuns, startRun } from '../lib/hubRuns'
import { fileTask, listTasks } from '../lib/hubTasks'
import { readTeam, sendAction } from '../lib/team'
import { GITHUB_KEY } from '../lib/studioJobs'

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

export async function hubRoute(req: Request, pathname: string, settings?: KeyStore): Promise<Response | null> {
  if (!['/api/hub/run', '/api/hub/runs', '/api/hub/task', '/api/hub/tasks', '/api/team', '/api/team/act'].includes(pathname)) return null
  const token = settings ? await settings.get(GITHUB_KEY) : null
  if (pathname === '/api/team') {
    if (req.method !== 'GET') return json({ error: 'GET only' }, 405)
    const data = await readTeam(token)
    return data ? json({ ...data, key: !!token }) : json({ error: 'unread', key: !!token }, 502)
  }
  if (pathname === '/api/team/act') {
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
    if (!sameOrigin(req)) return json({ error: 'Not allowed' }, 403)
    const result = await sendAction(await req.json().catch(() => null), token)
    return json({ result }, result === 'ok' ? 200 : result === 'bad' ? 400 : result === 'nokey' ? 409 : 502)
  }
  if (pathname === '/api/hub/tasks') {
    if (req.method !== 'GET') return json({ error: 'GET only' }, 405)
    return json({ tasks: await listTasks(token) })
  }
  if (pathname === '/api/hub/task') {
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
    if (!sameOrigin(req)) return json({ error: 'Not allowed' }, 403)
    const b = (await req.json().catch(() => null)) as { text?: unknown; where?: unknown } | null
    const result = await fileTask(b?.text, b?.where, token)
    return json({ result }, result === 'ok' ? 200 : result === 'empty' ? 400 : result === 'nokey' ? 409 : 502)
  }
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
