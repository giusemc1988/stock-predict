/**
 * Browser side of the free-AI helper: Jarvis asks it only when his own rules don't understand.
 * It talks to our Worker (/api/brain), which holds the keys; the browser never sees one.
 * If localAiOn is enabled, tries Ollama locally first (must allow the site origin via OLLAMA_ORIGINS).
 */
import { useEffect, useState } from 'react'
import { ask, briefing, type AskContext } from './jarvis'
import { askOllama } from './ollamaClient'

export interface CloudAnswer {
  text: string
  /** The helper that answered, e.g. "Gemini". */
  by: string
}

/** What Jarvis already knows, handed to the AI so it answers from the app's records first. */
export function factsForAi(c: AskContext): string[] {
  const lines = [...briefing(c.state, c.rules, c.journal, c.killSwitch, c.now), ...ask('risk', c), ...(c.symbol ? [{ en: `The chart on screen is ${c.symbol}.`, vi: '' }, ...ask('thisStock', c)] : [])]
  return lines.map((l) => l.en).filter(Boolean)
}

export async function askCloud(question: string, lang: 'en' | 'vi', facts: string[], timeoutMs = 15000): Promise<CloudAnswer | null> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const r = await fetch('/api/brain', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question, lang, facts }), signal: ctl.signal })
    if (!r.ok) return null
    const j = (await r.json()) as Partial<CloudAnswer>
    return j.text ? { text: j.text, by: j.by ?? 'AI' } : null
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

/** Try local Ollama first if enabled; fall back to cloud. Ollama must allow the site origin via OLLAMA_ORIGINS. */
export async function askAi(question: string, lang: 'en' | 'vi', facts: string[], localAiOn: boolean, timeoutMs = 15000): Promise<CloudAnswer | null> {
  if (localAiOn) {
    const local = await askOllama({ question, facts, lang })
    if (local) return local
  }
  return askCloud(question, lang, facts, timeoutMs)
}

export interface HelperStatus {
  id: string
  name: string
  on: boolean
}

/** Which free-AI helpers have a key on the server; null while loading or when the server has no helper. */
export function useCloudStatus(enabled: boolean): HelperStatus[] | null {
  const [s, setS] = useState<HelperStatus[] | null>(null)
  useEffect(() => {
    if (!enabled) return
    let live = true
    fetch('/api/brain/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { providers?: HelperStatus[] } | null) => live && setS(Array.isArray(j?.providers) ? j.providers : []))
      .catch(() => live && setS([]))
    return () => {
      live = false
    }
  }, [enabled])
  return s
}
