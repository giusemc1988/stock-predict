import type { SignalSide } from '../types'

/** The Arc Analyst mini robot used for chart markers and branding. */
export function RobotIcon({ side, size = 28, title }: { side?: SignalSide; size?: number; title?: string }) {
  const accent = side === 'buy' ? 'var(--up)' : side === 'sell' ? 'var(--down)' : 'var(--robot)'
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={title ?? 'Arc Analyst robot'} className="robot-svg">
      {title && <title>{title}</title>}
      <line x1="16" y1="2.5" x2="16" y2="7" stroke={accent} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16" cy="3" r="2.2" fill={accent} className="robot-antenna" />
      <rect x="9.5" y="25" width="13" height="4.5" rx="2" fill="#16202d" stroke={accent} strokeWidth="1.2" />
      <rect x="5" y="7" width="22" height="18" rx="6" fill="#16202d" stroke={accent} strokeWidth="1.8" />
      <rect x="8.5" y="11" width="15" height="8.5" rx="4.25" fill="#05080c" />
      <circle cx="12.8" cy="15.2" r="2.1" fill={accent} className="robot-eye" />
      <circle cx="19.2" cy="15.2" r="2.1" fill={accent} className="robot-eye" />
      <rect x="2.5" y="13" width="2.5" height="6" rx="1.2" fill={accent} />
      <rect x="27" y="13" width="2.5" height="6" rx="1.2" fill={accent} />
      <path d="M13 22 q3 1.8 6 0" stroke={accent} strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  )
}
