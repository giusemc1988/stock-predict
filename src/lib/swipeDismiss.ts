import { useRef, type PointerEvent } from 'react'

/** Swipe a card left or right to dismiss it. Drag follows the finger; past 70px (or a quick flick) it closes. */
export function useSwipeDismiss(onDismiss: () => void) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null)
  const dx = useRef(0)

  const reset = (el: HTMLElement) => {
    el.style.transition = 'transform 0.18s, opacity 0.18s'
    el.style.transform = ''
    el.style.opacity = ''
  }

  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if ((e.target as HTMLElement).closest('button')) return
      start.current = { x: e.clientX, y: e.clientY, t: Date.now() }
      dx.current = 0
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const s = start.current
      if (!s) return
      const d = e.clientX - s.x
      if (Math.abs(d) < 8 || Math.abs(e.clientY - s.y) > Math.abs(d)) return
      dx.current = d
      const el = e.currentTarget
      el.setPointerCapture?.(e.pointerId)
      el.style.transition = 'none'
      el.style.transform = `translate3d(${d}px,0,0)`
      el.style.opacity = String(Math.max(0.25, 1 - Math.abs(d) / 260))
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => {
      const s = start.current
      start.current = null
      if (!s) return
      const d = dx.current
      const fast = Math.abs(d) > 30 && Date.now() - s.t < 250
      if (Math.abs(d) > 70 || fast) {
        const el = e.currentTarget
        el.style.transition = 'transform 0.18s, opacity 0.18s'
        el.style.transform = `translate3d(${d > 0 ? 400 : -400}px,0,0)`
        el.style.opacity = '0'
        setTimeout(onDismiss, 160)
      } else reset(e.currentTarget)
    },
    onPointerCancel: (e: PointerEvent<HTMLElement>) => {
      start.current = null
      reset(e.currentTarget)
    },
    style: { touchAction: 'pan-y' as const },
  }
}
