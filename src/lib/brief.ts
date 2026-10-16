/**
 * Jarvis Brief: what each part of the home page shows, worked out only from the app's real data.
 * A part with no data says what is missing; nothing here makes up a number or a name.
 */
import type { MarketLists, MarketListRow } from '../data/providers'
import type { PickRow } from './practice'
import { pickSourceLabel } from './practicePicks'
import { marketState, type Bi } from './jarvis'

export type NodeId = 'scanner' | 'flow' | 'news' | 'signals' | 'learner' | 'risk'

export interface BriefNode {
  id: NodeId
  name: Bi
  note: Bi
  /** live: real data now; missing: needs a key or is still loading; off: switched off or not connected. */
  status: 'live' | 'missing' | 'off'
  /** 0..1, drawn as the ring around the node. */
  load: number
  /** Feeds data into Jarvis (left side) or carries results out (right side). */
  inbound: boolean
  /** Where the data came from, shown on hover. */
  source: string
}

export interface BriefInputs {
  now: number
  lists: { crypto: MarketLists | null; stocks: MarketLists | null; stocksNeedKey: boolean; updatedAt: number | null; cryptoError: string | null; stockError: string | null }
  flow: { symbol: string; buyShare: number | null; live: boolean; source: string }
  scan: { on: boolean; at: number | null; busy: boolean; candidates: PickRow[]; noStockData: boolean; server: boolean }
  learn: { cycles: number; lastCycle: number | null; lessonsToday: number; right: number; wrong: number }
  risk: { dayPL: number; lossLimit: number; lossLimitOn: boolean; killSwitch: boolean }
}

const clamp = (x: number) => Math.max(0, Math.min(1, x))
const pct = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(1)}%`
/** Clock time, with the date in front when it is not today, so an old scan never reads as fresh. */
export const hhmm = (ms: number, now = Date.now()) => {
  const d = new Date(ms)
  const t = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toDateString() === new Date(now).toDateString() ? t : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${t}`
}

export const buyCalls = (c: PickRow[]) => c.filter((x) => x.place != null).sort((a, b) => (a.place ?? 99) - (b.place ?? 99))

export function briefNodes(d: BriefInputs): BriefNode[] {
  const { lists, flow, scan, learn, risk } = d
  const names = new Set<string>()
  for (const l of [lists.stocks, lists.crypto]) if (l) for (const r of [...l.gainers, ...l.volume, ...l.losers]) names.add(r.symbol)
  const feeds = (lists.crypto ? 1 : 0) + (lists.stocks ? 1 : 0)
  const scanner: BriefNode = {
    id: 'scanner',
    name: { en: 'Scanner', vi: 'Máy quét' },
    inbound: true,
    source: 'Alpaca market screener (stocks) and Binance 24h tickers (crypto)',
    status: feeds ? 'live' : 'missing',
    load: feeds / 2,
    note: feeds
      ? { en: `${names.size} movers live${lists.stocksNeedKey ? ', crypto only' : ''}`, vi: `${names.size} mã biến động trực tiếp${lists.stocksNeedKey ? ', chỉ crypto' : ''}` }
      : lists.cryptoError || lists.stockError
        ? { en: 'market lists unavailable', vi: 'không tải được danh sách' }
        : { en: 'loading market lists', vi: 'đang tải danh sách' },
  }
  const flowNode: BriefNode = {
    id: 'flow',
    name: { en: 'Order flow', vi: 'Dòng lệnh' },
    inbound: true,
    source: `${flow.source} trades on ${flow.symbol}`,
    status: flow.buyShare != null && flow.live ? 'live' : 'missing',
    load: flow.buyShare ?? 0,
    note:
      flow.buyShare != null && flow.live
        ? { en: `buyers ${Math.round(flow.buyShare * 100)}% on ${flow.symbol}`, vi: `bên mua ${Math.round(flow.buyShare * 100)}% ở ${flow.symbol}` }
        : { en: `no live trades on ${flow.symbol}`, vi: `chưa có lệnh trực tiếp ở ${flow.symbol}` },
  }
  const news: BriefNode = {
    id: 'news',
    name: { en: 'News', vi: 'Tin tức' },
    inbound: true,
    source: 'No news source is connected yet',
    status: 'off',
    load: 0,
    note: { en: 'not connected yet', vi: 'chưa kết nối' },
  }
  const buys = buyCalls(scan.candidates)
  const signals: BriefNode = {
    id: 'signals',
    name: { en: 'Signals', vi: 'Tín hiệu' },
    inbound: false,
    source: scan.server ? 'Server practice scan (Yahoo Finance bars, today’s movers)' : 'Practice scan in this browser (today’s movers and your watchlist)',
    status: !scan.on ? 'off' : scan.at ? 'live' : 'missing',
    load: clamp(buys.length / 5),
    note: !scan.on
      ? { en: 'practice scan is off', vi: 'quét luyện tập đang tắt' }
      : scan.at
        ? { en: `${buys.length} BUY ${buys.length === 1 ? 'call' : 'calls'} · ${hhmm(scan.at, d.now)}`, vi: `${buys.length} lệnh MUA · ${hhmm(scan.at, d.now)}` }
        : scan.busy
          ? { en: 'scanning the market', vi: 'đang quét thị trường' }
          : { en: 'waiting for the first scan', vi: 'đang chờ lần quét đầu' },
  }
  const graded = learn.right + learn.wrong
  const learner: BriefNode = {
    id: 'learner',
    name: { en: 'Learner', vi: 'Tự học' },
    inbound: false,
    source: 'Auto learning: graded old and new bars',
    status: learn.cycles ? 'live' : 'off',
    load: graded ? learn.right / graded : 0,
    note: !learn.cycles
      ? { en: 'not running yet', vi: 'chưa chạy' }
      : learn.lessonsToday
        ? { en: `${learn.lessonsToday} new ${learn.lessonsToday === 1 ? 'lesson' : 'lessons'} today`, vi: `${learn.lessonsToday} bài học mới hôm nay` }
        : { en: `${learn.right} of ${graded} calls right`, vi: `đúng ${learn.right}/${graded} lần` },
  }
  const used = risk.lossLimitOn && risk.lossLimit > 0 ? Math.max(0, -risk.dayPL) / risk.lossLimit : 0
  const riskNode: BriefNode = {
    id: 'risk',
    name: { en: 'Risk guard', vi: 'Bảo vệ rủi ro' },
    inbound: false,
    source: 'Your paper account and daily loss limit',
    status: 'live',
    load: clamp(used),
    note: risk.killSwitch
      ? { en: 'kill switch on: no buys', vi: 'đang bật dừng khẩn cấp' }
      : risk.lossLimitOn && risk.lossLimit > 0
        ? { en: `${Math.round(used * 100)}% of daily loss limit`, vi: `đã dùng ${Math.round(used * 100)}% giới hạn lỗ` }
        : { en: 'no daily loss limit set', vi: 'chưa đặt giới hạn lỗ ngày' },
  }
  return [scanner, flowNode, news, signals, learner, riskNode]
}

const top = (rows: MarketListRow[] | undefined, n: number, vol = false) =>
  (rows ?? []).slice(0, n).map((r) => (vol && r.dollarVolume ? `${r.symbol} ($${(r.dollarVolume / 1e6).toFixed(0)}M)` : `${r.symbol} ${pct(r.changePct)}`)).join(', ')

/** The facts the brief is written from, most useful first. The AI gets these and nothing else. */
export function briefFacts(d: BriefInputs): Bi[] {
  const out: Bi[] = [marketState(d.now)]
  const buys = buyCalls(d.scan.candidates)
  if (!d.scan.on) out.push({ en: 'The practice scan is off, so there are no new BUY calls.', vi: 'Quét luyện tập đang tắt nên chưa có lệnh MUA mới.' })
  else if (buys.length)
    out.push({
      en: `Latest scan at ${hhmm(d.scan.at ?? d.now, d.now)} ranked ${buys.length} BUY ${buys.length === 1 ? 'call' : 'calls'}: ${buys.slice(0, 3).map((b) => `${b.symbol} (from ${pickSourceLabel[b.source].en}${b.tradeScore != null ? `, Trade Score ${Math.round(b.tradeScore)}` : ''})`).join(', ')}.`,
      vi: `Lần quét lúc ${hhmm(d.scan.at ?? d.now, d.now)} xếp hạng ${buys.length} lệnh MUA: ${buys.slice(0, 3).map((b) => `${b.symbol} (từ ${pickSourceLabel[b.source].vi}${b.tradeScore != null ? `, Điểm GD ${Math.round(b.tradeScore)}` : ''})`).join(', ')}.`,
    })
  else if (d.scan.at) out.push({ en: `Latest scan at ${hhmm(d.scan.at, d.now)} found no BUY calls that pass the rules.`, vi: `Lần quét lúc ${hhmm(d.scan.at, d.now)} không có lệnh MUA nào đạt quy tắc.` })
  else out.push({ en: 'The first market scan has not finished yet.', vi: 'Lần quét thị trường đầu tiên chưa xong.' })
  if (d.lists.stocks) out.push({ en: `Top US stock gainers now: ${top(d.lists.stocks.gainers, 3)}. Most traded: ${top(d.lists.stocks.volume, 3, true)}.`, vi: `Cổ phiếu Mỹ tăng mạnh nhất: ${top(d.lists.stocks.gainers, 3)}. Giao dịch nhiều nhất: ${top(d.lists.stocks.volume, 3, true)}.` })
  else if (d.lists.stocksNeedKey) out.push({ en: 'No live US stock list: an Alpaca paper key is needed (Portfolio page).', vi: 'Chưa có danh sách cổ phiếu Mỹ trực tiếp: cần key Alpaca paper (trang Danh mục).' })
  if (d.lists.crypto) out.push({ en: `Top crypto gainers over 24h: ${top(d.lists.crypto.gainers, 3)}. Most traded: ${top(d.lists.crypto.volume, 3, true)}.`, vi: `Crypto tăng mạnh nhất 24 giờ: ${top(d.lists.crypto.gainers, 3)}. Giao dịch nhiều nhất: ${top(d.lists.crypto.volume, 3, true)}.` })
  const nodes = briefNodes(d)
  for (const id of ['flow', 'learner', 'risk'] as NodeId[]) {
    const n = nodes.find((x) => x.id === id)!
    if (n.status === 'live') out.push({ en: `${n.name.en}: ${n.note.en}.`, vi: `${n.name.vi}: ${n.note.vi}.` })
  }
  return out
}

/** The brief without AI: the first facts, in the reader's language. */
export const plainBrief = (facts: Bi[], lang: 'en' | 'vi') => facts.slice(0, 4).map((f) => (lang === 'vi' ? f.vi : f.en)).join(' ')

/** Changes only when new data lands (a scan, a new list leader, a learner cycle), so the AI is asked once per change. */
export function briefKey(d: BriefInputs, lang: 'en' | 'vi') {
  return [lang, d.scan.at ?? 0, buyCalls(d.scan.candidates).slice(0, 3).map((b) => b.symbol).join('+'), d.lists.stocks?.gainers[0]?.symbol ?? '', d.lists.crypto?.gainers[0]?.symbol ?? '', d.learn.cycles, d.risk.killSwitch].join('|')
}
