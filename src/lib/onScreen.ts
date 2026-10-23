/**
 * Tracks whether an element is on screen, so canvas loops can skip drawing while it is scrolled away.
 * Without IntersectionObserver it always reports visible.
 */
export function watchOnScreen(el: Element) {
  const seen = { visible: true, stop: () => {} }
  if (typeof IntersectionObserver === 'undefined') return seen
  const io = new IntersectionObserver(([e]) => (seen.visible = e.isIntersecting), { rootMargin: '80px 0px' })
  io.observe(el)
  seen.stop = () => io.disconnect()
  return seen
}
