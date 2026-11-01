import assert from 'node:assert/strict'
import { ageDays, chipFit, chipsFromAssets, isBlocked, parseNews, pushRecent, sortNews } from '../src/lib/voltNews'

// attack tooling is blocked everywhere (name, description, asset names)
assert.equal(isBlocked('justcallmekoko/ESP32Marauder'), true)
assert.equal(isBlocked('x/y', 'WiFi deauther and evil portal'), true)
assert.equal(isBlocked('x/y', 'Handshake capture + crack'), true)
assert.equal(isBlocked('giusemc1988/stock-predict', 'Passive Wi-Fi/BLE scanner'), false)
assert.equal(isBlocked(null, undefined), false)

// chip guesses from asset names
assert.deepEqual(chipsFromAssets(['fw-esp32s3.bin', 'fw-esp32c3.bin']).sort(), ['ESP32-C3', 'ESP32-S3'])
assert.deepEqual(chipsFromAssets(['nexus-scout-esp32.bin']), ['ESP32'])
assert.deepEqual(chipsFromAssets(['firmware.bin']), [])
assert.equal(chipFit({ chips: ['ESP32-S3'] }, 'ESP32-S3'), 'fits')
assert.equal(chipFit({ chips: ['ESP32-C3'] }, 'ESP32-S3'), 'other')
assert.equal(chipFit({ chips: [] }, 'ESP32-S3'), 'unknown')
assert.equal(chipFit({ chips: ['ESP32-S3'] }, null), 'unknown')

// parseNews drops malformed and blocked entries, keeps good ones
const feed = parseNews({
  updated: '2026-11-01T00:00:00Z',
  items: [
    { repo: 'a/good', desc: 'ok', stars: 5, tag: 'v1', published: '2026-10-30T00:00:00Z', chips: ['ESP32-S3'], hasManifest: true, assets: ['a.bin'] },
    { repo: 'bad/ESP32Marauder', tag: 'v1', assets: ['m.bin'] },
    { repo: 'no tag', tag: 'v1' },
    { repo: 'c/notag' },
    null,
  ],
})
assert.equal(feed.items.length, 1)
assert.equal(feed.items[0].repo, 'a/good')
assert.deepEqual(parseNews('junk'), { updated: '', items: [] })
assert.deepEqual(parseNews({ items: 5 }), { updated: '', items: [] })

// newest first, then stars
const sorted = sortNews([
  { ...feed.items[0], repo: 'a/old', published: '2026-09-01T00:00:00Z' },
  { ...feed.items[0], repo: 'a/new', published: '2026-10-30T00:00:00Z', stars: 1 },
  { ...feed.items[0], repo: 'a/newer-stars', published: '2026-10-30T00:00:00Z', stars: 9 },
])
assert.deepEqual(sorted.map((x) => x.repo), ['a/newer-stars', 'a/new', 'a/old'])

// recent list: newest first, de-duplicated, capped
let rec = pushRecent([], { repo: 'a/b', tag: 'v1', label: 'A', at: 1 })
rec = pushRecent(rec, { repo: 'c/d', tag: 'v2', label: 'C', at: 2 })
rec = pushRecent(rec, { repo: 'a/b', tag: 'v1', label: 'A', at: 3 })
assert.deepEqual(rec.map((r) => r.repo), ['a/b', 'c/d'])
assert.equal(pushRecent(Array.from({ length: 6 }, (_, i) => ({ repo: `r/${i}`, tag: 't', label: '', at: i })), { repo: 'n/n', tag: 't', label: '', at: 9 }).length, 6)

assert.equal(ageDays('2026-10-30T00:00:00Z', Date.parse('2026-11-01T12:00:00Z')), 2)
assert.equal(ageDays('nope'), null)
console.log('voltnews: ok')

// buildNews with a fake GitHub: keeps flashable repos, drops attack tools / no-bin releases, stops on rate limit
import { buildNews, type GhGet } from '../src/lib/voltNews'
const repos = [
  { full_name: 'ok/s3-fw', description: 'Nice firmware', stargazers_count: 7, topics: ['esp32'], archived: false, fork: false },
  { full_name: 'evil/ESP32Marauder', description: 'wifi tools', stargazers_count: 99, topics: [], archived: false, fork: false },
  { full_name: 'src/only', description: 'no bin', stargazers_count: 1, topics: [], archived: false, fork: false },
  { full_name: 'old/forked', description: '', stargazers_count: 1, topics: [], archived: false, fork: true },
]
const rel = (tag: string, assets: string[]) => ({ tag_name: tag, published_at: '2026-10-30T00:00:00Z', draft: false, prerelease: false, assets: assets.map((name) => ({ name, size: 1000 })) })
const calls: string[] = []
const fake: GhGet = async <T,>(path: string) => {
  calls.push(path)
  if (path.startsWith('/search')) return { status: 200, data: { items: repos } as unknown as T }
  if (path === '/repos/ok/s3-fw/releases/latest') return { status: 200, data: rel('v2', ['fw-esp32s3.bin', 'manifest.json']) as unknown as T }
  if (path === '/repos/src/only/releases/latest') return { status: 200, data: rel('v1', ['source.zip']) as unknown as T }
  return { status: 404, data: null }
}
const built = await buildNews(fake, { now: Date.parse('2026-11-01T00:00:00Z') })
assert.equal(built.limited, false)
assert.deepEqual(built.feed.items.map((i) => i.repo), ['ok/s3-fw'])
assert.deepEqual(built.feed.items[0].chips, ['ESP32-S3'])
assert.equal(built.feed.items[0].hasManifest, true)
assert.ok(!calls.some((c) => c.includes('Marauder')), 'blocked repo is never even looked up')
const limitedRun = await buildNews(async <T,>() => ({ status: 403, data: null as T | null }))
assert.equal(limitedRun.limited, true)
assert.equal(limitedRun.feed.items.length, 0)
console.log('buildNews ok')
