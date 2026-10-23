/**
 * Hub themes. Each one is a set of CSS variables in src/components/JarvisHub.css
 * (`.hg[data-theme="<id>"]`); this list names them for the pickers. Adding a theme =
 * one entry here + one variable block there.
 */
import { useSyncExternalStore } from 'react'
import type { Bi } from './hubText'

export type ThemeId = 'amber' | 'plum' | 'moss'

export interface HubTheme {
  id: ThemeId
  name: Bi
  /** three colours for the round swatch: wallpaper glows and accent */
  swatch: [string, string, string]
}

export const THEMES: HubTheme[] = [
  { id: 'amber', name: { en: 'Amber', vi: 'Hổ phách' }, swatch: ['#a8652a', '#5c2f52', '#e7ad63'] },
  { id: 'plum', name: { en: 'Plum', vi: 'Mận' }, swatch: ['#8e3a5e', '#2a6a66', '#eba6c0'] },
  { id: 'moss', name: { en: 'Moss', vi: 'Rêu' }, swatch: ['#8a5230', '#3c5c43', '#dca274'] },
]

const KEY = 'arc.hubTheme.v1'
const listeners = new Set<() => void>()

export function getHubTheme(): ThemeId {
  try {
    const v = localStorage.getItem(KEY)
    return THEMES.some((t) => t.id === v) ? (v as ThemeId) : 'amber'
  } catch {
    return 'amber'
  }
}

export function setHubTheme(id: ThemeId) {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* storage unavailable: the choice lasts until reload */
  }
  current = id
  listeners.forEach((f) => f())
}

let current: ThemeId = getHubTheme()

/** The chosen theme; every picker and the Hub stay in step. */
export function useHubTheme(): ThemeId {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f)
      return () => listeners.delete(f)
    },
    () => current,
  )
}

export const swatchBg = (t: HubTheme) => `conic-gradient(${t.swatch[0]}, ${t.swatch[1]}, ${t.swatch[2]}, ${t.swatch[0]})`
