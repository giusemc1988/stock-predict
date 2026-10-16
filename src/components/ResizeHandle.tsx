import { useRef } from 'react'

interface Props {
  axis: 'x' | 'y'
  className: string
  label: string
  /** Current size of the panel, px, when the drag starts. */
  measure: () => number
  /** +1 if dragging right/down grows the panel, -1 if it shrinks it. */
  dir: 1 | -1
  min: number
  max: () => number
  onSize: (px: number) => void
  onReset: () => void
}

/** A thin drag bar on a panel edge; arrow keys nudge it, double-click returns to the auto size. */
export function ResizeHandle({ axis, className, label, measure, dir, min, max, onSize, onReset }: Props) {
  const start = useRef<{ pos: number; size: number } | null>(null)
  const clamp = (px: number) => Math.round(Math.min(Math.max(px, min), Math.max(min, max())))
  return (
    <div
      className={`rz ${className}`}
      role="separator"
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      aria-label={label}
      title={label}
      tabIndex={0}
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        start.current = { pos: axis === 'x' ? e.clientX : e.clientY, size: measure() }
        document.body.classList.add(axis === 'x' ? 'rz-dragging-x' : 'rz-dragging-y')
      }}
      onPointerMove={(e) => {
        if (!start.current) return
        const d = (axis === 'x' ? e.clientX : e.clientY) - start.current.pos
        onSize(clamp(start.current.size + dir * d))
      }}
      onPointerUp={(e) => {
        start.current = null
        e.currentTarget.releasePointerCapture(e.pointerId)
        document.body.classList.remove('rz-dragging-x', 'rz-dragging-y')
      }}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        const grow: Record<string, number> = axis === 'x' ? { ArrowRight: dir, ArrowLeft: -dir } : { ArrowDown: dir, ArrowUp: -dir }
        const step = grow[e.key]
        if (step) {
          e.preventDefault()
          onSize(clamp(measure() + step * 16))
        }
      }}
    />
  )
}
