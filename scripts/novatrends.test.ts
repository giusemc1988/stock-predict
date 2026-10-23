import assert from 'node:assert/strict'
import { fetchTrends, filterTrends, mergeTrends, parseGoogleNews, parseGoogleTrends, parseKworb, parseReddit, parseYouTube, type TrendItem } from '../src/lib/studioTrends'

// shapes copied from the live feeds (2026-10-23), trimmed
const GT = `<rss xmlns:ht="https://trends.google.com/trending/rss"><channel><title>Daily Search Trends</title>
<item><title>al nassr</title><ht:approx_traffic>5000+</ht:approx_traffic><ht:news_item><ht:news_item_title>Link xem trực tiếp Al Faisaly vs Al Nassr</ht:news_item_title><ht:news_item_url>https://laodong.vn/x.ldo</ht:news_item_url></ht:news_item></item>
<item><title>thủy ngân</title><ht:approx_traffic>200+</ht:approx_traffic></item></channel></rss>`
const g = parseGoogleTrends(GT)
assert.deepEqual(g.map((x) => x.title), ['al nassr', 'thủy ngân'])
assert.equal(g[0].context, 'Link xem trực tiếp Al Faisaly vs Al Nassr')
assert.equal(g[0].traffic, '5000+ searches')
assert.ok(g[0].score > g[1].score, 'more searches rank higher')

const GN = `<rss><channel><title>Tin nổi bật</title><item><title>Giá vàng hôm nay tăng mạnh - VnExpress</title><link>https://news.google.com/a</link></item><item><title>Fed &amp; lãi suất - Tuổi Trẻ</title></item></channel></rss>`
assert.deepEqual(parseGoogleNews(GN).map((x) => x.title), ['Giá vàng hôm nay tăng mạnh', 'Fed & lãi suất'])

const RD = `<feed><entry><category term="pics" label="r/pics"/><title>A cat that &quot;helps&quot; with homework</title><link href="https://www.reddit.com/r/pics/1"/></entry></feed>`
const rd = parseReddit(RD)
assert.equal(rd[0].title, 'A cat that "helps" with homework')
assert.equal(rd[0].context, 'r/pics')

const KW = `<tr><td class="text"><div><a href="https://youtu.be/abc" target="_blank">Tuyệt Phẩm Phố Đêm | Thanh Tú</a></div></td></tr>`
assert.deepEqual(parseKworb(KW).map((x) => [x.title, x.url]), [['Tuyệt Phẩm Phố Đêm | Thanh Tú', 'https://youtu.be/abc']])

const yt = parseYouTube({ items: [{ id: 'v1', snippet: { title: 'Big video', channelTitle: 'Chan' }, statistics: { viewCount: '2500000' } }] })
assert.equal(yt[0].traffic, '2.5M views')
assert.equal(yt[0].url, 'https://youtu.be/v1')
assert.deepEqual(parseYouTube(null), [])

// the same topic from two sources is one item with a small boost
const a: TrendItem = { title: 'Giá vàng', source: 'google', score: 80 }
const m = mergeTrends([[a], [{ title: 'giá  VÀNG', source: 'news', score: 60 }], [{ title: 'Mèo', source: 'reddit', score: 90 }]])
assert.deepEqual(m.map((x) => [x.title, x.score]), [['Mèo', 90], ['Giá vàng', 85]])
// sources take turns: a long news list does not push Google's topics down
const turns = mergeTrends([[1, 2, 3].map((i) => ({ title: `n${i}`, source: 'news' as const, score: 99 - i })), [{ title: 'g1', source: 'google', score: 50 }]])
assert.deepEqual(turns.map((x) => x.title), ['n1', 'g1', 'n2', 'n3'])

// filters: sources, the sensitive list (EN + VI, no partial-word hits) and the user's own words
const items: TrendItem[] = [
  { title: 'Tai nạn giao thông ở Hà Nội', source: 'news', score: 90 },
  { title: 'Screenshot tips', source: 'reddit', score: 80 },
  { title: 'Xổ số miền Bắc', source: 'google', score: 70 },
  { title: 'Ocean facts', source: 'google', score: 60 },
]
assert.deepEqual(filterTrends(items, { hideSensitive: true }).map((x) => x.title), ['Screenshot tips', 'Xổ số miền Bắc', 'Ocean facts'])
assert.deepEqual(filterTrends(items, { hideSensitive: true, blocked: ['xổ số', ' '] }).map((x) => x.title), ['Screenshot tips', 'Ocean facts'])
assert.deepEqual(filterTrends(items, { sources: ['google'] }).map((x) => x.title), ['Xổ số miền Bắc', 'Ocean facts'])

// fetching: every source at once, a failure or a missing key never stops the others
const fake = (async (url: string) => {
  if (url.includes('trends.google')) return new Response(GT)
  if (url.includes('news.google')) return new Response(GN)
  if (url.includes('reddit')) return new Response('blocked', { status: 403 })
  if (url.includes('kworb')) return new Response(KW)
  return new Response('?', { status: 500 })
}) as unknown as typeof fetch
const r = await fetchTrends('VN', null, fake, 1000)
assert.equal(r.at, 1000)
assert.deepEqual(r.sources.map((s) => [s.id, s.ok, s.note ?? '']), [['google', true, ''], ['news', true, ''], ['youtube', false, 'needs key'], ['ytmusic', true, ''], ['reddit', false, 'blocked (HTTP 403)']])
assert.equal(r.items.length, 5)
console.log('novatrends ok')
