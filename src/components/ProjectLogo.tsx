import type { CSSProperties } from 'react'
import type { ProjectId } from '../lib/projects'

/**
 * Each project's logo, moving the way the project works: Atlas's bars rise, the Iris globe turns,
 * Echo sends out rings, Volt's chip sparks, Nexus's Wi-Fi arcs light up, Nova plays, Viraltech's heart
 * beats, Lumi's aperture turns and Max's gears spin. Motion lives in JarvisHub.css (`.plg`).
 */
export function ProjectLogo({ id, hue, className = '' }: { id: ProjectId; hue: string; className?: string }) {
  const style = { '--k': hue } as CSSProperties
  return (
    <svg className={`plg plg-${id} ${className}`} viewBox="0 0 60 60" aria-hidden="true" style={style}>
      <g className="plg-glow">
        {id === 'atlas' && (
          <>
            <rect className="plg-f plg-bar" x="10" y="30" width="7" height="20" rx="2" />
            <rect className="plg-f plg-bar" x="21" y="22" width="7" height="28" rx="2" />
            <rect className="plg-f plg-bar" x="32" y="26" width="7" height="24" rx="2" />
            <rect className="plg-f plg-bar" x="43" y="14" width="7" height="36" rx="2" />
            <path className="plg-w" d="M8 24 22 14l10 6 18-12M44 8h6v6" />
          </>
        )}
        {id === 'argus' && (
          <>
            <circle className="plg-s" cx="30" cy="30" r="17" />
            <ellipse className="plg-s plg-m" cx="30" cy="30" rx="17" ry="17" strokeWidth="1.6" />
            <ellipse className="plg-s plg-m plg-m2" cx="30" cy="30" rx="17" ry="17" strokeWidth="1.6" />
            <path className="plg-s" d="M13 30h34" strokeWidth="1.6" />
            <g className="plg-orbit">
              <circle cx="54" cy="30" r="3" fill="#fff" />
            </g>
          </>
        )}
        {id === 'echo' && (
          <>
            <circle className="plg-s plg-ring" cx="30" cy="30" r="26" />
            <circle className="plg-s plg-ring plg-r2" cx="30" cy="30" r="26" />
            <circle className="plg-s plg-ring plg-r3" cx="30" cy="30" r="26" />
            <circle className="plg-f" cx="30" cy="30" r="5" />
          </>
        )}
        {id === 'volt' && (
          <>
            <rect className="plg-s" x="14" y="14" width="32" height="32" rx="6" />
            <path className="plg-s" d="M22 8v6M30 8v6M38 8v6M22 46v6M30 46v6M38 46v6M8 22h6M8 30h6M8 38h6M46 22h6M46 30h6M46 38h6" strokeWidth="2" />
            <path className="plg-zap" d="M33 18 23 32h7l-3 10 10-14h-7z" fill="#fff" />
          </>
        )}
        {id === 'nexus' && (
          <>
            <path className="plg-s plg-arc plg-a3" d="M8 24a31 31 0 0 1 44 0" />
            <path className="plg-s plg-arc plg-a2" d="M15 32a21 21 0 0 1 30 0" />
            <path className="plg-s plg-arc" d="M22 40a11 11 0 0 1 16 0" />
            <circle cx="30" cy="47" r="3.5" fill="#fff" />
          </>
        )}
        {id === 'nova' && (
          <>
            <rect className="plg-s" x="8" y="12" width="44" height="32" rx="9" />
            <path d="M25 20v16l13-8z" fill="#fff" />
            {[14, 22, 30, 38].map((x, i) => (
              <rect key={x} className={`plg-f plg-eq plg-eq${i}`} x={x} y="47" width="5" height="9" rx="2" />
            ))}
          </>
        )}
        {id === 'viraltech' && (
          <>
            <circle className="plg-s plg-ring plg-fast" cx="30" cy="31" r="24" />
            <path className="plg-f plg-beat" d="M30 46 15 32c-6-6-2-16 6-16 4 0 7 2 9 5 2-3 5-5 9-5 8 0 12 10 6 16z" />
          </>
        )}
        {id === 'lumi' && (
          <>
            <circle className="plg-s" cx="30" cy="30" r="20" />
            <path className="plg-s plg-ap" d="M30 10 38 26M50 30 34 38M30 50 22 34M10 30 26 22M44 16 36 30M44 44 30 36M16 44 24 30M16 16 30 24" strokeWidth="1.8" />
            <circle cx="30" cy="30" r="5" fill="#fff" />
          </>
        )}
        {id === 'forge' && (
          <>
            <g className="plg-gear">
              <circle className="plg-s" cx="26" cy="32" r="10" />
              <path className="plg-s" d="M26 16v5M26 43v5M10 32h5M37 32h5M14.7 20.7l3.5 3.5M33.8 39.8l3.5 3.5M14.7 43.3l3.5-3.5M33.8 24.2l3.5-3.5" strokeWidth="3" />
            </g>
            <g className="plg-gear2">
              <circle className="plg-f" cx="44" cy="18" r="5" />
              <path className="plg-s" d="M44 8v3M44 25v3M34 18h3M51 18h3" strokeWidth="2.4" />
            </g>
            <circle cx="26" cy="32" r="3.5" fill="#fff" />
          </>
        )}
      </g>
    </svg>
  )
}
