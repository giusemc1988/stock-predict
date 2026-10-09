import { useEffect, useState } from 'react'

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return initial
      const parsed = JSON.parse(raw)
      // Arrays (like the added-tickers list) must stay arrays; spreading them would turn them into objects.
      return Array.isArray(initial) ? parsed : { ...initial, ...parsed }
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* storage unavailable: keep in memory */
    }
  }, [key, value])
  return [value, setValue] as const
}
