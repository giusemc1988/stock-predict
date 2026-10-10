import type { BrokerOrder, BrokerPosition } from '../broker/types'
import type { AuditEntry } from './audit'
import { DATA_LABEL } from './dataGuard'
import { fmtPct, fmtPrice, fmtUsd } from './format'
import { dayKey, exitReasonLabel, kindOf, type PracticePosition, type PracticeState, type PracticeTrade } from './practice'
import { brokenRules } from './playbook'
import { BUCKET_LABEL, REVIEW_FAIL } from './review'

/** One line of a practice trade's story: Bought, Why, Exit plan, Result... */
export interface DetailLine {
  k: string
  v: string
  tone?: 'up' | 'down'
}

/** Open, closed, or a buy the rules stopped. */
export type PracticeStatus = 'open' | 'closed' | 'blocked'

/** A row from the practice account, shown in the bottom panel next to your paper account. */
export type PracticePositionRow = BrokerPosition & { id: string; tag: string; detail: DetailLine[] }
export type PracticeOrderRow = BrokerOrder & { tag: string; practiceStatus: PracticeStatus; detail: DetailLine[] }

/** Most blocked buys listed in History (today only; "slots used" notes are left out as noise). */
export const MAX_BLOCKED = 20

const tifOf = (p: { kind?: 'day' | 'long' }) => (kindOf(p) === 'long' ? ('gtc' as const) : ('day' as const))
const tagOf = (p: { kind?: 'day' | 'long' }) => (kindOf(p) === 'long' ? 'Practice · long' : 'Practice · day')
const when = (ms: number) => new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
const pctFrom = (from: number, to: number) => (from ? ((to - from) / from) * 100 : 0)
const held = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60_000))
  return m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.floor(m / 1440)} d ${Math.floor((m % 1440) / 60)} h`
}

const NOT_RECORDED = 'not recorded for this trade (it was made before this was saved)'

/** Why a trade was sold, in plain words. */
const WHY_SOLD: Record<PracticeTrade['exitReason'], string> = {
  target: 'the price reached the profit target set when it bought',
  stop: 'the price fell to the stop-loss set when it bought, so it cut the loss',
  signal: "the AI's call turned SELL, so it got out early",
  time: 'the price did not move for too long, so it freed the money for a better setup',
  close: 'day trades are always sold before the market closes',
  hold: 'the long-term trade reached the end of its holding period',
}

/** The accepted buy in the decision log that opened this trade (same market, within a minute). */
function entryAudit(p: PracticePosition, audit: AuditEntry[]) {
  return audit.find((a) => a.accepted && a.side === 'buy' && a.symbol === p.symbol && Math.abs(a.time - p.openedAt) < 60_000)
}

function story(p: PracticePosition, audit: AuditEntry[], now: { last: number } | { trade: PracticeTrade }, playbook: PracticeTrade[] | null = null): DetailLine[] {
  const i = p.info
  const long = kindOf(p) === 'long'
  const lines: DetailLine[] = []
  if ('trade' in now) {
    const t = now.trade
    lines.push({ k: 'Status', v: `Closed: ${exitReasonLabel[t.exitReason].en}`, tone: t.pnl >= 0 ? 'up' : 'down' })
  } else {
    lines.push({ k: 'Status', v: long ? 'Open · long-term trade, held for days' : 'Open · day trade, sold by market close' })
  }
  const slip = p.signal && p.signal !== p.entry ? ` (signal ${fmtPrice(p.signal)}, filled after spread and slippage)` : ''
  lines.push({ k: 'Bought', v: `${when(p.openedAt)} · ${+p.qty.toPrecision(6)} @ ${fmtPrice(p.entry)} = ${fmtUsd(p.qty * p.entry)}${slip}` })
  const score = [i.verdict, i.tradeScore != null ? `Trade Score ${i.tradeScore}${i.grade ? ` (${i.grade})` : ''}` : null, `analyst ${i.score >= 0 ? '+' : ''}${i.score.toFixed(2)}`, i.regime ? `${i.regime} market` : null, i.learner !== 'n/a' ? `learner ${i.learner}` : null]
  lines.push({ k: 'Why', v: `${i.reason}${i.reason ? ' · ' : ''}${score.filter(Boolean).join(' · ')}` })
  if (i.pick) lines.push({ k: 'Picked', v: i.pick.en })
  lines.push({
    k: 'How it decided',
    v: `analyst signal (trend, buyers vs sellers, momentum, AI model) gave ${i.verdict}; Trade Score ${i.tradeScore ?? 'n/a'} rates the setup; the learner, which grades past AI buys, said ${i.learner === 'n/a' ? 'nothing yet' : i.learner}`,
  })
  lines.push({ k: 'Skills used', v: i.skills?.length ? i.skills.join(', ') : NOT_RECORDED })
  const a = entryAudit(p, audit)
  lines.push({ k: 'Checks passed', v: a?.passed?.length ? a.passed.join(', ') : NOT_RECORDED })
  if (playbook) {
    const pb = brokenRules(p, playbook)
    lines.push({ k: 'Trader Brain playbook', v: `followed ${pb.followed.length} of ${pb.checked} rules${pb.broken.length ? ` · broke: ${pb.broken.map((r) => r.en.name).join('; ')}` : ''}`, tone: pb.broken.length ? 'down' : 'up' })
  }
  lines.push({ k: 'Data', v: i.data ? `${DATA_LABEL[i.data.label].en} · ${i.data.source} · bar ${held(i.data.ageSec * 1000)} old` : NOT_RECORDED })
  lines.push({ k: 'Sell if', v: `price reaches ${fmtPrice(p.target)} target (${fmtPct(pctFrom(p.entry, p.target))}) or ${fmtPrice(p.stop)} stop (${fmtPct(pctFrom(p.entry, p.stop))})` })
  if (p.closeBy) lines.push({ k: long ? 'Hold until' : 'Close by', v: `${when(p.closeBy)}${long ? ', then sold if still open' : ' (before market close)'}` })
  if ('trade' in now) {
    const t = now.trade
    lines.push({ k: 'Sold', v: `${when(t.closedAt)} @ ${fmtPrice(t.exit)} · ${exitReasonLabel[t.exitReason].en} · held ${held(t.closedAt - t.openedAt)}` })
    lines.push({ k: 'Why sold', v: WHY_SOLD[t.exitReason] })
    const costs = t.costPaid ? ` · costs ${fmtUsd(t.costPaid)}` : ''
    lines.push({ k: 'Result', v: `${fmtUsd(t.pnl)} (${fmtPct(t.retPct)})${costs}`, tone: t.pnl >= 0 ? 'up' : 'down' })
    const fails = t.review?.fails.map((f) => REVIEW_FAIL[f].en).join(', ')
    lines.push({ k: 'Review', v: t.review ? `${BUCKET_LABEL[t.review.bucket].en}${fails ? `: ${fails}` : ''}` : NOT_RECORDED })
  } else {
    const u = p.qty * (now.last - p.entry)
    lines.push({ k: 'Now', v: `${fmtPrice(now.last)} · ${fmtUsd(u)} (${fmtPct(pctFrom(p.entry, now.last))}) so far`, tone: u >= 0 ? 'up' : 'down' })
  }
  return lines
}

/**
 * The practice account as Positions, Open orders and History rows. Practice trades live in their own
 * account (practice.ts), so the broker panels never saw them. Open orders are each position's stop and
 * target (they cancel each other, like a bracket); history is every fill and today's blocked buys,
 * newest first. Each row carries the trade's story for its detail view.
 */
/** `playbook`: add Trader Brain's playbook checks to each story. */
export function practiceRows(s: PracticeState, priceOf: (symbol: string) => number, now = Date.now(), playbook = false) {
  const pb = playbook ? s.trades : null
  const audit = s.audit ?? []
  const lastOf = (p: PracticePosition) => {
    const px = priceOf(p.symbol)
    return Number.isFinite(px) && px > 0 ? px : p.entry
  }
  const openStory = new Map(s.open.map((p) => [p.id, story(p, audit, { last: lastOf(p) }, pb)]))
  const positions: PracticePositionRow[] = s.open.map((p) => {
    const last = lastOf(p)
    const cost = p.qty * p.entry
    const unrealized = p.qty * (last - p.entry)
    return { id: p.id, tag: tagOf(p), detail: openStory.get(p.id)!, symbol: p.symbol, qty: p.qty, avgCost: p.entry, last, marketValue: p.qty * last, unrealized, unrealizedPct: cost ? (unrealized / cost) * 100 : 0 }
  })
  const base = { type: 'market' as const, source: 'robot' as const }
  const working: PracticeOrderRow[] = s.open
    .slice()
    .sort((a, b) => b.openedAt - a.openedAt)
    .flatMap((p) => {
      const leg = { ...base, tag: tagOf(p), tif: tifOf(p), practiceStatus: 'open' as const, detail: openStory.get(p.id)!, symbol: p.symbol, side: 'sell' as const, qty: p.qty, filledQty: 0, status: 'open' as const, createdAt: p.openedAt, parentId: p.id }
      return [
        { ...leg, id: `${p.id}-tp`, type: 'limit' as const, limitPrice: p.target, legLabel: 'Take profit' as const },
        { ...leg, id: `${p.id}-sl`, type: 'stop' as const, stopPrice: p.stop, legLabel: 'Stop loss' as const },
      ]
    })
  const history: PracticeOrderRow[] = []
  for (const p of s.open) history.push({ ...base, id: `${p.id}-buy`, tag: tagOf(p), tif: tifOf(p), practiceStatus: 'open', detail: openStory.get(p.id)!, symbol: p.symbol, side: 'buy', qty: p.qty, filledQty: p.qty, status: 'filled', createdAt: p.openedAt, filledAt: p.openedAt, filledPrice: p.entry })
  for (const t of s.trades) {
    const detail = story(t, audit, { trade: t }, pb)
    const row = { ...base, tag: tagOf(t), tif: tifOf(t), practiceStatus: 'closed' as const, detail, symbol: t.symbol, qty: t.qty, filledQty: t.qty, status: 'filled' as const }
    history.push({ ...row, id: `${t.id}-buy`, side: 'buy', createdAt: t.openedAt, filledAt: t.openedAt, filledPrice: t.entry })
    history.push({ ...row, id: `${t.id}-sell`, side: 'sell', createdAt: t.closedAt, filledAt: t.closedAt, filledPrice: t.exit, reason: `Closed: ${exitReasonLabel[t.exitReason].en}` })
  }
  const today = dayKey(now)
  const blocked = audit.filter((a) => !a.accepted && a.side === 'buy' && a.account === 'practice' && a.blockedBy !== 'Slots' && dayKey(a.time) === today).slice(0, MAX_BLOCKED)
  for (const a of blocked) {
    const detail: DetailLine[] = [
      { k: 'Status', v: `Blocked by ${a.blockedBy ?? 'a rule'}`, tone: 'down' },
      { k: 'What happened', v: `${when(a.time)} · ${a.en}` },
      { k: 'Price', v: fmtPrice(a.price) },
    ]
    if (a.verdict || a.tradeScore != null) detail.push({ k: 'AI said', v: [a.verdict, a.tradeScore != null ? `Trade Score ${a.tradeScore}` : null].filter(Boolean).join(' · ') })
    if (a.passed?.length) detail.push({ k: 'Checks passed first', v: a.passed.join(', ') })
    if (a.data) detail.push({ k: 'Data', v: `${DATA_LABEL[a.data.label].en} · ${a.data.source} · bar ${held(a.data.ageSec * 1000)} old` })
    history.push({ ...base, id: `${a.id}-blocked`, tag: 'Practice', tif: 'day', practiceStatus: 'blocked', detail, symbol: a.symbol, side: 'buy', qty: 0, filledQty: 0, status: 'rejected', createdAt: a.time, reason: a.blockedBy ? `Blocked by ${a.blockedBy}` : a.en })
  }
  history.sort((a, b) => b.createdAt - a.createdAt)
  return { positions, working, history }
}
