/**
 * Nova's trending ideas: free sources only, merged into one list. The Worker fetches them
 * (src/worker/nova.ts, /api/studio/trends) and caches the result; the parsers here are pure and
 * tested in scripts/novatrends.test.ts. Adding a source = one entry in TREND_SOURCES + one parser.
 */
export type TrendGeo = 'VN' | 'US'
export type TrendSourceId = 'google' | 'news' | 'youtube' | 'ytmusic' | 'reddit'

export interface TrendItem {
  title: string
  source: TrendSourceId
  /** 0-100, higher = hotter; comparable inside one source, roughly across sources */
  score: number
  /** a headline or line that says why it is trending */
  context?: string
  url?: string
  /** "5000+ searches", "1.2M views" */
  traffic?: string
}

export interface TrendSourceStatus {
  id: TrendSourceId
  ok: boolean
  count: number
  /** why it gave nothing: "needs key", "blocked", "HTTP 429" */
  note?: string
}

export interface TrendsResult {
  geo: TrendGeo
  at: number
  items: TrendItem[]
  sources: TrendSourceStatus[]
}

export const TREND_SOURCES: { id: TrendSourceId; name: string; needsKey?: boolean }[] = [
  { id: 'google', name: 'Google Trends' },
  { id: 'news', name: 'Google News' },
  { id: 'youtube', name: 'YouTube', needsKey: true },
  { id: 'ytmusic', name: 'YouTube Music' },
  { id: 'reddit', name: 'Reddit' },
]

/** Places with no free trending feed: the app links to them instead of faking a list. */
export const TREND_LINKS: { name: string; url: (geo: TrendGeo) => string }[] = [
  { name: 'TikTok Creative Center', url: (g) => `https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en?countryCode=${g}&period=7` },
  { name: 'YouTube Trending', url: (g) => `https://www.youtube.com/feed/trending?gl=${g}` },
  { name: 'Facebook', url: () => 'https://www.facebook.com/watch/' },
]

export const trendUrls = (geo: TrendGeo) => ({
  google: `https://trends.google.com/trending/rss?geo=${geo}`,
  news: geo === 'VN' ? 'https://news.google.com/rss?hl=vi&gl=VN&ceid=VN:vi' : 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en',
  youtube: (key: string) => `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&maxResults=20&regionCode=${geo}&key=${encodeURIComponent(key)}`,
  ytmusic: `https://kworb.net/youtube/trending/${geo.toLowerCase()}.html`,
  reddit: 'https://www.reddit.com/r/popular/.rss',
})

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
export function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&(\w+);/g, (m, n: string) => ENT[n] ?? m)
    .replace(/\s+/g, ' ')
    .trim()
}

const tag = (block: string, name: string) => {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(block)
  return m ? decodeXml(m[1]) : ''
}
const blocks = (xml: string, name: string) => xml.match(new RegExp(`<${name}[\\s>][\\s\\S]*?</${name}>`, 'g')) ?? []
/** rank -> score: the first item 100, falling to about 40 at the 20th */
const rankScore = (i: number) => Math.round(100 - Math.min(i, 30) * 3)

/** Google Trends daily RSS: search term, traffic and the first news headline about it. */
export function parseGoogleTrends(xml: string): TrendItem[] {
  return blocks(xml, 'item').map((b, i) => {
    const traffic = tag(b, 'ht:approx_traffic')
    const n = Number(traffic.replace(/[^\d]/g, '')) || 0
    return {
      title: tag(b, 'title'),
      source: 'google' as const,
      // traffic decides first (5000+ beats 200+), rank breaks ties
      score: Math.min(100, Math.round(55 + Math.log10(Math.max(n, 1)) * 10 - i * 0.5)),
      context: tag(b, 'ht:news_item_title') || undefined,
      url: tag(b, 'ht:news_item_url') || undefined,
      traffic: traffic ? `${traffic} searches` : undefined,
    }
  }).filter((x) => x.title)
}

/** Google News top stories RSS: "Headline - Publisher" -> "Headline". */
export function parseGoogleNews(xml: string): TrendItem[] {
  return blocks(xml, 'item').map((b, i) => ({
    title: tag(b, 'title').replace(/\s+[-–]\s+[^-–]+$/, ''),
    source: 'news' as const,
    score: rankScore(i) - 10,
    url: tag(b, 'link') || undefined,
  })).filter((x) => x.title)
}

/** Reddit r/popular Atom feed. */
export function parseReddit(xml: string): TrendItem[] {
  return blocks(xml, 'entry').map((b, i) => {
    const sub = /<category[^>]*label="([^"]+)"/.exec(b)?.[1]
    const href = /<link[^>]*href="([^"]+)"/.exec(b)?.[1]
    return { title: tag(b, 'title'), source: 'reddit' as const, score: rankScore(i) - 15, context: sub ? decodeXml(sub) : undefined, url: href ? decodeXml(href) : undefined }
  }).filter((x) => x.title)
}

/** kworb.net YouTube trending (music videos) table. */
export function parseKworb(html: string): TrendItem[] {
  const out: TrendItem[] = []
  for (const m of html.matchAll(/<td class="text"><div><a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)) {
    out.push({ title: decodeXml(m[2]), source: 'ytmusic', score: rankScore(out.length) - 15, url: m[1] })
    if (out.length >= 20) break
  }
  return out
}

/** YouTube Data API v3 "mostPopular" videos. */
export function parseYouTube(json: unknown): TrendItem[] {
  const items = (json as { items?: { id?: string; snippet?: { title?: string; channelTitle?: string }; statistics?: { viewCount?: string } }[] } | null)?.items ?? []
  return items.map((v, i) => {
    const views = Number(v.statistics?.viewCount ?? 0)
    return {
      title: v.snippet?.title ?? '',
      source: 'youtube' as const,
      score: rankScore(i),
      context: v.snippet?.channelTitle,
      url: v.id ? `https://youtu.be/${v.id}` : undefined,
      traffic: views ? `${views >= 1e6 ? `${(views / 1e6).toFixed(1)}M` : `${Math.round(views / 1e3)}K`} views` : undefined,
    }
  }).filter((x) => x.title)
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * All sources in one list. The same topic from two sources counts once (with a small boost), and the
 * sources take turns (best of each first), so one busy feed never hides the others.
 */
export function mergeTrends(lists: TrendItem[][], perSource = 20): TrendItem[] {
  const seen = new Map<string, TrendItem>()
  for (const list of lists) {
    for (const it of list.slice(0, perSource)) {
      const k = norm(it.title)
      if (!k) continue
      const had = seen.get(k)
      if (had) had.score = Math.min(100, Math.max(had.score, it.score) + 5)
      else seen.set(k, { ...it })
    }
  }
  const bySource = new Map<TrendSourceId, TrendItem[]>()
  for (const it of seen.values()) bySource.set(it.source, [...(bySource.get(it.source) ?? []), it])
  const queues = [...bySource.values()].map((q) => q.sort((a, b) => b.score - a.score))
  const out: TrendItem[] = []
  while (queues.some((q) => q.length)) {
    const round = queues.filter((q) => q.length).map((q) => q.shift()!).sort((a, b) => b.score - a.score)
    out.push(...round)
  }
  return out
}

/** Words that make a topic a poor fit for a light faceless explainer (death, crime, disasters), EN + VI. */
export const SENSITIVE = [
  'chet', 'tu vong', 'thiet mang', 'giet', 'sat hai', 'an mang', 'tai nan', 'bat giu', 'khoi to', 'tam giam', 'xet xu', 'cuop', 'hiep dam', 'tu tu', 'dong dat', 'lu lut', 'chay no', 'xung dot', 'chien tranh', 'khung bo',
  'dead', 'death', 'dies', 'died', 'killed', 'kill', 'murder', 'shooting', 'shot', 'arrest', 'charged', 'trial', 'crash', 'rape', 'suicide', 'war', 'attack', 'earthquake', 'flood',
]

export interface TrendFilter {
  sources?: TrendSourceId[]
  hideSensitive?: boolean
  /** the user's own words to hide, any language */
  blocked?: string[]
}

export function filterTrends(items: TrendItem[], f: TrendFilter): TrendItem[] {
  const block = [...(f.hideSensitive ? SENSITIVE : []), ...(f.blocked ?? []).map(norm).filter(Boolean)]
  return items.filter((it) => {
    if (f.sources && !f.sources.includes(it.source)) return false
    const text = ` ${norm(`${it.title} ${it.context ?? ''}`)} `
    return !block.some((w) => text.includes(` ${w} `))
  })
}

export const YOUTUBE_KEY = 'nova:youtube'
export const TRENDS_CACHE = (geo: TrendGeo) => `nova:trends:${geo}`
export const TRENDS_TTL_MS = 60 * 60 * 1000
// a plain browser UA: Reddit refuses unknown bots
const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36'

/** Fetch every source at once; one failing never stops the others. */
export async function fetchTrends(geo: TrendGeo, youtubeKey: string | null, f: typeof fetch = fetch, now = Date.now()): Promise<TrendsResult> {
  const u = trendUrls(geo)
  const get = async (url: string) => {
    const r = await f(url, { headers: { 'user-agent': UA, accept: '*/*' }, signal: AbortSignal.timeout(9000) })
    if (!r.ok) throw new Error(r.status === 403 || r.status === 429 ? `blocked (HTTP ${r.status})` : `HTTP ${r.status}`)
    return r.text()
  }
  const jobs: { id: TrendSourceId; run: () => Promise<TrendItem[]> }[] = [
    { id: 'google', run: async () => parseGoogleTrends(await get(u.google)) },
    { id: 'news', run: async () => parseGoogleNews(await get(u.news)) },
    { id: 'youtube', run: async () => (youtubeKey ? parseYouTube(JSON.parse(await get(u.youtube(youtubeKey)))) : Promise.reject(new Error('needs key'))) },
    { id: 'ytmusic', run: async () => parseKworb(await get(u.ytmusic)) },
    { id: 'reddit', run: async () => parseReddit(await get(u.reddit)) },
  ]
  const done = await Promise.allSettled(jobs.map((j) => j.run()))
  const sources: TrendSourceStatus[] = done.map((d, i) =>
    d.status === 'fulfilled' ? { id: jobs[i].id, ok: d.value.length > 0, count: d.value.length, note: d.value.length ? undefined : 'empty' } : { id: jobs[i].id, ok: false, count: 0, note: String((d.reason as Error)?.message ?? d.reason).slice(0, 80) },
  )
  const items = mergeTrends(done.map((d) => (d.status === 'fulfilled' ? d.value : [])))
  return { geo, at: now, items, sources }
}
