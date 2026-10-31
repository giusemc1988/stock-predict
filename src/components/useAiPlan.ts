import { useEffect, useState } from 'react'

let cached: { name: string; model: string }[] | null = null
let inflight: Promise<void> | null = null

/** "Gemini · gemini-3.1-flash, backup Groq · llama-3.3-70b-versatile": the AI Nova is about to use (from the server's live model list). */
export function aiPlanText(plan: { name: string; model: string }[] | null, backup: string): string {
  if (!plan?.length) return ''
  const [first, ...rest] = plan
  return `${first.name} · ${first.model}${rest.length ? `, ${backup} ${rest.map((x) => `${x.name} · ${x.model}`).join(', ')}` : ''}`
}

export function useAiPlan(): { name: string; model: string }[] | null {
  const [plan, setPlan] = useState(cached)
  useEffect(() => {
    if (cached) return
    inflight ??= fetch('/api/studio/ai-plan', { signal: AbortSignal.timeout(15_000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { plan?: { name: string; model: string }[] } | null) => {
        cached = j?.plan ?? []
      })
      .catch(() => {
        cached = []
      })
    void inflight.then(() => setPlan(cached))
  }, [])
  return plan
}
