/**
 * Where Neo's words come from. Today there is no AI model: every answer is the rule text
 * built from the app's own records. Phase 2 plugs free AI providers in here (Gemini, then Grok
 * or Groq, then NVIDIA NIM, called through the Worker so keys stay server-side, then an
 * in-browser model). A provider only rewords the facts it is given; it never decides a trade.
 */
import type { Bi } from './jarvis'

export interface BrainQuestion {
  /** What was asked, as typed or heard. */
  text: string
  lang: 'en' | 'vi'
  /** The facts Neo already worked out from the app's records. */
  facts: Bi[]
}

export interface BrainProvider {
  id: string
  /** Returns the answer, or null to let the next provider (or the rule text) answer. */
  explain: (q: BrainQuestion) => Promise<string | null>
}

const providers: BrainProvider[] = []

export function registerProvider(p: BrainProvider) {
  if (!providers.some((x) => x.id === p.id)) providers.push(p)
}

/** The rule text, unless a registered provider answers first. */
export async function explain(q: BrainQuestion): Promise<{ text: string; by: string }> {
  for (const p of providers) {
    try {
      const r = await p.explain(q)
      if (r) return { text: r, by: p.id }
    } catch {
      // a failing provider never blocks the answer
    }
  }
  return { text: q.facts.map((f) => (q.lang === 'vi' ? f.vi : f.en)).join(' '), by: 'rules' }
}
