import { useEffect, useRef, type CSSProperties } from 'react'

/**
 * Neo's face: Chanh's 3D portrait, a soft smile with subtle tilt and nod made with LivePortrait
 * (public/neo, ~35 KB). The video loops with a short rest between; it only loads and plays while
 * on screen and motion is on. Small sizes and reduced motion show the still picture.
 */
const STILL = '/neo/neo-face.webp'
const STILL_SMALL = '/neo/neo-face-96.webp'
const CLIPS = ['neo-face']
const REST_MS = 1400
const VIDEO_MIN = 36

/** A different clip from the one that just played. */
const nextClip = (prev: number) => (prev + 1 + Math.floor(Math.random() * (CLIPS.length - 1))) % CLIPS.length

export function NeoFace({ size, motion = true, className = '', style }: { size?: number; motion?: boolean; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLVideoElement>(null)
  const small = size !== undefined && size < VIDEO_MIN
  const play = motion && !small && !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    const v = ref.current
    if (!v || !play) return
    const ext = v.canPlayType('video/webm; codecs="vp9"') ? 'webm' : 'mp4'
    let clip = Math.floor(Math.random() * CLIPS.length)
    let seen = false
    let rest: ReturnType<typeof setTimeout> | undefined
    v.src = `/neo/${CLIPS[clip]}.${ext}`
    const sync = () => (seen && !document.hidden && !rest ? v.play().catch(() => {}) : v.pause())
    const onEnded = () => {
      rest = setTimeout(() => {
        rest = undefined
        clip = nextClip(clip)
        v.src = `/neo/${CLIPS[clip]}.${ext}`
        sync()
      }, REST_MS)
    }
    const io = new IntersectionObserver(([e]) => ((seen = e.isIntersecting), sync()))
    io.observe(v)
    v.addEventListener('ended', onEnded)
    document.addEventListener('visibilitychange', sync)
    return () => {
      io.disconnect()
      clearTimeout(rest)
      v.removeEventListener('ended', onEnded)
      document.removeEventListener('visibilitychange', sync)
      v.pause()
    }
  }, [play])

  const box = size !== undefined ? { width: size, height: size, ...style } : style
  return (
    <span className={`neo-face ${className}`} style={box} role="img" aria-label="Neo">
      {play ? (
        <video ref={ref} muted playsInline preload="none" poster={STILL} aria-hidden="true" />
      ) : (
        <img src={small ? STILL_SMALL : STILL} alt="" decoding="async" loading="lazy" />
      )}
    </span>
  )
}
