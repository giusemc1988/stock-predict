/** Jarvis, the Arc Brain: the Arc ring with a gold core. Idle turns slowly, thinking pulses, warning glows amber. */
export type JarvisMood = 'idle' | 'thinking' | 'speaking' | 'warning'

export function JarvisAvatar({ size = 40, mood = 'idle', motion = true }: { size?: number; mood?: JarvisMood; motion?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" role="img" aria-label="Jarvis" className={`jarvis-avatar j-${mood}${motion ? '' : ' still'}`}>
      <circle cx="20" cy="20" r="18" className="j-halo" />
      <circle cx="20" cy="20" r="16" fill="none" stroke="var(--robot)" strokeWidth="2.2" strokeDasharray="8 3.4" className="j-ring" />
      <circle cx="20" cy="20" r="11.5" fill="none" stroke="var(--robot)" strokeWidth="0.8" strokeDasharray="2 2.6" opacity="0.6" className="j-ring2" />
      <circle cx="20" cy="20" r="8" className="j-core" />
      <circle cx="16.8" cy="19" r="1.5" className="j-eye" />
      <circle cx="23.2" cy="19" r="1.5" className="j-eye" />
      <path d="M16.6 23.4 Q20 25.4 23.4 23.4" fill="none" className="j-mouth" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}
