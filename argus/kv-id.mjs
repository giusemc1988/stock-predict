// Prints the id of the "argus-snap" KV namespace, creating it the first time. Needs CLOUDFLARE_API_TOKEN.
// Used by both Argus workflows so nobody has to copy an id from the dashboard.
import { execFileSync } from 'node:child_process'

const TITLE = 'argus-snap'
const wrangler = (...args) => execFileSync('npx', ['-y', 'wrangler@4', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
const find = () => {
  const out = wrangler('kv', 'namespace', 'list')
  const list = JSON.parse(out.slice(out.indexOf('[')))
  return list.find((n) => n.title === TITLE || n.title.endsWith(`-${TITLE}`))?.id
}
let id = find()
if (!id) {
  wrangler('kv', 'namespace', 'create', TITLE)
  id = find()
}
if (!id) throw new Error(`could not find or create KV namespace ${TITLE}`)
console.log(id)
