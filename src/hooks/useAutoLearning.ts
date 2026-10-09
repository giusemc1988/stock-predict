import { useCallback, useEffect, useRef, useState } from 'react'
import type { Instrument } from '../types'
import { hasAlpacaData, type AlpacaDataKeys, type ApiKeys } from '../data/providers'
import { candlesFor } from '../data/series'
import type { AiRules } from '../lib/aiRules'
import { CYCLE_MS, emptyState, parseState, runCycle, type LearnState, type LogEntry } from '../lib/autoLearn'

const KEY = 'arc.autoLearn.v1'
const NOTES_KEY = 'arc.autoLearn.notes.v1'
/** The server job is hourly; older than this means it has stopped reporting. */
const SERVER_FRESH_MS = 3 * 60 * 60_000

function loadLocal(): LearnState {
  try {
    return parseState(JSON.parse(localStorage.getItem(KEY) ?? 'null')) ?? emptyState('browser')
  } catch {
    return emptyState('browser')
  }
}

function loadNotes(): LogEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(NOTES_KEY) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

const save = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* storage full or blocked: keep going in memory */
  }
}

export interface AutoLearning {
  state: LearnState
  running: boolean
  error: string | null
  /** Time of the last cycle the server job wrote, or null when it hasn't reported. */
  serverLast: number | null
  serverFresh: boolean
  nextCycle: number | null
  runNow: () => void
  notes: LogEntry[]
  addNote: (kind: 'correction' | 'preference', text: string) => void
  /** Markets this browser can fetch (crypto always; stocks with an Alpaca paper key). */
  markets: string[]
}

/**
 * In-app half of 24/7 learning: while the app is open and the toggle is on, run a cycle
 * every hour on the markets this browser can fetch. The hourly server job keeps going
 * while the app is closed; whichever copy ran last is the one shown and continued.
 */
export function useAutoLearning(universe: Instrument[], keys: ApiKeys, alpaca: AlpacaDataKeys, rules: AiRules): AutoLearning {
  const [state, setState] = useState<LearnState>(loadLocal)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serverLast, setServerLast] = useState<number | null>(null)
  const [serverFresh, setServerFresh] = useState(false)
  const [notes, setNotes] = useState<LogEntry[]>(loadNotes)
  const stateRef = useRef(state)
  stateRef.current = state
  const busy = useRef(false)

  const markets = universe.filter((i) => i.assetClass === 'crypto' || hasAlpacaData(alpaca)).map((i) => i.symbol)
  const ctx = useRef({ universe, keys, alpaca, rules, markets })
  ctx.current = { universe, keys, alpaca, rules, markets }

  // pick up the server's results whenever they are newer than this browser's
  useEffect(() => {
    if (!rules.autoLearn) return
    const pull = () =>
      fetch('auto-learning.json', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((raw) => {
          const s = parseState(raw)
          if (!s) return
          setServerLast(s.lastCycle)
          setServerFresh(s.lastCycle != null && Date.now() - s.lastCycle < SERVER_FRESH_MS)
          if ((s.lastCycle ?? 0) > (stateRef.current.lastCycle ?? 0) && !busy.current) {
            setState(s)
            save(KEY, s)
          }
        })
        .catch(() => undefined)
    pull()
    const id = setInterval(pull, 30 * 60_000)
    return () => clearInterval(id)
  }, [rules.autoLearn])

  const cycle = useCallback(async () => {
    if (busy.current) return
    const { universe: u, keys: k, alpaca: a, rules: r, markets: m } = ctx.current
    if (!m.length) return
    busy.current = true
    setRunning(true)
    setError(null)
    try {
      const fetchOne = (sym: string) => candlesFor(u.find((i) => i.symbol === sym)!, '1h', k, a, 1000)
      const { state: next, report } = await runCycle({ ...stateRef.current, source: 'browser' }, m, fetchOne, r)
      if (!report.markets.length) setError(report.failed[0]?.error ?? 'No market data')
      else {
        setState(next)
        save(KEY, next)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      busy.current = false
      setRunning(false)
    }
  }, [])

  // hourly while the app is open and the toggle is on
  useEffect(() => {
    if (!rules.autoLearn) return
    const tick = () => {
      const last = stateRef.current.lastCycle
      if (last == null || Date.now() - last >= CYCLE_MS) void cycle()
    }
    const first = setTimeout(tick, 5000) // let the chart load first
    const id = setInterval(tick, 60_000)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [rules.autoLearn, cycle])

  const addNote = useCallback((kind: 'correction' | 'preference', text: string) => {
    const t = text.trim()
    if (!t) return
    setNotes((ns) => {
      const next = [{ time: Date.now(), kind, en: t, vi: t }, ...ns].slice(0, 200)
      save(NOTES_KEY, next)
      return next
    })
  }, [])

  const nextCycle = state.lastCycle == null ? null : state.lastCycle + CYCLE_MS

  return { state, running, error, serverLast, serverFresh, nextCycle, runNow: () => void cycle(), notes, addNote, markets }
}
