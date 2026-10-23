/**
 * Nova presets: a named set of choices (mode, size, post kit and video settings) to reuse in one tap.
 * Kept in the SETTINGS KV under PRESETS_KEY so every device sees the same list; tested in scripts/novapostkit.test.ts.
 */
import { cleanKitSettings, type KitSettings } from './postkit'
import { cleanRenderOpts, type RenderOpts } from '../studioJobs'
import type { StudioMode } from './script'

export const PRESETS_KEY = 'nova:presets'
export const MAX_PRESETS = 20

export interface NovaPreset {
  name: string
  at: number
  mode: StudioMode
  aspect: '9:16' | '16:9' | '1:1'
  kit: KitSettings
  video: RenderOpts
}

const MODES: StudioMode[] = ['faceless', 'philosophy', 'trip']

export function cleanPreset(v: unknown): NovaPreset | null {
  const p = v as Partial<Record<keyof NovaPreset, unknown>> | null
  const name = typeof p?.name === 'string' ? p.name.replace(/\s+/g, ' ').trim().slice(0, 40) : ''
  if (!name) return null
  return {
    name,
    at: Number.isFinite(Number(p?.at)) ? Number(p!.at) : 0,
    mode: MODES.includes(p?.mode as StudioMode) ? (p!.mode as StudioMode) : 'faceless',
    aspect: p?.aspect === '16:9' || p?.aspect === '1:1' ? p.aspect : '9:16',
    kit: cleanKitSettings(p?.kit),
    video: cleanRenderOpts(p?.video),
  }
}

/** A clean list: one preset per name (the newest wins), newest first, at most MAX_PRESETS. */
export function cleanPresets(v: unknown): NovaPreset[] {
  const all = (Array.isArray(v) ? v : []).map(cleanPreset).filter((p): p is NovaPreset => !!p).sort((a, b) => b.at - a.at)
  const seen = new Set<string>()
  return all.filter((p) => !seen.has(p.name.toLowerCase()) && !!seen.add(p.name.toLowerCase())).slice(0, MAX_PRESETS)
}
