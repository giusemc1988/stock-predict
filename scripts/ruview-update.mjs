/**
 * Daily RuView update check (run by .github/workflows/ruview-update.yml, or by hand: node scripts/ruview-update.mjs).
 * Looks at the Docker Hub tags RuView's own CI publishes for each release (vX.Y.Z-esp32 = server image + matching
 * firmware), and when one is newer than ruview.versions.json it rewrites that file. The workflow then opens a PR;
 * nothing changes on the home PC until Chanh merges it and re-runs "npm run ruview".
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const RELEASE = /^v(\d+)\.(\d+)\.(\d+)-esp32$/

/** The newest vX.Y.Z-esp32 tag in the list, or null. */
export function latestRelease(tags) {
  const key = (t) => RELEASE.exec(t).slice(1).map(Number)
  return tags.filter((t) => RELEASE.test(t)).sort((a, b) => {
    const [x, y] = [key(a), key(b)]
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
  }).at(-1) ?? null
}

/** The pinned file moved to a newer release, or null when the pin is already current. */
export function bump(pinned, tags, today) {
  const top = latestRelease(tags)
  if (!top || latestRelease([top, pinned.release]) === pinned.release) return null
  return { ...pinned, release: top, firmware: top.slice(1).replace('-esp32', ''), checked: today }
}

async function main() {
  const file = new URL('../ruview.versions.json', import.meta.url)
  const pinned = JSON.parse(readFileSync(file, 'utf8'))
  const r = await fetch(`https://hub.docker.com/v2/repositories/${pinned.image}/tags?page_size=100&ordering=last_updated`)
  if (!r.ok) throw new Error(`Docker Hub ${r.status}`)
  const tags = (await r.json()).results.map((t) => t.name)
  const next = bump(pinned, tags, new Date().toISOString().slice(0, 10))
  if (!next) return console.log(`RuView ${pinned.release} is the newest release.`)
  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`)
  console.log(`RuView ${pinned.release} -> ${next.release}`)
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `release=${next.release}\nold=${pinned.release}\n`)
}

// run only as a script, not when a test imports it (a bundled test shares this file's URL)
if (process.argv[1]?.endsWith('ruview-update.mjs') && process.argv[1] === fileURLToPath(import.meta.url)) await main()
