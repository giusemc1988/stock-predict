/**
 * Nova's trending ideas: free sources only, merged into one list. The Worker fetches them
 * (src/worker/nova.ts, /api/studio/trends) and caches the result; the parsers here are pure and
 * tested in scripts/novatrends.test.ts. Adding a source = one entry in TREND_SOURCES + one parser.
 */
export type TrendGeo = 'VN' | 'US'
export type TrendSourceId = 'google' | 'ytmusic' | 'reddit' | 'hn' | 'producthunt' | 'rtech' | 'rphilo' | 'aeon' | 'sep'
/** what a topic is about; general sources ('all') are sorted into tech/philo by keywords */
export type TrendTopic = 'tech' | 'philo'
/** the Idea step's topic switch: Viraltech's two themes together, one of them, or everything */
export type TopicView = 'focus' | TrendTopic | 'all'

export interface TrendItem {
  title: string
  source: TrendSourceId
  /** 0-100, higher = hotter; comparable inside one source, roughly across sources */
  score: number
  /** a headline or line that says why it is trending */
  context?: string
  url?: string
  /** "5000+ searches", "320 points" */
  traffic?: string
  /** set by the source (Hacker News = tech) or by keywords (see topicOf) */
  topic?: TrendTopic
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

/**
 * All free with no key. Google News and the YouTube API were dropped on 2026-10-24: Google News
 * never answered the Worker ("no answer" in the app), and YouTube needed a key.
 */
export const TREND_SOURCES: { id: TrendSourceId; name: string; topic?: TrendTopic }[] = [
  { id: 'hn', name: 'Hacker News', topic: 'tech' },
  { id: 'producthunt', name: 'Product Hunt', topic: 'tech' },
  { id: 'rtech', name: 'r/technology', topic: 'tech' },
  { id: 'rphilo', name: 'r/philosophy', topic: 'philo' },
  { id: 'aeon', name: 'Aeon', topic: 'philo' },
  { id: 'sep', name: 'Stanford Philosophy', topic: 'philo' },
  { id: 'google', name: 'Google Trends' },
  { id: 'reddit', name: 'Reddit' },
  { id: 'ytmusic', name: 'YouTube Music' },
]

/** Places with no free trending feed: the app links to them instead of faking a list. */
export const TREND_LINKS: { name: string; url: (geo: TrendGeo) => string }[] = [
  { name: 'TikTok Creative Center', url: (g) => `https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en?countryCode=${g}&period=7` },
  { name: 'YouTube Trending', url: (g) => `https://www.youtube.com/feed/trending?gl=${g}` },
  { name: 'Facebook', url: () => 'https://www.facebook.com/watch/' },
]

export const trendUrls = (geo: TrendGeo) => ({
  google: `https://trends.google.com/trending/rss?geo=${geo}`,
  ytmusic: `https://kworb.net/youtube/trending/${geo.toLowerCase()}.html`,
  reddit: 'https://www.reddit.com/r/popular/.rss',
  // tech and philosophy are worldwide: the same feeds for VN and US
  hn: 'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30',
  producthunt: 'https://www.producthunt.com/feed',
  rtech: 'https://www.reddit.com/r/technology/.rss',
  rphilo: 'https://www.reddit.com/r/philosophy/.rss',
  aeon: 'https://aeon.co/feed.rss',
  sep: 'https://plato.stanford.edu/rss/sep.xml',
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

/** A Reddit Atom feed (r/popular, r/technology, r/philosophy); pinned mod posts are skipped. */
export function parseReddit(xml: string, source: 'reddit' | 'rtech' | 'rphilo' = 'reddit'): TrendItem[] {
  const topic: TrendTopic | undefined = source === 'rtech' ? 'tech' : source === 'rphilo' ? 'philo' : undefined
  return blocks(xml, 'entry').map((b) => {
    const sub = /<category[^>]*label="([^"]+)"/.exec(b)?.[1]
    const href = /<link[^>]*href="([^"]+)"/.exec(b)?.[1]
    const author = tag(b, 'name')
    return { title: tag(b, 'title'), source, context: sub ? decodeXml(sub) : undefined, url: href ? decodeXml(href) : undefined, topic, mod: /automoderator|bernardjortcutt/i.test(author) }
  }).filter((x) => x.title && !x.mod).map(({ mod: _m, ...x }, i) => ({ ...x, score: rankScore(i) - 15 }))
}

/** Hacker News front page (Algolia API): points decide the order. */
export function parseHackerNews(json: unknown): TrendItem[] {
  const hits = (json as { hits?: { title?: string; url?: string; objectID?: string; points?: number; num_comments?: number }[] } | null)?.hits ?? []
  return hits.filter((h) => h.title).sort((a, b) => (b.points ?? 0) - (a.points ?? 0)).map((h, i) => ({
    title: h.title!,
    source: 'hn' as const,
    score: rankScore(i) - 5,
    url: h.url || (h.objectID ? `https://news.ycombinator.com/item?id=${h.objectID}` : undefined),
    traffic: h.points ? `${h.points} points` : undefined,
    topic: 'tech' as const,
  }))
}

const stripHtml = (s: string) => decodeXml(s.replace(/<[^>]+>/g, ' '))

/** Product Hunt Atom feed: today's new products, with their one-line pitch. */
export function parseProductHunt(xml: string): TrendItem[] {
  return blocks(xml, 'entry').map((b, i) => {
    const href = /<link[^>]*href="([^"]+)"/.exec(b)?.[1]
    const pitch = stripHtml(tag(b, 'content')).replace(/\s*Discussion\s*\|\s*Link\s*$/, '').trim()
    return { title: tag(b, 'title'), source: 'producthunt' as const, score: rankScore(i) - 10, context: pitch || undefined, url: href ? decodeXml(href) : undefined, topic: 'tech' as const }
  }).filter((x) => x.title)
}

/** An RSS 2.0 feed of essays or entries (Aeon, Stanford Encyclopedia of Philosophy). */
export function parseEssayRss(xml: string, source: 'aeon' | 'sep'): TrendItem[] {
  return blocks(xml, 'item').map((b, i) => {
    // SEP starts with "[Revised entry by ...]", Aeon ends with "Read on Aeon"
    const about = stripHtml(tag(b, 'description')).replace(/^\[[^\]]*\]\s*/, '').replace(/\s*(Read|Watch|Listen) on Aeon$/, '').slice(0, 160)
    return { title: tag(b, 'title'), source, score: rankScore(i) - (source === 'sep' ? 25 : 15), context: about || undefined, url: tag(b, 'link') || undefined, topic: 'philo' as const }
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

/** Keywords (accents removed, EN + VI) that put a general trend under tech or philosophy. */
export const TOPIC_WORDS: Record<TrendTopic, string[]> = {
  tech: [
    'ai', 'tri tue nhan tao', 'chatgpt', 'openai', 'gemini', 'claude', 'llm', 'robot', 'robotics', 'chip', 'chips', 'nvidia', 'apple', 'iphone', 'ipad', 'macbook', 'samsung', 'galaxy', 'android', 'google', 'microsoft', 'windows', 'meta', 'tesla', 'spacex', 'starlink', 'xiaomi', 'huawei',
    'app', 'ung dung', 'phan mem', 'software', 'cong nghe', 'tech', 'technology', 'gadget', 'smartphone', 'dien thoai', 'laptop', 'vr', 'quantum', 'luong tu', 'blockchain', 'bitcoin', 'crypto', 'startup', 'drone', 'ev', 'xe dien', 'battery', 'semiconductor', 'ban dan', '5g', '6g', 'cyber', 'hacker', 'bao mat', 'open source', 'github', 'linux', 'gpu', 'cpu',
  ],
  philo: [
    'philosophy', 'philosopher', 'triet hoc', 'triet ly', 'triet gia', 'stoic', 'stoicism', 'khac ky', 'existential', 'existentialism', 'hien sinh', 'nietzsche', 'socrates', 'plato', 'aristotle', 'kant', 'camus', 'sartre', 'marcus aurelius', 'seneca', 'epictetus', 'confucius', 'khong tu', 'lao tu', 'phat giao', 'buddhism', 'zen',
    'meaning of life', 'y nghia cuoc song', 'ethics', 'dao duc', 'free will', 'consciousness', 'y thuc', 'mindfulness', 'chanh niem', 'wisdom', 'happiness', 'hanh phuc', 'morality', 'virtue', 'metaphysics', 'logic',
  ],
}

/** The source's own topic, else the first keyword hit, else none (a general trend). */
export function topicOf(it: TrendItem): TrendTopic | undefined {
  if (it.topic) return it.topic
  const text = ` ${norm(`${it.title} ${it.context ?? ''}`)} `
  return (['philo', 'tech'] as TrendTopic[]).find((tp) => TOPIC_WORDS[tp].some((w) => text.includes(` ${w} `)))
}

export interface TrendFilter {
  /** 'focus' = tech + philosophy (Viraltech's themes), 'all' = no topic filter */
  topic?: TopicView
  sources?: TrendSourceId[]
  hideSensitive?: boolean
  /** the user's own words to hide, any language */
  blocked?: string[]
}

export function filterTrends(items: TrendItem[], f: TrendFilter): TrendItem[] {
  const block = [...(f.hideSensitive ? SENSITIVE : []), ...(f.blocked ?? []).map(norm).filter(Boolean)]
  return items.filter((it) => {
    if (f.sources && !f.sources.includes(it.source)) return false
    if (f.topic && f.topic !== 'all') {
      const tp = topicOf(it)
      if (!tp || (f.topic !== 'focus' && tp !== f.topic)) return false
    }
    const text = ` ${norm(`${it.title} ${it.context ?? ''}`)} `
    return !block.some((w) => text.includes(` ${w} `))
  })
}

// v2: the source list changed on 2026-10-24, so old cached lists are not reused
export const TRENDS_CACHE = (geo: TrendGeo) => `nova:trends2:${geo}`
export const TRENDS_TTL_MS = 60 * 60 * 1000
// a plain browser UA: Reddit refuses unknown bots
const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36'

/** Fetch every source at once; one failing never stops the others. */
export async function fetchTrends(geo: TrendGeo, f: typeof fetch = fetch, now = Date.now()): Promise<TrendsResult> {
  const u = trendUrls(geo)
  const get = async (url: string) => {
    const r = await f(url, { headers: { 'user-agent': UA, accept: '*/*' }, signal: AbortSignal.timeout(9000) })
    if (!r.ok) throw new Error(r.status === 403 || r.status === 429 ? `blocked (HTTP ${r.status})` : `HTTP ${r.status}`)
    return r.text()
  }
  const jobs: { id: TrendSourceId; run: () => Promise<TrendItem[]> }[] = [
    { id: 'hn', run: async () => parseHackerNews(JSON.parse(await get(u.hn))) },
    { id: 'producthunt', run: async () => parseProductHunt(await get(u.producthunt)) },
    { id: 'rtech', run: async () => parseReddit(await get(u.rtech), 'rtech') },
    { id: 'rphilo', run: async () => parseReddit(await get(u.rphilo), 'rphilo') },
    { id: 'aeon', run: async () => parseEssayRss(await get(u.aeon), 'aeon') },
    { id: 'sep', run: async () => parseEssayRss(await get(u.sep), 'sep') },
    { id: 'google', run: async () => parseGoogleTrends(await get(u.google)) },
    { id: 'reddit', run: async () => parseReddit(await get(u.reddit)) },
    { id: 'ytmusic', run: async () => parseKworb(await get(u.ytmusic)) },
  ]
  const done = await Promise.allSettled(jobs.map((j) => j.run()))
  const sources: TrendSourceStatus[] = done.map((d, i) =>
    d.status === 'fulfilled' ? { id: jobs[i].id, ok: d.value.length > 0, count: d.value.length, note: d.value.length ? undefined : 'empty' } : { id: jobs[i].id, ok: false, count: 0, note: String((d.reason as Error)?.message ?? d.reason).slice(0, 80) },
  )
  const items = mergeTrends(done.map((d) => (d.status === 'fulfilled' ? d.value : [])))
  return { geo, at: now, items, sources }
}
