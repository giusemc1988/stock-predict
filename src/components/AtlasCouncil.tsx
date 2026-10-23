import { useEffect, useRef, useState } from 'react'
import { watchOnScreen } from '../lib/onScreen'
import type { Vote } from '../lib/hub'
import { COUNCIL_IDS, type CouncilId } from '../lib/kronosView'

export interface CouncilVote {
  id: CouncilId
  vote: Vote
  why: string
}

const RGB: Record<Vote, string> = { yes: '143,220,165', no: '240,154,142', none: '231,173,99' }
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

interface Neuron {
  x: number
  y: number
  z: number
  ph: number
}
const makeNeurons = (n: number): Neuron[] =>
  Array.from({ length: n }, () => {
    const u = Math.random() * 2 - 1
    const th = Math.random() * Math.PI * 2
    const r = 0.25 + 0.7 * Math.cbrt(Math.random())
    const s = Math.sqrt(1 - u * u)
    return { x: s * Math.cos(th) * r, y: u * r, z: s * Math.sin(th) * r, ph: Math.random() * 6.28 }
  })

/**
 * The back of the Atlas card: the 7 agents in glass cards round a living brain. The agent
 * speaking glows, its signal drifts into the brain as a spark, the brain leans toward it and
 * neurons fire inside while it thinks. One canvas; it only runs while the card is turned over.
 */
export function AtlasCouncil({ votes, active, label, voteText }: { votes: CouncilVote[]; active: boolean; label: (id: CouncilId) => string; voteText: (v: Vote) => string }) {
  const stage = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [act, setAct] = useState(0)
  const [narrow, setNarrow] = useState(false)
  const [ring, setRing] = useState({ rx: 0.365, ry: 0.385 })
  const voteRef = useRef(votes)
  useEffect(() => {
    voteRef.current = votes
  }, [votes])

  useEffect(() => {
    const st = stage.current
    const cv = canvas.current
    const ctx = cv?.getContext('2d')
    if (!st || !cv || !ctx || !active) return
    const reduce = reduceMotion()
    const n = COUNCIL_IDS.length
    const ang = COUNCIL_IDS.map((_, j) => -Math.PI / 2 + (j * 2 * Math.PI) / n)
    let pos = ang.map(() => ({ x: 0, y: 0 }))
    const size = () => {
      const w = st.clientWidth
      const h = st.clientHeight
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      cv.width = w * dpr
      cv.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      // a round ring even when the card is tall and narrow (phones)
      const ry = h > w * 1.3 ? h * 0.34 : Math.min(h * 0.385, w * 0.56)
      pos = ang.map((a) => ({ x: w / 2 + Math.cos(a) * w * 0.365, y: h / 2 + Math.sin(a) * ry }))
      setNarrow(w < 420)
      setRing({ rx: 0.365, ry: ry / h })
    }
    size()
    const ro = new ResizeObserver(size)
    ro.observe(st)

    const N = makeNeurons(120)
    let fires: { a: number; b: number; t: number; c: string }[] = []
    let sparks: { j: number; t: number; off: number }[] = []
    let speaker = 0
    let last = -1e9
    const lean = { x: 0, y: 0 }
    let raf = 0

    const edge = (a: number, t: number, R: number) => {
      let k = 1 + 0.05 * Math.sin(3 * a + t * 0.0011) + 0.03 * Math.sin(4 * a - t * 0.0017) + 0.015 * Math.sin(6 * a + t * 0.0023)
      k += 0.08 * Math.max(0, Math.cos(a - ang[speaker])) ** 4
      return R * k * (1 + 0.025 * Math.sin(t * 0.0021))
    }

    const seen = watchOnScreen(st)
    const frame = (t: number) => {
      // scrolled away: keep the loop alive but draw nothing
      if (!reduce && !seen.visible) {
        raf = requestAnimationFrame(frame)
        return
      }
      const w = st.clientWidth
      const h = st.clientHeight
      const R = Math.min(w, h) * 0.165
      if (t - last > 1600) {
        last = t
        speaker = (speaker + 1) % n
        setAct(speaker)
        for (let s = 0; s < 6; s++) sparks.push({ j: speaker, t: t + s * 70, off: (Math.random() - 0.5) * 0.5 })
      }
      const tint = RGB[voteRef.current[speaker]?.vote ?? 'none']
      lean.x += (Math.cos(ang[speaker]) * R * 0.12 - lean.x) * 0.04
      lean.y += (Math.sin(ang[speaker]) * R * 0.12 - lean.y) * 0.04
      const cx = w / 2 + lean.x
      const cy = h / 2 + lean.y
      ctx.clearRect(0, 0, w, h)

      const halo = ctx.createRadialGradient(cx, cy, R * 0.4, cx, cy, R * 2)
      halo.addColorStop(0, 'rgba(170,160,255,.2)')
      halo.addColorStop(1, 'rgba(170,160,255,0)')
      ctx.fillStyle = halo
      ctx.beginPath()
      ctx.arc(cx, cy, R * 2, 0, 7)
      ctx.fill()

      // each agent's signal drifts in as a soft light, no line
      sparks = sparks.filter((sp) => {
        const k = (t - sp.t) / 1100
        if (k < 0) return true
        if (k > 1) return false
        const p0 = pos[sp.j]
        const px = p0.x + (cx - p0.x) * 0.38
        const py = p0.y + (cy - p0.y) * 0.38
        const e = k * k * (3 - 2 * k)
        const bend = sp.off * Math.sin(Math.PI * k) * 0.3
        const x = px + (cx - px) * e - (py - cy) * bend
        const y = py + (cy - py) * e + (px - cx) * bend
        const c = RGB[voteRef.current[sp.j]?.vote ?? 'none']
        const g = ctx.createRadialGradient(x, y, 0, x, y, 9)
        g.addColorStop(0, `rgba(${c},${(0.9 * (1 - k * 0.6)).toFixed(2)})`)
        g.addColorStop(1, `rgba(${c},0)`)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(x, y, 9, 0, 7)
        ctx.fill()
        return true
      })

      const sh = ctx.createRadialGradient(cx, cy + R * 1.05, 0, cx, cy + R * 1.05, R)
      sh.addColorStop(0, 'rgba(0,0,0,.22)')
      sh.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = sh
      ctx.beginPath()
      ctx.ellipse(cx, cy + R * 1.05, R, R * 0.25, 0, 0, 7)
      ctx.fill()

      // the membrane: breathing, wobbling, lit from the upper left so it reads as 3D
      ctx.save()
      ctx.beginPath()
      for (let i = 0; i <= 160; i++) {
        const a = (i / 160) * Math.PI * 2
        const rr = edge(a, t, R)
        if (i) ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
        else ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
      }
      ctx.closePath()
      const body = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R * 1.25)
      body.addColorStop(0, 'rgba(236,226,255,.55)')
      body.addColorStop(0.35, 'rgba(150,140,235,.38)')
      body.addColorStop(0.75, 'rgba(92,60,140,.42)')
      body.addColorStop(1, 'rgba(40,24,60,.6)')
      ctx.fillStyle = body
      ctx.fill()
      ctx.lineWidth = 1.4
      ctx.strokeStyle = 'rgba(255,240,255,.35)'
      ctx.stroke()
      ctx.clip()

      // neurons, turning slowly, brighter at the front
      const rot = reduce ? 0.5 : t / 6400
      const cs = Math.cos(rot)
      const sn = Math.sin(rot)
      const P = N.map((p) => {
        const wob = 1 + 0.08 * Math.sin(t * 0.0013 + p.ph)
        const x = (p.x * cs - p.z * sn) * wob
        const z = (p.x * sn + p.z * cs) * wob
        const d = (z + 1) / 2
        const q = { x: cx + x * R * 0.92, y: cy + p.y * wob * R * 0.92 }
        ctx.fillStyle = `rgba(235,230,255,${(0.18 + 0.6 * d).toFixed(2)})`
        ctx.beginPath()
        ctx.arc(q.x, q.y, 0.6 + 1.6 * d, 0, 7)
        ctx.fill()
        return q
      })
      // thinking: short chains of neurons fire, some in the colour of the vote just heard
      if (!reduce && Math.random() < 0.35) {
        const a0 = (Math.random() * P.length) | 0
        let best = -1
        let bd = 1e9
        for (let b = 0; b < P.length; b++) {
          if (b === a0) continue
          const dd = (P[b].x - P[a0].x) ** 2 + (P[b].y - P[a0].y) ** 2
          if (dd > R * R * 0.04 && dd < bd) {
            bd = dd
            best = b
          }
        }
        if (best >= 0) fires.push({ a: a0, b: best, t, c: Math.random() < 0.5 ? tint : '200,210,255' })
      }
      fires = fires.filter((f) => {
        const k = (t - f.t) / 650
        if (k > 1) return false
        const A = P[f.a]
        const B = P[f.b]
        const al = Math.sin(Math.PI * k)
        ctx.strokeStyle = `rgba(${f.c},${(0.75 * al).toFixed(2)})`
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(A.x, A.y)
        ctx.lineTo(B.x, B.y)
        ctx.stroke()
        const g = ctx.createRadialGradient(B.x, B.y, 0, B.x, B.y, 6)
        g.addColorStop(0, `rgba(${f.c},${al.toFixed(2)})`)
        g.addColorStop(1, `rgba(${f.c},0)`)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(B.x, B.y, 6, 0, 7)
        ctx.fill()
        return true
      })
      ctx.restore()

      // wet highlight on top
      const hx = cx - R * 0.38
      const hy = cy - R * 0.45
      const hl = ctx.createRadialGradient(hx, hy, 0, hx, hy, R * 0.42)
      hl.addColorStop(0, 'rgba(255,255,255,.42)')
      hl.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = hl
      ctx.beginPath()
      ctx.ellipse(hx, hy, R * 0.42, R * 0.28, -0.5, 0, 7)
      ctx.fill()

      if (!reduce) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      seen.stop()
    }
  }, [active])

  return (
    <div className={`hg-council3${narrow ? ' narrow' : ''}`} ref={stage}>
      <canvas ref={canvas} aria-hidden="true" />
      {COUNCIL_IDS.map((id, j) => {
        const a = -Math.PI / 2 + (j * 2 * Math.PI) / COUNCIL_IDS.length
        const v = votes.find((x) => x.id === id)
        return (
          <div
            key={id}
            className={`hg-cnode${active && j === act ? ' act' : ''}`}
            style={{ left: `${50 + Math.cos(a) * ring.rx * 100}%`, top: `${50 + Math.sin(a) * ring.ry * 100}%` }}
            title={v?.why}
          >
            <small>{String(j + 1).padStart(2, '0')}</small>
            <b>{label(id)}</b>
            <span>{v?.why}</span>
            <em className={`v-${v?.vote ?? 'none'}`}>
              <i />
              {voteText(v?.vote ?? 'none')}
            </em>
          </div>
        )
      })}
    </div>
  )
}
