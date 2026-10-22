import type { ReactNode } from 'react'
import { CountUp } from './CountUp'

/** Small line icons for stat cards (24 x 24, stroke = currentColor). */
const ICONS = {
  up: 'M7 17 17 7M9 7h8v8',
  down: 'M7 7l10 10M17 9v8H9',
  flat: 'M5 12h14',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  wallet: 'M3 7h15a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zM3 7l12-4 2 4M16 13.5h2',
  target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 11.5v1',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM8 7h7',
  cycle: 'M20 11a8 8 0 0 0-14-5L4 8M4 4v4h4M4 13a8 8 0 0 0 14 5l2-2M20 20v-4h-4',
  cash: 'M3 6h18v12H3zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  pie: 'M12 3v9h9A9 9 0 1 1 12 3zM15 3.5A9 9 0 0 1 20.5 9H15z',
  radar: 'M12 12m-1.5 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0M8.5 15.5a5 5 0 0 1 0-7M15.5 8.5a5 5 0 0 1 0 7M5.6 18.4a9 9 0 0 1 0-12.8M18.4 5.6a9 9 0 0 1 0 12.8',
  chip: 'M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4',
  wifi: 'M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0M12 19.5h.01',
  code: 'M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14',
  film: 'M4 5h16v14H4zM8 5v14M16 5v14M4 9.5h4M4 14.5h4M16 9.5h4M16 14.5h4',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
} as const
export type IconName = keyof typeof ICONS

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg className="sc-svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

export type ChipTone = 'up' | 'down' | 'flat' | 'info' | 'warn'

export interface Stat {
  key: string
  label: string
  value: ReactNode
  /** Colour of the big number: 'up' / 'down' like the rest of the app, or plain. */
  tone?: 'up' | 'down' | 'flat' | ''
  /** Change chip. Only for a change the app already measures; never made up. */
  chip?: { text: string; tone: ChipTone; icon?: IconName }
  sub?: ReactNode
  icon?: IconName
  /** CSS colour for the icon tile and the top edge (a project's colour on the Hub). */
  accent?: string
  onClick?: () => void
  disabled?: boolean
  title?: string
}

const chipIcon = (c: NonNullable<Stat['chip']>): IconName => c.icon ?? (c.tone === 'up' ? 'up' : c.tone === 'down' ? 'down' : 'flat')

/** One number card: small label, big number, coloured change chip with its icon in a round badge. */
export function StatCard({ s }: { s: Stat }) {
  const body = (
    <>
      <div className="sc-top">
        {s.icon && (
          <span className="sc-ico">
            <Icon name={s.icon} />
          </span>
        )}
        <span className="sc-label">{s.label}</span>
      </div>
      <b className={`sc-value mono ${s.tone ?? ''}`}>{typeof s.value === 'string' ? <CountUp text={s.value} /> : s.value}</b>
      {(s.chip || s.sub) && (
        <div className="sc-foot">
          {s.chip && (
            <span className={`sc-chip c-${s.chip.tone}`}>
              <i>
                <Icon name={chipIcon(s.chip)} size={10} />
              </i>
              {s.chip.text}
            </span>
          )}
          {s.sub && <span className="sc-sub">{s.sub}</span>}
        </div>
      )}
    </>
  )
  const style = s.accent ? { ['--sc-k' as string]: s.accent } : undefined
  return s.onClick ? (
    <button className="sc sc-btn" style={style} onClick={s.onClick} disabled={s.disabled} title={s.title}>
      {body}
    </button>
  ) : (
    <div className="sc" style={style} title={s.title}>
      {body}
    </div>
  )
}

/** A row of stat cards that wraps to fit the space. */
export function StatRow({ items, className = '' }: { items: Stat[]; className?: string }) {
  return (
    <div className={`sc-row ${className}`}>
      {items.map((s) => (
        <StatCard key={s.key} s={s} />
      ))}
    </div>
  )
}
