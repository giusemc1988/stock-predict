import { useEffect, useState } from 'react'

/**
 * The hub's rule: every scan or AI wait shows a bar. With a real `value` (0..1) it fills to it; without
 * one it creeps toward 90% over about `secs` seconds so a slow answer still looks alive, and jumps to the end when done.
 */
export function NovaProgress({ label, value, active = true, secs = 20 }: { label: string; value?: number; active?: boolean; secs?: number }) {
  const [creep, setCreep] = useState(0)
  useEffect(() => {
    if (!active || value !== undefined) return
    setCreep(0)
    const t0 = performance.now()
    const id = setInterval(() => setCreep(0.9 * (1 - Math.exp(-(performance.now() - t0) / 1000 / (secs / 3)))), 200)
    return () => clearInterval(id)
  }, [active, value, secs])
  if (!active) return null
  const pct = Math.round((value ?? creep) * 100)
  return (
    <div className="nv-prog" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className="nv-prog-row small"><span>{label}</span><b>{pct}%</b></div>
      <div className="nv-prog-track"><i style={{ width: `${pct}%` }} /></div>
    </div>
  )
}
