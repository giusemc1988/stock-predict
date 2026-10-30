// Nova render queue on the runner side. Talks to the Worker's SETTINGS KV through the Cloudflare API
// (CLOUDFLARE_API_TOKEN, the same secret the deploy uses), so Chanh never has to create a GitHub token.
//   node nova/queue.mjs pick <workdir>          up to 3 queued jobs -> <workdir>/jobs/<id>.json (+ pexels.txt,
//                                               + the user's uploads in <workdir>/media/<id>/<n>.<ext>)
//   node nova/queue.mjs store <workdir> <id>    uploads <workdir>/out/<id>.mp4 in chunks, marks the job done or failed
// On Chanh's PC only (nova/lemo-bridge.mjs), for jobs with engine "lemo":
//   node nova/queue.mjs ping                    "the PC is on": Nova offers Lemo for the next few minutes
//   node nova/queue.mjs pick-lemo <workdir>     the oldest queued Lemo job -> <workdir>/jobs/<id>.json
// Key layout (shared with src/lib/studioJobs.ts): nova:job:<id>, nova:vid:<id>:<n>, nova:pexels
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const JOB = 'nova:job:'
const VID = 'nova:vid:'
const PEXELS = 'nova:pexels'
const LEMO_SEEN = 'nova:lemo:seen'
// the user's own photos and clips (src/lib/studioMedia.ts); the repo is public, so never log anything about them but a count
const MEDIA = 'nova:media:'
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' }
// KV values are capped at 25 MiB; 20 MiB chunks leave room
const CHUNK = 20 * 1024 * 1024
const KEEP_DONE = 12
const MAX_PICK = 3
// a job stuck in "rendering" this long was killed with its runner: try it once more
const STALE_MS = 50 * 60 * 1000
// ids reach the shell in the workflow, so only the Worker's own UUIDs are accepted
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

const token = process.env.CLOUDFLARE_API_TOKEN
if (!token) throw new Error('CLOUDFLARE_API_TOKEN is not set')
// NOVA_CF_API only points tests at a fake Cloudflare
const api = process.env.NOVA_CF_API ?? 'https://api.cloudflare.com/client/v4'
const auth = { authorization: `Bearer ${token}` }

/** The SETTINGS namespace id, read from wrangler.jsonc so it lives in one place. */
function namespaceId() {
  const text = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '')
  const ns = JSON.parse(text).kv_namespaces.find((n) => n.binding === 'SETTINGS')
  if (!ns) throw new Error('no SETTINGS namespace in wrangler.jsonc')
  return ns.id
}

async function cf(path, init = {}) {
  const r = await fetch(api + path, { ...init, headers: { ...auth, ...init.headers } })
  if (!r.ok && r.status !== 404) throw new Error(`Cloudflare ${init.method ?? 'GET'} ${path.split('?')[0]}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`)
  return r
}

let base = ''
async function kvBase() {
  if (base) return base
  let account = process.env.CLOUDFLARE_ACCOUNT_ID
  if (!account) {
    const j = await (await cf('/accounts?per_page=5')).json()
    account = j.result?.[0]?.id
  }
  if (!account) throw new Error('no Cloudflare account visible to this token')
  base = `/accounts/${account}/storage/kv/namespaces/${namespaceId()}`
  return base
}

const keyPath = async (key) => `${await kvBase()}/values/${encodeURIComponent(key)}`
async function get(key) {
  const r = await cf(await keyPath(key))
  return r.status === 404 ? null : r.text()
}
async function getBytes(key) {
  const r = await cf(await keyPath(key))
  return r.status === 404 ? null : Buffer.from(await r.arrayBuffer())
}
async function put(key, body) {
  await cf(await keyPath(key), { method: 'PUT', body, headers: { 'content-type': 'application/octet-stream' } })
}
async function del(key) {
  await cf(await keyPath(key), { method: 'DELETE' })
}
async function list(prefix) {
  const names = []
  let cursor = ''
  do {
    const j = await (await cf(`${await kvBase()}/keys?prefix=${encodeURIComponent(prefix)}&limit=1000${cursor ? `&cursor=${cursor}` : ''}`)).json()
    names.push(...(j.result ?? []).map((k) => k.name))
    cursor = j.result_info?.cursor ?? ''
  } while (cursor)
  return names
}
async function jobs() {
  const all = await Promise.all((await list(JOB)).map(async (k) => JSON.parse((await get(k)) ?? 'null')))
  return all.filter(Boolean)
}
/** Downloads a job's uploads in order; one that expired or never finished is skipped. Returns how many arrived. */
async function fetchMedia(dir, job) {
  const ids = (Array.isArray(job.media) ? job.media : []).filter((m) => UUID.test(m))
  if (!ids.length) return 0
  const out = `${dir}/media/${job.id}`
  mkdirSync(out, { recursive: true })
  let n = 0
  for (const id of ids) {
    const meta = JSON.parse((await get(MEDIA + id)) ?? 'null')
    const ext = EXT[meta?.type]
    if (!meta?.done || !ext) continue
    const parts = []
    for (let i = 0; i < meta.parts; i++) parts.push(await getBytes(`${MEDIA}${id}:${i}`))
    if (parts.some((p) => !p)) continue
    writeFileSync(`${out}/${String(n).padStart(2, '0')}.${ext}`, Buffer.concat(parts))
    n++
  }
  return n
}
const saveJob = (job) => put(JOB + job.id, JSON.stringify(job))
const output = (line) => process.env.GITHUB_OUTPUT && appendFileSync(process.env.GITHUB_OUTPUT, line + '\n')

async function pick(dir) {
  const now = Date.now()
  const runnable = (await jobs())
    .filter((j) => UUID.test(j.id))
    // Lemo jobs belong to the PC; GitHub never renders them
    .filter((j) => j.engine !== 'lemo')
    .filter((j) => j.status === 'queued' || (j.status === 'rendering' && now - (j.startedAt ?? 0) > STALE_MS && !j.retried))
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, MAX_PICK)
  mkdirSync(`${dir}/jobs`, { recursive: true })
  const run = process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : undefined
  for (const j of runnable) {
    const retried = j.status === 'rendering'
    await saveJob({ ...j, status: 'rendering', startedAt: now, run, retried: j.retried || retried })
    // only what the renderer needs; the key goes in its own file
    writeFileSync(`${dir}/jobs/${j.id}.json`, JSON.stringify({ id: j.id, topic: j.topic, lang: j.lang, voice: j.voice, aspect: j.aspect, lines: j.lines, terms: j.terms, opts: j.opts, engine: j.engine, viLines: j.viLines, smooth60: j.smooth60, textTop: j.textTop }))
    const own = await fetchMedia(dir, j)
    if (own) console.log(`job ${j.id}: ${own} uploaded file(s)`)
  }
  const key = runnable.length ? ((await get(PEXELS)) ?? '').trim() : ''
  if (key) {
    console.log(`::add-mask::${key}`)
    writeFileSync(`${dir}/pexels.txt`, key)
  }
  output(`ids=${runnable.map((j) => j.id).join(' ')}`)
  console.log(runnable.length ? `picked ${runnable.length} job(s), footage: ${key ? 'pexels' : 'openverse'}` : 'queue empty')
}

/** One queued Lemo job for the PC, or none. Prints its id so the bridge knows what to render. */
async function pickLemo(dir) {
  const job = (await jobs())
    .filter((j) => UUID.test(j.id) && j.engine === 'lemo' && j.status === 'queued')
    .sort((a, b) => a.createdAt - b.createdAt)[0]
  if (!job) return console.log('')
  await saveJob({ ...job, status: 'rendering', startedAt: Date.now(), run: undefined })
  mkdirSync(`${dir}/jobs`, { recursive: true })
  writeFileSync(`${dir}/jobs/${job.id}.json`, JSON.stringify({ id: job.id, topic: job.topic, lang: job.lang, voice: job.voice, aspect: job.aspect, lines: job.lines }))
  console.log(job.id)
}

async function store(dir, id) {
  if (!UUID.test(id ?? '')) throw new Error(`bad job id ${id}`)
  const job = JSON.parse((await get(JOB + id)) ?? 'null')
  if (!job) return console.log(`job ${id} was deleted meanwhile`)
  const resultFile = `${dir}/out/${id}.json`
  const result = existsSync(resultFile) ? JSON.parse(readFileSync(resultFile, 'utf8')) : { ok: false, error: 'renderer stopped without a result' }
  const mp4 = `${dir}/out/${id}.mp4`
  if (!result.ok || !existsSync(mp4)) {
    await saveJob({ ...job, status: 'failed', doneAt: Date.now(), error: result.error ?? 'no video' })
    return console.log(`job ${id} failed: ${result.error}`)
  }
  const data = readFileSync(mp4)
  const parts = Math.ceil(data.length / CHUNK)
  for (let i = 0; i < parts; i++) await put(`${VID}${id}:${i}`, data.subarray(i * CHUNK, (i + 1) * CHUNK))
  await saveJob({ ...job, status: 'done', doneAt: Date.now(), size: data.length, parts, chunk: CHUNK, duration: result.duration ?? null, footage: result.footage, error: undefined })
  console.log(`job ${id} done: ${(data.length / 1e6).toFixed(1)} MB in ${parts} part(s)`)
  await prune()
}

/** Keep the newest KEEP_DONE finished videos; older ones (and their chunks) are removed. */
async function prune() {
  const done = (await jobs()).filter((j) => j.status === 'done').sort((a, b) => b.doneAt - a.doneAt)
  for (const j of done.slice(KEEP_DONE)) {
    for (let i = 0; i < (j.parts ?? 0); i++) await del(`${VID}${j.id}:${i}`)
    await del(JOB + j.id)
    console.log(`pruned old video ${j.id}`)
  }
}

const [cmd, dir, id] = process.argv.slice(2)
if (cmd === 'pick') await pick(dir)
else if (cmd === 'store') await store(dir, id)
else if (cmd === 'ping') await put(LEMO_SEEN, String(Date.now()))
else if (cmd === 'pick-lemo') await pickLemo(dir)
else throw new Error('usage: queue.mjs pick <dir> | store <dir> <id> | ping | pick-lemo <dir>')
