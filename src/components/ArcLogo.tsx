/** Arc Analyst mark: an arc-reactor ring with a candlestick at its core. */
export function ArcLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="Arc Analyst" className="arc-logo">
      <circle cx="16" cy="16" r="13" fill="none" stroke="var(--robot)" strokeWidth="2.4" strokeDasharray="7.2 3" className="arc-ring" />
      <circle cx="16" cy="16" r="8.6" fill="rgba(79, 209, 255, 0.12)" stroke="var(--robot)" strokeWidth="1" opacity="0.7" />
      <line x1="16" y1="8.8" x2="16" y2="23.2" stroke="var(--gold)" strokeWidth="1.4" strokeLinecap="round" />
      <rect x="13.4" y="12" width="5.2" height="8" rx="1.2" fill="var(--gold)" />
    </svg>
  )
}
