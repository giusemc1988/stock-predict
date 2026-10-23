/**
 * Sliding pill for tab bars (Dashboard cards and motion): one highlight per bar that glides to the
 * selected button instead of jumping. Works on the app's existing bars by class, so no component changes:
 * a button with class "on" is the selected one. Transform only (FLIP), skipped under reduced motion.
 */
const BARS = '.nav, .seg, .right-tabs, .al-tabs'
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

interface Box {
  x: number
  y: number
  w: number
  h: number
}
const last = new WeakMap<HTMLElement, Box>()

function sync(bar: HTMLElement, animate: boolean) {
  const on = [...bar.children].find((c): c is HTMLElement => c instanceof HTMLElement && c.tagName === 'BUTTON' && c.classList.contains('on'))
  let pill = bar.querySelector<HTMLElement>(':scope > .dm-pill')
  if (!on) {
    pill?.remove()
    bar.classList.remove('has-pill')
    last.delete(bar)
    return
  }
  if (!pill) {
    pill = document.createElement('span')
    pill.className = 'dm-pill'
    pill.setAttribute('aria-hidden', 'true')
    bar.appendChild(pill)
    bar.classList.add('has-pill')
    last.delete(bar) // a fresh pill has no position yet, even if this bar had one before a restart
    animate = false
  }
  const box = { x: on.offsetLeft, y: on.offsetTop, w: on.offsetWidth, h: on.offsetHeight }
  const prev = last.get(bar)
  if (prev && prev.x === box.x && prev.y === box.y && prev.w === box.w && prev.h === box.h) return
  Object.assign(pill.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px` })
  last.set(bar, box)
  if (animate && prev && box.w > 0) {
    // FLIP: start where the old button was, glide to the new one
    pill.animate(
      [{ transform: `translate(${prev.x - box.x}px, ${prev.y - box.y}px) scaleX(${prev.w / box.w})` }, { transform: 'none' }],
      { duration: 320, easing: EASE },
    )
  }
}

/** Starts the pills; returns a function that removes them and puts every bar back as it was. */
export function startSlidePills(root: HTMLElement = document.body): () => void {
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}
  const all = () => root.querySelectorAll<HTMLElement>(BARS)
  const sized = new ResizeObserver((es) => es.forEach((e) => sync(e.target as HTMLElement, false)))
  const watch = (bar: HTMLElement) => {
    sync(bar, false)
    sized.observe(bar)
  }
  all().forEach(watch)
  let queued = new Set<HTMLElement>()
  let raf = 0
  const mo = new MutationObserver((ms) => {
    for (const m of ms) {
      const t = m.target as HTMLElement
      if (t.classList?.contains('dm-pill')) continue
      if (m.type === 'attributes') {
        const bar = t.parentElement
        if (t.tagName === 'BUTTON' && bar?.matches(BARS)) queued.add(bar)
      } else {
        for (const n of m.addedNodes) {
          if (!(n instanceof HTMLElement) || n.classList.contains('dm-pill')) continue
          if (n.matches(BARS)) watch(n)
          n.querySelectorAll<HTMLElement>(BARS).forEach(watch)
          if (t.matches?.(BARS)) queued.add(t)
        }
      }
    }
    if (queued.size && !raf)
      raf = requestAnimationFrame(() => {
        raf = 0
        const q = queued
        queued = new Set()
        q.forEach((bar) => sync(bar, true))
      })
  })
  mo.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] })
  return () => {
    mo.disconnect()
    sized.disconnect()
    cancelAnimationFrame(raf)
    root.querySelectorAll('.dm-pill').forEach((p) => p.remove())
    root.querySelectorAll('.has-pill').forEach((b) => b.classList.remove('has-pill'))
  }
}
