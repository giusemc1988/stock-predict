import { useEffect, useRef, type CSSProperties } from 'react'

/**
 * Neo's face: Chanh's 3D portrait, with a 6 s loop (smile, tilt, nod) made once with LivePortrait
 * (public/neo, ~35 KB). The video only loads and plays while it is on screen and motion is on;
 * small sizes and reduced motion show the still picture.
 */
const STILL = '/neo/neo-face.webp'
const STILL_SMALL = '/neo/neo-face-96.webp'
const VIDEO_MIN = 36

export function NeoFace({ size, motion = true, className = '', style }: { size?: number; motion?: boolean; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLVideoElement>(null)
  const small = size !== undefined && size < VIDEO_MIN
  const play = motion && !small && !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    const v = ref.current
    if (!v || !play) return
    let seen = false
    const sync = () => (seen && !document.hidden ? v.play().catch(() => {}) : v.pause())
    const io = new IntersectionObserver(([e]) => ((seen = e.isIntersecting), sync()))
    io.observe(v)
    const onVis = () => sync()
    document.addEventListener('visibilitychange', onVis)
    return () => (io.disconnect(), document.removeEventListener('visibilitychange', onVis), v.pause())
  }, [play])

  const box = size !== undefined ? { width: size, height: size, ...style } : style
  return (
    <span className={`neo-face ${className}`} style={box} role="img" aria-label="Neo">
      {play ? (
        <video ref={ref} muted loop playsInline preload="none" poster={STILL} aria-hidden="true">
          <source src="/neo/neo-face.webm" type="video/webm" />
          <source src="/neo/neo-face.mp4" type="video/mp4" />
        </video>
      ) : (
        <img src={small ? STILL_SMALL : STILL} alt="" decoding="async" loading="lazy" />
      )}
    </span>
  )
}
