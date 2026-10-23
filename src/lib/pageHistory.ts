/**
 * Phone swipe-back and the browser Back button: each project opened from the Neo Hub is one step in the
 * browser history, so going back returns to the Hub instead of leaving the app. Pure decision; App.tsx applies it.
 */
export type HistoryStep = { kind: 'none' } | { kind: 'push' } | { kind: 'replace' } | { kind: 'back'; steps: number }

/** Atlas's own tabs: switching between them doesn't add a step, so one swipe back from any of them reaches the Hub. */
const ATLAS = new Set(['brief', 'trade', 'portfolio'])

/**
 * What to do with the history when the page changes from `from` to `to`.
 * `depth` is how many steps the current entry sits above the home entry.
 */
export function historyStep(from: string, to: string, home: string, depth: number): HistoryStep {
  if (from === to) return { kind: 'none' }
  // going home walks back to the home entry, so the stack never grows and swipe-back from home leaves as usual
  if (to === home) return depth > 0 ? { kind: 'back', steps: depth } : { kind: 'replace' }
  if (from !== home && ATLAS.has(from) && ATLAS.has(to)) return { kind: 'replace' }
  return { kind: 'push' }
}

/** Short links into a project, by the names Chanh uses: /#nova opens Nova, /#atlas opens Atlas, and so on. */
const LINKS: Record<string, string> = { atlas: 'trade', nova: 'studio', echo: 'ruview', nexus: 'net', argus: 'godseye', viraltech: 'viraltech', neo: 'home', jarvis: 'home', hub: 'home' }

/** The page a "#name" link asks for, or null. */
export function linkedPage(hash: string): string | null {
  return LINKS[hash.replace(/^#\/?/, '').trim().toLowerCase()] ?? null
}
