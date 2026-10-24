import assert from 'node:assert/strict'
import { fetchTrends, filterTrends, mergeTrends, parseEssayRss, parseGoogleTrends, parseHackerNews, parseKworb, parseProductHunt, parseReddit, topicOf, type TrendItem } from '../src/lib/studioTrends'

// shapes copied from the live feeds (2026-10-23), trimmed
const GT = `<rss xmlns:ht="https://trends.google.com/trending/rss"><channel><title>Daily Search Trends</title>
<item><title>al nassr</title><ht:approx_traffic>5000+</ht:approx_traffic><ht:news_item><ht:news_item_title>Link xem trực tiếp Al Faisaly vs Al Nassr</ht:news_item_title><ht:news_item_url>https://laodong.vn/x.ldo</ht:news_item_url></ht:news_item></item>
<item><title>thủy ngân</title><ht:approx_traffic>200+</ht:approx_traffic></item></channel></rss>`
const g = parseGoogleTrends(GT)
assert.deepEqual(g.map((x) => x.title), ['al nassr', 'thủy ngân'])
assert.equal(g[0].context, 'Link xem trực tiếp Al Faisaly vs Al Nassr')
assert.equal(g[0].traffic, '5000+ searches')
assert.ok(g[0].score > g[1].score, 'more searches rank higher')


const RD = `<feed><entry><category term="pics" label="r/pics"/><title>A cat that &quot;helps&quot; with homework</title><link href="https://www.reddit.com/r/pics/1"/></entry></feed>`
const rd = parseReddit(RD)
assert.equal(rd[0].title, 'A cat that "helps" with homework')
assert.equal(rd[0].context, 'r/pics')

const KW = `<tr><td class="text"><div><a href="https://youtu.be/abc" target="_blank">Tuyệt Phẩm Phố Đêm | Thanh Tú</a></div></td></tr>`
assert.deepEqual(parseKworb(KW).map((x) => [x.title, x.url]), [['Tuyệt Phẩm Phố Đêm | Thanh Tú', 'https://youtu.be/abc']])

// tech sources (2026-10-24 shapes, trimmed)
const hn = parseHackerNews({ hits: [{ title: 'Small', url: 'https://a.dev', points: 40 }, { title: 'Kimi K3.1 Pro', objectID: '42', points: 803 }, { points: 5 }] })
assert.deepEqual(hn.map((x) => [x.title, x.traffic, x.topic]), [['Kimi K3.1 Pro', '803 points', 'tech'], ['Small', '40 points', 'tech']])
assert.equal(hn[0].url, 'https://news.ycombinator.com/item?id=42', 'no link -> the HN discussion')
assert.deepEqual(parseHackerNews(null), [])
const PH = `<feed><entry><link rel="alternate" type="text/html" href="https://www.producthunt.com/products/fal-ai"/><title>FLUX 3 Max</title><content type="html">&lt;p&gt; fal’s FLUX 3 Max: 10-second AI video &lt;/p&gt; &lt;p&gt; &lt;a href="x"&gt;Discussion&lt;/a&gt; | &lt;a href="y"&gt;Link&lt;/a&gt; &lt;/p&gt;</content></entry></feed>`
assert.deepEqual(parseProductHunt(PH).map((x) => [x.title, x.context, x.url]), [['FLUX 3 Max', 'fal’s FLUX 3 Max: 10-second AI video', 'https://www.producthunt.com/products/fal-ai']])
const RT = `<feed><entry><author><name>/u/BernardJOrtcutt</name></author><title>Open Discussion Thread</title></entry><entry><author><name>/u/someone</name></author><category label="r/philosophy"/><title>Free will and the mind</title><link href="https://www.reddit.com/r/philosophy/1"/></entry></feed>`
const rp = parseReddit(RT, 'rphilo')
assert.deepEqual(rp.map((x) => [x.title, x.source, x.topic]), [['Free will and the mind', 'rphilo', 'philo']], 'the pinned bot thread is skipped')
// philosophy essays
const SEP = `<rss><channel><item><title>Kant’s Transcendental Arguments</title><link>https://plato.stanford.edu/entries/kant-transcendental/</link><description>[Revised entry by Derk Pereboom on October 22, 2026. Changes to: Main text] Among Immanuel Kant's most influential contributions</description></item></channel></rss>`
assert.equal(parseEssayRss(SEP, 'sep')[0].context, "Among Immanuel Kant's most influential contributions")
const AE = `<rss><channel><item><title><![CDATA[Traction!]]></title><link>https://aeon.co/essays/x</link><description><![CDATA[<p><img src="i.jpg"/></p><p>Tribologists study friction</p><p>Read on Aeon</p>]]></description></item></channel></rss>`
assert.deepEqual(parseEssayRss(AE, 'aeon').map((x) => [x.title, x.context, x.topic]), [['Traction!', 'Tribologists study friction', 'philo']])

// general trends go under tech or philosophy by keywords (accents removed, whole words only)
assert.equal(topicOf({ title: 'iPhone 18 ra mắt', source: 'google', score: 1 }), 'tech')
assert.equal(topicOf({ title: 'Triết học Khắc kỷ là gì', source: 'google', score: 1 }), 'philo')
assert.equal(topicOf({ title: 'Đà Nẵng', context: 'Đất nền bắt đầu hạ giá', source: 'google', score: 1 }), undefined)
assert.equal(topicOf({ title: 'Thailand trip', source: 'reddit', score: 1 }), undefined, '"ai" inside a word is not AI')
const mixed: TrendItem[] = [
  { title: 'Kimi K3.1', source: 'hn', score: 90, topic: 'tech' },
  { title: 'Free will', source: 'rphilo', score: 80, topic: 'philo' },
  { title: 'Samsung Galaxy mới', source: 'google', score: 70 },
  { title: 'Running Man', source: 'google', score: 60 },
]
assert.deepEqual(filterTrends(mixed, { topic: 'focus' }).map((x) => x.title), ['Kimi K3.1', 'Free will', 'Samsung Galaxy mới'])
assert.deepEqual(filterTrends(mixed, { topic: 'tech' }).map((x) => x.title), ['Kimi K3.1', 'Samsung Galaxy mới'])
assert.deepEqual(filterTrends(mixed, { topic: 'philo' }).map((x) => x.title), ['Free will'])
assert.equal(filterTrends(mixed, { topic: 'all' }).length, 4)

// the same topic from two sources is one item with a small boost
const a: TrendItem = { title: 'Giá vàng', source: 'google', score: 80 }
const m = mergeTrends([[a], [{ title: 'giá  VÀNG', source: 'reddit', score: 60 }], [{ title: 'Mèo', source: 'hn', score: 90 }]])
assert.deepEqual(m.map((x) => [x.title, x.score]), [['Mèo', 90], ['Giá vàng', 85]])
// sources take turns: a long news list does not push Google's topics down
const turns = mergeTrends([[1, 2, 3].map((i) => ({ title: `n${i}`, source: 'hn' as const, score: 99 - i })), [{ title: 'g1', source: 'google', score: 50 }]])
assert.deepEqual(turns.map((x) => x.title), ['n1', 'g1', 'n2', 'n3'])

// filters: sources, the sensitive list (EN + VI, no partial-word hits) and the user's own words
const items: TrendItem[] = [
  { title: 'Tai nạn giao thông ở Hà Nội', source: 'hn', score: 90 },
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
  if (url.includes('algolia')) return new Response(JSON.stringify({ hits: [{ title: 'Kimi', points: 9 }] }))
  if (url.includes('reddit.com/r/popular')) return new Response('blocked', { status: 403 })
  if (url.includes('r/philosophy')) return new Response(RT)
  if (url.includes('aeon')) return new Response(AE)
  if (url.includes('kworb')) return new Response(KW)
  return new Response('?', { status: 500 })
}) as unknown as typeof fetch
const r = await fetchTrends('VN', fake, 1000)
assert.equal(r.at, 1000)
assert.deepEqual(r.sources.map((s) => [s.id, s.ok, s.note ?? '']), [
  ['hn', true, ''], ['producthunt', false, 'HTTP 500'], ['rtech', false, 'HTTP 500'], ['rphilo', true, ''], ['aeon', true, ''], ['sep', false, 'HTTP 500'],
  ['google', true, ''], ['reddit', false, 'blocked (HTTP 403)'], ['ytmusic', true, ''],
])
assert.equal(r.items.length, 6)
console.log('novatrends ok')
