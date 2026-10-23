import type { CSSProperties } from 'react'
import type { ProjectId } from '../lib/projects'

export type AgentId = ProjectId | 'jarvis'

/**
 * Each agent's character: a friendly cartoon person, every one from a different background, with
 * the tool of their project. They blink, glance and tilt their head while "thinking"; each has one
 * small motion of its own (JarvisHub.css, `.agf`). Colours: skin, hair and the project hue.
 */
const LOOK: Record<AgentId, { skin: string; skin2: string; hair: string; beard?: boolean; label: string }> = {
  jarvis: { skin: '#b27a55', skin2: '#8f5d3f', hair: '#1d1714', beard: true, label: 'Neo' },
  atlas: { skin: '#f1cba6', skin2: '#d39f78', hair: '#15121a', label: 'Atlas' },
  argus: { skin: '#6e4329', skin2: '#4f2f1b', hair: '#120d0a', beard: true, label: 'Iris' },
  echo: { skin: '#f7d9c6', skin2: '#dfae94', hair: '#c4602c', label: 'Echo' },
  volt: { skin: '#c98e62', skin2: '#a46e48', hair: '#2a1c13', label: 'Volt' },
  nexus: { skin: '#d9a67d', skin2: '#b9845c', hair: '#3d4a72', label: 'Nexus' },
  nova: { skin: '#5b3521', skin2: '#41251a', hair: '#19110d', label: 'Nova' },
  viraltech: { skin: '#e8b98c', skin2: '#c79469', hair: '#1a1512', label: 'Viraltech' },
  lumi: { skin: '#f4d2b4', skin2: '#dcae8c', hair: '#1b1517', label: 'Lumi' },
  forge: { skin: '#9c6543', skin2: '#7b4c2f', hair: '#22160f', beard: true, label: 'Max' },
}

const HEART = 'c-1.6-2.4-4.8-.8-3.2 1.6l3.2 3.2 3.2-3.2c1.6-2.4-1.6-4-3.2-1.6z'
const STAR = 'l2 6 6 2-6 2-2 6-2-6-6-2 6-2z'

export function AgentFace({ id, hue, className = '' }: { id: AgentId; hue: string; className?: string }) {
  const k = LOOK[id]
  const is = (x: AgentId) => id === x
  const style = { '--k': hue, '--skin': k.skin, '--skin2': k.skin2, '--hair': k.hair } as CSSProperties
  return (
    <svg className={`agf agf-${id} ${className}`} viewBox="0 0 120 120" role="img" aria-label={k.label} style={style}>
      <g className="agf-whole">
        {is('argus') && (
          <g className="agf-orb">
            <ellipse className="agf-acc" cx="60" cy="60" rx="56" ry="16" transform="rotate(-16 60 60)" opacity=".35" strokeWidth="1.4" />
            <circle cx="110" cy="45" r="7" fill="#1c1820" stroke={hue} strokeWidth="1.6" />
            <ellipse className="agf-mer" cx="110" cy="45" rx="7" ry="7" fill="none" stroke={hue} strokeWidth="1" />
          </g>
        )}
        {is('echo') && <path className="agf-hair agf-tail" d="M78 34C96 38 99 68 88 86C86 70 84 56 75 46Z" />}
        {is('nexus') && <path className="agf-outfit2" d="M33 54C30 21 90 21 87 54C88 70 92 84 99 98C80 90 40 90 21 98C28 84 32 70 33 54Z" />}
        {is('nova') && (
          <>
            <circle className="agf-hair" cx="35" cy="29" r="13" />
            <circle className="agf-hair" cx="85" cy="29" r="13" />
          </>
        )}
        {is('lumi') && <path className="agf-hair" d="M36 50C31 74 33 92 37 102L83 102C87 92 89 74 84 50Z" />}
        <path className={is('jarvis') ? 'agf-suit' : 'agf-outfit'} d="M20 122C20 99 37 88 60 88C83 88 100 99 100 122Z" />
        {is('jarvis') && (
          <>
            <path d="M51 88L60 103L69 88Z" fill="#ece6dd" />
            <path className="agf-fill" d="M58.5 92L61.5 92L61 106L59 106Z" />
            <path d="M51 88L57 100L46 96Z" fill="#3a3342" />
            <path d="M69 88L63 100L74 96Z" fill="#3a3342" />
          </>
        )}
        <g className="agf-head">
          <rect className="agf-skin" x="53" y="68" width="14" height="22" rx="6" />
          {!is('jarvis') && !is('nexus') && <path className="agf-skin" d="M51 88L60 97L69 88Z" />}
          <rect className="agf-skin2" x="53" y="72" width="14" height="5" rx="2" opacity=".5" />
          <ellipse className="agf-skin" cx="39" cy="55" rx="4" ry="6" />
          <ellipse className="agf-skin" cx="81" cy="55" rx="4" ry="6" />
          <ellipse className="agf-skin" cx="60" cy="52" rx="21" ry="24" />
          {k.beard && <path className="agf-hair" d="M39 56C40 72 50 80 60 80C70 80 80 72 81 56C79 64 75 68 71 68C67 64 53 64 49 68C45 68 41 64 39 56Z" />}
          <path className="agf-brow" d="M47 47q5-3 9 0" />
          <path className="agf-brow" d="M64 47q5-3 9 0" />
          <g className="agf-eyes">
            <g className="agf-eye">
              <ellipse fill="#1c1418" cx="51.5" cy="54.5" rx="2.7" ry="3.3" />
              <circle fill="#fff" cx="52.4" cy="53.4" r=".9" />
            </g>
            <g className="agf-eye">
              <ellipse fill="#1c1418" cx="68.5" cy="54.5" rx="2.7" ry="3.3" />
              <circle fill="#fff" cx="69.4" cy="53.4" r=".9" />
            </g>
          </g>
          <path className="agf-nose" d="M60 57q-2.6 5 .6 6" />
          {is('nova') ? <ellipse className="agf-talk" cx="60" cy="67" rx="4" ry="3" fill="#6d2a2a" /> : <path className="agf-mouth" d="M54 66q6 5 12 0" stroke={k.beard ? '#f1e3d6' : undefined} />}
          <circle className="agf-blush" cx="46" cy="63" r="3.6" />
          <circle className="agf-blush" cx="74" cy="63" r="3.6" />
          {is('echo') && (
            <g fill="#c98d72" opacity=".7">
              <circle cx="45" cy="60" r=".9" />
              <circle cx="48" cy="61.5" r=".9" />
              <circle cx="72" cy="61.5" r=".9" />
              <circle cx="75" cy="60" r=".9" />
            </g>
          )}
          {is('jarvis') && (
            <>
              <path className="agf-hair" d="M38 47C36 30 48 24 60 24C73 24 84 31 82 47C79 40 74 35 66 34C62 37 52 39 44 39C41 41 39 44 38 47Z" />
              <path className="agf-acc" d="M84 56C86 64 80 68 70 68" strokeWidth="1.4" />
              <circle className="agf-fill agf-blink" cx="84" cy="55" r="2.6" />
            </>
          )}
          {is('atlas') && (
            <>
              <path className="agf-hair" d="M37 51C33 30 46 23 60 23C76 23 87 33 83 51C82 42 77 37 70 35C64 39 50 41 41 41C39 44 38 47 37 51Z" />
              <rect x="45" y="49" width="13" height="11" rx="4" fill="rgba(255,255,255,.12)" stroke={hue} strokeWidth="1.6" />
              <rect x="62" y="49" width="13" height="11" rx="4" fill="rgba(255,255,255,.12)" stroke={hue} strokeWidth="1.6" />
              <path d="M58 53h4" stroke={hue} strokeWidth="1.6" />
            </>
          )}
          {is('argus') && <path className="agf-hair" d="M39 45C40 30 50 27 60 27C70 27 80 30 81 45C78 40 72 37 60 37C48 37 42 40 39 45Z" />}
          {is('echo') && (
            <>
              <path className="agf-hair" d="M37 52C34 30 48 22 62 23C77 24 86 34 83 52C80 42 72 34 62 33C56 38 46 44 37 52Z" />
              <path className="agf-acc agf-p" d="M85 52a7 7 0 0 1 0 10" />
              <path className="agf-acc agf-p agf-p2" d="M89 48a13 13 0 0 1 0 18" />
            </>
          )}
          {is('volt') && (
            <>
              <g className="agf-hair">
                <circle cx="41" cy="41" r="7" />
                <circle cx="49" cy="32" r="8" />
                <circle cx="60" cy="29" r="8.5" />
                <circle cx="71" cy="31" r="8" />
                <circle cx="79" cy="39" r="7" />
                <circle cx="83" cy="47" r="4.5" />
                <circle cx="37" cy="48" r="4.5" />
              </g>
              <rect x="38" y="37" width="44" height="5" rx="2.5" fill="#2b2a2e" />
              <circle className="agf-lens" cx="50" cy="39" r="6" />
              <circle className="agf-lens" cx="70" cy="39" r="6" />
              <circle fill="#fff" opacity=".7" cx="48" cy="37" r="1.4" />
              <circle fill="#fff" opacity=".7" cx="68" cy="37" r="1.4" />
            </>
          )}
          {is('nexus') && (
            <>
              <path className="agf-outfit2" d="M37 50C37 21 83 21 83 50C78 37 70 32 60 32C50 32 42 37 37 50Z" />
              <ellipse className="agf-scarf" cx="60" cy="53" rx="23" ry="26.5" />
            </>
          )}
          {is('nova') && (
            <>
              <path className="agf-hair" d="M38 46C38 30 82 30 82 46C76 38 68 35 60 35C52 35 44 38 38 46Z" />
              <path className="agf-acc" d="M36 52C36 20 84 20 84 52" strokeWidth="3.6" />
              <rect className="agf-fill" x="31" y="46" width="8" height="15" rx="3.5" />
              <rect className="agf-fill" x="81" y="46" width="8" height="15" rx="3.5" />
              <path className="agf-acc" d="M35 60C38 70 46 71 51 69" strokeWidth="1.6" />
              <circle className="agf-fill" cx="52" cy="68.5" r="2.4" />
            </>
          )}
          {is('viraltech') && (
            <>
              <path className="agf-hair" d="M39 46C38 30 50 22 64 23C78 24 86 32 82 44C78 38 70 36 64 37C56 38 48 40 39 46Z" />
              <path className="agf-hair" d="M52 28C60 15 80 16 85 30C77 25 66 25 57 31Z" />
            </>
          )}
          {is('lumi') && (
            <>
              <path className="agf-hair" d="M37 52C35 30 48 23 60 23C72 23 85 30 83 52C80 44 78 40 76 38C68 42 52 42 44 38C42 42 39 46 37 52Z" />
              <ellipse className="agf-fill" cx="63" cy="26" rx="22" ry="7.5" transform="rotate(-9 63 26)" />
              <circle className="agf-fill" cx="66" cy="17" r="2.6" />
            </>
          )}
          {is('forge') && (
            <>
              <circle className="agf-hair" cx="39" cy="47" r="4.5" />
              <circle className="agf-hair" cx="81" cy="47" r="4.5" />
              <path className="agf-fill" d="M37 42C37 21 83 21 83 42Z" />
              <rect className="agf-fill" x="32" y="39" width="56" height="6" rx="3" />
              <path d="M58 24h4v15h-4z" fill="rgba(0,0,0,.15)" />
            </>
          )}
        </g>
        {is('atlas') && (
          <>
            <circle className="agf-skin" cx="76" cy="106" r="5" />
            <rect x="76" y="92" width="30" height="21" rx="4" fill="#1c1820" stroke={hue} strokeWidth="1.5" />
            <polyline className="agf-acc agf-chart" points="80,108 86,102 92,104 101,96" strokeWidth="2" />
          </>
        )}
        {is('volt') && <path className="agf-fill agf-spark" d={`M100 86l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z`} />}
        {is('nexus') && (
          <>
            <circle className="agf-fill" cx="74" cy="100" r="3" />
            <path className="agf-acc agf-p" d="M79 95a7 7 0 0 1 0 10" />
            <path className="agf-acc agf-p agf-p2" d="M83 91a13 13 0 0 1 0 18" />
          </>
        )}
        {is('viraltech') && (
          <>
            <circle className="agf-skin" cx="92" cy="110" r="5" />
            <rect x="86" y="92" width="12" height="20" rx="3" fill="#1c1820" stroke={hue} strokeWidth="1.5" />
            <path className="agf-fill agf-heart" d={`M104 84c-2-3-6-1-4 2l4 4 4-4c2-3-2-5-4-2z`} />
            <path className="agf-fill agf-heart agf-h2" d={`M111 76${HEART}`} />
            <path className="agf-fill agf-heart agf-h3" d={`M97 74${HEART}`} />
          </>
        )}
        {is('lumi') && (
          <>
            <circle className="agf-skin" cx="80" cy="110" r="5" />
            <rect x="78" y="96" width="28" height="18" rx="4" fill="#2a2430" />
            <circle cx="92" cy="105" r="6" fill="#1c1418" stroke={hue} strokeWidth="2" />
            <circle fill="#fff" cx="90" cy="103" r="1.4" />
            <path className="agf-fill agf-flash" d={`M106 84${STAR}`} />
          </>
        )}
        {is('forge') && (
          <g className="agf-tool">
            <circle className="agf-skin" cx="92" cy="108" r="5" />
            <path d="M92 104L100 84" stroke="#9a8a74" strokeWidth="3.2" strokeLinecap="round" />
            <path className="agf-fill" d="M95 80l10 4-3 6-10-4z" />
          </g>
        )}
      </g>
    </svg>
  )
}
