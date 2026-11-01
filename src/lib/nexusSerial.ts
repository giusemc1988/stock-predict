/**
 * Nexus pocket scout over USB serial (Web Serial). Same JSON chunks as the BLE path, one per line,
 * after the firmware has seen a "ping" line (firmware/nexus-scout/src/main.cpp). Pure helpers here
 * so they can be tested without a port; NexusScoutPanel does the port plumbing.
 */
import { parseScoutChunk, type ScoutScan } from './nexusScout'

export const SCOUT_BAUD = 115200
export const SCOUT_PING_LINE = 'ping\n'
export const SCOUT_PING_MS = 10000

/** Boot/ping banner: `NEXUS-SCOUT v1.0.0 board=esp32-s3 ready`. */
export function parseScoutBanner(line: string): { version: string; board: string } | null {
  const m = /^NEXUS-SCOUT v(\S+) board=(\S+) ready\s*$/.exec(line.trim())
  return m ? { version: m[1], board: m[2] } : null
}

/** Splits streamed text into complete lines; the unfinished tail is returned to be prepended to the next chunk. */
export function splitLines(buffer: string): { lines: string[]; rest: string } {
  const parts = buffer.split(/\r?\n/)
  const rest = parts.pop() ?? ''
  return { lines: parts.filter((l) => l.length > 0), rest }
}

export interface ScoutFeed {
  /** A hot/cold reading from the board's finder: dBm, or null when the target was not heard this round. undefined = not a hunt line. */
  hunt?: number | null
  scan: ScoutScan
  /** Set when a scan cycle just finished (the "end" chunk); the caller shows `scan` and calls next() to start a fresh one. */
  complete: boolean
  banner: { version: string; board: string } | null
}

/** Feeds one serial line into the running scan. Non-JSON log lines are ignored (banner is reported). */
export function feedScoutLine(line: string, scan: ScoutScan): ScoutFeed {
  const banner = parseScoutBanner(line)
  if (banner) return { scan, complete: false, banner }
  if (!line.trimStart().startsWith('{')) return { scan, complete: false, banner: null }
  if (line.includes('"t":"hunt"')) {
    try {
      const j = JSON.parse(line) as { rssi?: unknown }
      return { scan, complete: false, banner: null, hunt: typeof j.rssi === 'number' ? j.rssi : null }
    } catch {
      return { scan, complete: false, banner: null }
    }
  }
  const next = parseScoutChunk(line, scan)
  return { scan: next, complete: next.at !== scan.at, banner: null }
}
