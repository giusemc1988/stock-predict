import { useEffect, useRef, useState } from 'react'

const NUM = /-?\d[\d,]*(?:\.\d+)?/g
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Splits "+$10,000.00" into prefix "+$", 10000, suffix "", 2 decimals, grouped. Only text with exactly one number counts up. */
function parse(text: string) {
  const hits = text.match(NUM)
  if (!hits || hits.length !== 1) return null
  const raw = hits[0]
  const at = text.indexOf(raw)
  const dec = raw.split('.')[1]?.length ?? 0
  return { pre: text.slice(0, at), post: text.slice(at + raw.length), value: Number(raw.replace(/,/g, '')), dec, group: raw.includes(',') }
}

const canRun = (text: string) => {
  const p = parse(text)
  return !!p && p.value !== 0 && !reduced()
}
const zero = (text: string) => {
  const p = parse(text)!
  return `${p.pre}${(0).toFixed(p.dec)}${p.post}`
}

/**
 * Shows `text`, but the first time it holds a real number, that number runs from 0 up to the value (~0.8s, ease-out).
 * After that live values show as they are. Text with no number or several numbers ("3/3", "v0.8.14") is shown as is.
 */
export function CountUp({ text, ms = 800 }: { text: string; ms?: number }) {
  // 'wait': no number yet (e.g. "—" while loading); 'run': counting; 'done': show the live text
  const [phase, setPhase] = useState<'wait' | 'run' | 'done'>(() => (canRun(text) ? 'run' : parse(text) || reduced() ? 'done' : 'wait'))
  const [shown, setShown] = useState(() => (canRun(text) ? zero(text) : text))
  const target = useRef(text)
  useEffect(() => {
    target.current = text
    if (phase !== 'wait') return
    if (canRun(text)) {
      setShown(zero(text))
      setPhase('run')
    } else if (parse(text)) setPhase('done')
  }, [text, phase])

  useEffect(() => {
    if (phase !== 'run') return
    const t0 = performance.now()
    let raf = 0
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms)
      const cur = parse(target.current)
      if (k >= 1 || !cur) return setPhase('done')
      const v = cur.value * (1 - Math.pow(1 - k, 3))
      setShown(`${cur.pre}${v.toLocaleString('en-US', { minimumFractionDigits: cur.dec, maximumFractionDigits: cur.dec, useGrouping: cur.group })}${cur.post}`)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [phase, ms])

  return <>{phase === 'run' ? shown : text}</>
}
