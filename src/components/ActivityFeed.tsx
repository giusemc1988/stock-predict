import { useEffect, useState } from 'react'
import { ago } from '../lib/ago'
import { useLang } from '../lib/i18n'
import { Icon, type IconName } from './StatCard'

export type FeedKind = 'buy' | 'sell' | 'skip' | 'ok' | 'no' | 'learn'
export interface FeedItem {
  id: string
  time: number // ms
  kind: FeedKind
  text: string
  /** Small line under the text, e.g. the symbol or where it came from. */
  sub?: string
}

const ICON: Record<FeedKind, IconName> = { buy: 'up', sell: 'down', skip: 'flat', ok: 'check', no: 'x', learn: 'book' }

/** A vertical feed: round icon by event type, what happened, and how long ago. New items slide in from the top. */
export function ActivityFeed({ items, empty }: { items: FeedItem[]; empty?: string }) {
  const lang = useLang()
  // relative times move on by themselves
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  if (!items.length) return empty ? <p className="muted al-note">{empty}</p> : null
  return (
    <ul className="af-list">
      {items.map((e) => (
        <li key={e.id} className={`af-item af-${e.kind}`}>
          <i className="af-ico">
            <Icon name={ICON[e.kind]} size={12} />
          </i>
          <div className="af-body">
            <span className="af-text" title={e.text}>{e.text}</span>
            {e.sub && <span className="af-sub">{e.sub}</span>}
          </div>
          <time className="af-time" dateTime={new Date(e.time).toISOString()} title={new Date(e.time).toLocaleString()}>
            {ago(e.time, lang, now)}
          </time>
        </li>
      ))}
    </ul>
  )
}
