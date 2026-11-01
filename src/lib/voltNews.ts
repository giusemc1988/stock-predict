/**
 * Volt "what's new" feed: pure logic shared by the daily builder (scripts/volt-news.ts, run by
 * .github/workflows/volt-news.yml) and the Volt page. The builder asks GitHub's free search API for ESP32
 * firmware repos with a flashable release. It runs in the browser when Chanh taps "Làm mới" (no schedule,
 * no token spend) and the result is cached in localStorage. Network/attack tooling is filtered out here, in one place, so the feed never offers it
 * (project rule: scanning tools are for Chanh's own networks and devices only).
 */

export interface NewsItem {
  repo: string // owner/repo
  desc: string
  stars: number
  tag: string
  published: string // ISO date of the release
  chips: string[] // e.g. ['ESP32-S3'] guessed from asset names; empty = unknown
  hasManifest: boolean
  assets: string[]
}

export interface NewsFeed {
  updated: string
  items: NewsItem[]
}

/** Words that mark a repo as an attack/abuse tool. Matched against name, description, topics and asset names. */
const BLOCK = /deauth|marauder|evil[-_ ]?(twin|portal)|jammer|jamming|pwn|handshake|crack|brute|exploit|beacon[-_ ]?spam|wifi[-_ ]?(attack|hack)|packet[-_ ]?inject|flipper[-_ ]?zero[-_ ]?(attack)|rubber[-_ ]?ducky|skimmer|keylog|ransom|malware/i

export function isBlocked(...texts: (string | null | undefined)[]): boolean {
  return texts.some((t) => !!t && BLOCK.test(t))
}

const CHIP_PATTERNS: [string, RegExp][] = [
  ['ESP32-S3', /esp32[-_ ]?s3|\bs3\b/i],
  ['ESP32-S2', /esp32[-_ ]?s2|\bs2\b/i],
  ['ESP32-C3', /esp32[-_ ]?c3|\bc3\b/i],
  ['ESP32-C6', /esp32[-_ ]?c6|\bc6\b/i],
  ['ESP32-C2', /esp32[-_ ]?c2/i],
  ['ESP32-H2', /esp32[-_ ]?h2/i],
]

/** Which chips an asset name list mentions. A name with only "esp32" (no suffix) counts as the original ESP32. */
export function chipsFromAssets(names: string[]): string[] {
  const out = new Set<string>()
  for (const n of names) {
    let hit = false
    for (const [chip, re] of CHIP_PATTERNS) {
      if (re.test(n)) {
        out.add(chip)
        hit = true
      }
    }
    if (!hit && /esp32/i.test(n)) out.add('ESP32')
  }
  return [...out]
}

/** 'fits' when the connected chip is listed, 'unknown' when the feed could not tell, 'other' when it lists other chips only. */
export function chipFit(item: Pick<NewsItem, 'chips'>, chipName: string | null): 'fits' | 'unknown' | 'other' {
  if (!item.chips.length) return 'unknown'
  if (!chipName) return 'unknown'
  return item.chips.includes(chipName) ? 'fits' : 'other'
}

/** Validates the JSON the Worker returns; anything malformed or blocked is dropped rather than shown. */
export function parseNews(raw: unknown): NewsFeed {
  const empty: NewsFeed = { updated: '', items: [] }
  if (!raw || typeof raw !== 'object') return empty
  const o = raw as { updated?: unknown; items?: unknown }
  if (!Array.isArray(o.items)) return empty
  const items: NewsItem[] = []
  for (const x of o.items) {
    if (!x || typeof x !== 'object') continue
    const r = x as Record<string, unknown>
    if (typeof r.repo !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(r.repo) || typeof r.tag !== 'string' || !r.tag) continue
    const assets = Array.isArray(r.assets) ? r.assets.filter((a): a is string => typeof a === 'string') : []
    const desc = typeof r.desc === 'string' ? r.desc.slice(0, 200) : ''
    if (isBlocked(r.repo, desc, ...assets)) continue
    items.push({
      repo: r.repo,
      desc,
      stars: typeof r.stars === 'number' ? r.stars : 0,
      tag: r.tag,
      published: typeof r.published === 'string' ? r.published : '',
      chips: Array.isArray(r.chips) ? r.chips.filter((c): c is string => typeof c === 'string') : [],
      hasManifest: r.hasManifest === true,
      assets,
    })
  }
  return { updated: typeof o.updated === 'string' ? o.updated : '', items }
}

/** Newest first, then by stars. */
export function sortNews(items: NewsItem[]): NewsItem[] {
  return [...items].sort((a, b) => (b.published || '').localeCompare(a.published || '') || b.stars - a.stars)
}

export interface RecentFlash {
  repo: string
  tag: string
  label: string
  at: number
}

/** Adds/refreshes one entry, newest first, de-duplicated by repo+tag, capped at `max`. */
export function pushRecent(list: RecentFlash[], entry: RecentFlash, max = 6): RecentFlash[] {
  return [entry, ...list.filter((r) => !(r.repo === entry.repo && r.tag === entry.tag))].slice(0, max)
}

/** "3 ngày trước" / "3d ago" style age from an ISO date. */
export function ageDays(iso: string, now = Date.now()): number | null {
  const t = Date.parse(iso)
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / 86400000)) : null
}

interface GhRepo {
  full_name: string
  description: string | null
  stargazers_count: number
  topics?: string[]
  archived: boolean
  fork: boolean
}
interface GhRelease {
  tag_name: string
  published_at: string
  draft: boolean
  prerelease: boolean
  assets: { name: string; size: number }[]
}

export type GhGet = <T>(path: string) => Promise<{ status: number; data: T | null }>

const QUERIES = ['topic:esp32 topic:firmware', 'topic:esp32-s3 topic:firmware', 'topic:esp32-c3 topic:firmware', 'topic:esp32-c6 topic:firmware']

/**
 * Search -> latest release -> keep flashable, non-attack repos. `get` is injected (browser fetch to api.github.com).
 * Unauthenticated limits are 10 searches/min and 60 other calls/hour, so at most `maxRepos` release lookups run
 * and a 403/429 stops early with what was found so far (`limited` = true).
 */
export async function buildNews(get: GhGet, opts: { maxRepos?: number; now?: number } = {}): Promise<{ feed: NewsFeed; limited: boolean }> {
  const maxRepos = opts.maxRepos ?? 24
  const now = opts.now ?? Date.now()
  const since = new Date(now - 120 * 86400000).toISOString().slice(0, 10)
  const seen = new Set<string>()
  const candidates: GhRepo[] = []
  let limited = false
  for (const q of QUERIES) {
    const r = await get<{ items: GhRepo[] }>(`/search/repositories?q=${encodeURIComponent(`${q} pushed:>=${since} archived:false`)}&sort=updated&order=desc&per_page=20`)
    if (r.status === 403 || r.status === 429) {
      limited = true
      break
    }
    for (const c of r.data?.items ?? []) {
      if (seen.has(c.full_name) || c.archived || c.fork || isBlocked(c.full_name, c.description, ...(c.topics ?? []))) continue
      seen.add(c.full_name)
      candidates.push(c)
    }
  }
  const items: NewsItem[] = []
  for (const c of candidates.slice(0, maxRepos)) {
    const r = await get<GhRelease>(`/repos/${c.full_name}/releases/latest`)
    if (r.status === 403 || r.status === 429) {
      limited = true
      break
    }
    const rel = r.data
    if (!rel || rel.draft || rel.prerelease) continue
    const bins = (rel.assets ?? []).filter((a) => /\.(bin|json)$/i.test(a.name) && a.size < 16 * 1024 * 1024)
    if (!bins.some((a) => /\.bin$/i.test(a.name))) continue
    const names = bins.map((a) => a.name)
    if (isBlocked(...names)) continue
    items.push({
      repo: c.full_name,
      desc: (c.description ?? '').slice(0, 200),
      stars: c.stargazers_count,
      tag: rel.tag_name,
      published: rel.published_at,
      chips: chipsFromAssets(names),
      hasManifest: names.some((n) => /manifest.*\.json$/i.test(n)),
      assets: names,
    })
  }
  return { feed: { updated: new Date(now).toISOString(), items: sortNews(items).slice(0, 24) }, limited }
}
