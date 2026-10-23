import { useEffect, useRef, useState } from 'react'
import { askAi } from '../lib/cloudBrain'
import { plainBrief } from '../lib/brief'
import type { Bi } from '../lib/jarvis'

const KEY = 'arc.brief.v1'
/** At most one AI call this often, whatever changes (one per practice scan cycle). */
const MIN_GAP_MS = 5 * 60_000
const QUESTION =
  "Write today's Neo Brief for the home page: 2 or 3 short sentences, the most useful thing for a paper trader first. " +
  'Use only the facts given; do not add any number, name, price or claim that is not in them. ' +
  'Say whether the US stock market is open or closed exactly as the facts say, never the other way round. ' +
  'If a fact says some data is missing or needs a key, say it is missing; never say it is available.'

interface Saved {
  key: string
  text: string
  by: string
  at: number
}
const load = (): Saved | null => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null') as Saved | null
  } catch {
    return null
  }
}

/** The brief text: written by a free AI helper once per change in the data, else the plain facts. */
export function useBriefText(cloudOn: boolean, facts: Bi[], key: string, lang: 'en' | 'vi', localAiOn = false): { text: string; by: string; writing: boolean } {
  const plain = plainBrief(facts, lang)
  const useAi = cloudOn || localAiOn
  const [saved, setSaved] = useState<Saved | null>(load)
  const [writing, setWriting] = useState(false)
  const [tick, setTick] = useState(0)
  const busy = useRef(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  const factsText = facts.map((f) => f.en).join('\n')
  useEffect(() => {
    console.info(`[Brief AI] local=${localAiOn} cloud=${cloudOn}${!useAi ? ' (off, or waiting for market data)' : saved?.key === key ? ' (already written for this data)' : ''}`)
    if (!useAi || saved?.key === key) return
    if (saved && Date.now() - saved.at < MIN_GAP_MS && saved.key.startsWith(`${lang}|`)) {
      const t = setTimeout(() => setTick((n) => n + 1), MIN_GAP_MS - (Date.now() - saved.at) + 1000)
      return () => clearTimeout(t)
    }
    // one call at a time; a slow local model must not be cancelled each time the data ticks
    if (busy.current) return
    busy.current = true
    setWriting(true)
    void askAi(QUESTION, lang, factsText.split('\n'), { local: localAiOn, cloud: cloudOn }).then((r) => {
      busy.current = false
      if (!alive.current) return
      setWriting(false)
      if (!r) return
      const s = { key, text: r.text, by: r.by, at: Date.now() }
      setSaved(s)
      try {
        localStorage.setItem(KEY, JSON.stringify(s))
      } catch {
        /* storage blocked: the text still shows this visit */
      }
      // the data may have moved on while the model was writing
      setTick((n) => n + 1)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudOn, localAiOn, key, lang, tick])
  // an AI brief is shown while it matches the data, or for a few minutes after; after that the plain facts win
  if (useAi && saved && saved.key.startsWith(`${lang}|`) && (saved.key === key || Date.now() - saved.at < MIN_GAP_MS)) return { text: saved.text, by: saved.by, writing }
  return { text: plain, by: '', writing }
}
