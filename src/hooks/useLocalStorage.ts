import { useEffect, useState } from 'react'

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return initial
      const saved = JSON.parse(raw)
      // arrays are stored whole; objects are merged over the defaults so new fields get a value
      if (Array.isArray(initial)) return (Array.isArray(saved) ? saved : initial) as T
      return saved && typeof saved === 'object' ? { ...initial, ...saved } : initial
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
