import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { watchOnScreen } from '../lib/onScreen'
import { AGENT_COLORS as COLORS } from '../lib/hub'
import type { BriefNode, NodeId } from '../lib/brief'
import { useLang } from '../lib/i18n'

const GREY: [number, number, number] = [110, 124, 148]
const CORE: [number, number, number] = [255, 226, 170]
/** Where each node sits on the orbit, degrees (inputs on the left, outputs on the right). */
const ANGLES = [215, 180, 145, 325, 0, 35]
const rgba = (c: number[], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`

function layout(W: number, H: number) {
  const narrow = W < 560
  const R = Math.min(W * 0.19, H * 0.26)
  const Rd = R * 1.22
  const cx = W / 2
  const cy = H * (narrow ? 0.5 : 0.48)
  const ox = Math.min(W / 2 - (narrow ? 42 : 76), R * (narrow ? 2.2 : 2.45))
  const oy = R * (narrow ? 2 : 1.5)
  const nodes = ANGLES.map((a) => {
    const t = (a * Math.PI) / 180
    return { x: cx + ox * Math.cos(t), y: cy + oy * Math.sin(t), t }
  })
  return { narrow, R, Rd, cx, cy, nodes, r: narrow ? 9 : 13 }
}

function sprite(c: number[]) {
  const s = document.createElement('canvas')
  s.width = s.height = 64
  const x = s.getContext('2d')!
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.18, rgba(c, 0.95))
  g.addColorStop(0.45, rgba(c, 0.25))
  g.addColorStop(1, rgba(c, 0))
  x.fillStyle = g
  x.fillRect(0, 0, 64, 64)
  return s
}

interface Pt {
  x: number
  y: number
  z: number
  c: number
  core: boolean
  s: number
  tw: number
}

/** Memory particles: one per note Neo has, up to a cap; each cluster is one node's color. */
function particles(n: number): Pt[] {
  let seed = 7
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 0.8
  const unit = () => {
    const z = rnd() * 2 - 1
    const t = rnd() * Math.PI * 2
    const s = Math.sqrt(1 - z * z)
    return [s * Math.cos(t), s * Math.sin(t), z]
  }
  const centers = COLORS.map(unit)
  const out: Pt[] = []
  for (let i = 0; i < n; i++) {
    const c = i % 6
    let p: number[]
    let r: number
    if (rnd() < 0.42) {
      const d = centers[c]
      p = [d[0] + gauss() * 0.32, d[1] + gauss() * 0.32, d[2] + gauss() * 0.32]
      const m = Math.hypot(p[0], p[1], p[2]) || 1
      r = 0.5 + rnd() * 0.5
      p = p.map((v) => (v / m) * r)
    } else {
      r = Math.pow(rnd(), 0.9)
      p = unit().map((v) => v * r)
    }
    out.push({ x: p[0], y: p[1], z: p[2], c, core: r < 0.32, s: 0.5 + rnd() * 1.3, tw: rnd() * 6.28 })
  }
  return out
}

interface Props {
  nodes: BriefNode[]
  /** Notes in Neo's memory (journal, practice trades, learner tests): sets the particle count. */
  memory: number
  thinking: boolean
  motion: boolean
  onNode: (id: NodeId) => void
}

/** Neo's second brain: memory particles in a dial, fed by the nodes around it. Draws only; makes no network calls. */
export function BrainCore({ nodes, memory, thinking, motion, onNode }: Props) {
  const lang = useLang()
  const L = (b: { en: string; vi: string }) => (lang === 'vi' ? b.vi : b.en)
  const wrap = useRef<HTMLDivElement>(null)
  const cv = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ W: 0, H: 0 })
  const live = useRef({ nodes, thinking })
  live.current = { nodes, thinking }
  const flare = useRef([0, 0, 0, 0, 0, 0])
  const lastNotes = useRef<string[]>([])
  // a cluster lights up only when its node's real data changes
  useEffect(() => {
    nodes.forEach((n, i) => {
      const k = n.note.en
      if (lastNotes.current[i] !== undefined && lastNotes.current[i] !== k) flare.current[i] = 1
      lastNotes.current[i] = k
    })
  }, [nodes])

  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ W: el.clientWidth, H: el.clientHeight }))
    ro.observe(el)
    setSize({ W: el.clientWidth, H: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const stillKey = motion ? '' : nodes.map((n) => `${n.status}${n.load}`).join()
  const count = Math.max(250, Math.min(size.W < 560 ? 1000 : 1700, Math.round(memory / 25) * 25))
  useEffect(() => {
    const c = cv.current
    const { W, H } = size
    if (!c || !W || !H) return
    const g = c.getContext('2d')!
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    c.width = W * dpr
    c.height = H * dpr
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    const lay = layout(W, H)
    const { R, Rd, cx, cy } = lay
    const pts = particles(count)
    const SPR = COLORS.map(sprite)
    const SPR_GREY = sprite(GREY)
    const SPR_CORE = sprite(CORE)
    const prev = ANGLES.map(() => [0, 0])
    let ripples: number[] = []
    let lastRipple = -9
    let raf = 0
    const seen = watchOnScreen(c)

    const frame = (t: number) => {
      // scrolled away: keep the loop alive but draw nothing
      if (motion && !seen.visible) {
        raf = requestAnimationFrame(frame)
        return
      }
      const time = t / 1000
      const { nodes: ns, thinking: busy } = live.current
      g.clearRect(0, 0, W, H)
      const beat = Math.pow((Math.sin(time * (busy ? 3.2 : 2.2)) + 1) / 2, 3)

      if (time - lastRipple > 2.4) {
        ripples.push(time)
        lastRipple = time
      }
      ripples = ripples.filter((r0) => time - r0 < 6)
      g.lineWidth = 1
      for (const r0 of ripples) {
        const k = (time - r0) / 6
        g.strokeStyle = `rgba(89,214,255,${(1 - k) * 0.14})`
        g.beginPath()
        g.arc(cx, cy, Rd + 24 + k * Math.max(W, H) * 0.55, 0, 7)
        g.stroke()
      }
      for (let i = 0; i < 6; i++) flare.current[i] *= 0.96

      // dial: ring, turning ticks, arcs
      g.strokeStyle = 'rgba(89,214,255,0.32)'
      g.beginPath()
      g.arc(cx, cy, Rd, 0, 7)
      g.stroke()
      g.save()
      g.translate(cx, cy)
      g.rotate(time * 0.03)
      g.strokeStyle = 'rgba(150,222,255,0.42)'
      g.beginPath()
      for (let i = 0; i < 180; i++) {
        const a = (i / 180) * Math.PI * 2
        const r1 = Rd + (i % 10 === 0 ? 11 : 6)
        g.moveTo(Math.cos(a) * (Rd + 3), Math.sin(a) * (Rd + 3))
        g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1)
      }
      g.stroke()
      g.restore()
      const arcs = (r: number, list: number[][], col: number[], speed: number, w: number) => {
        g.lineCap = 'round'
        for (const [s, len] of list) {
          const a0 = s + time * speed
          g.strokeStyle = rgba(col, 0.18)
          g.lineWidth = w * 4
          g.beginPath()
          g.arc(cx, cy, r, a0, a0 + len)
          g.stroke()
          g.strokeStyle = rgba(col, 0.9)
          g.lineWidth = w
          g.beginPath()
          g.arc(cx, cy, r, a0, a0 + len)
          g.stroke()
        }
      }
      arcs(Rd + 20, [[0.2, 0.9], [2.4, 0.5], [4.1, 1.2]], COLORS[0], busy ? 0.5 : 0.18, 2)
      arcs(Rd - 9, [[1.1, 0.7], [3.9, 0.45]], COLORS[3], busy ? -0.4 : -0.13, 1.6)
      g.lineWidth = 1

      // the brain
      const yaw = time * 0.14
      const pitch = 0.38 + Math.sin(time * 0.11) * 0.1
      const cyw = Math.cos(yaw)
      const syw = Math.sin(yaw)
      const cp = Math.cos(pitch)
      const sp = Math.sin(pitch)
      const scale = R * (1 + beat * 0.025)
      g.globalCompositeOperation = 'lighter'
      const glow = g.createRadialGradient(cx, cy, 0, cx, cy, R * 0.75)
      glow.addColorStop(0, `rgba(255,236,190,${0.5 + beat * 0.2})`)
      glow.addColorStop(0.3, 'rgba(255,170,80,0.2)')
      glow.addColorStop(1, 'rgba(255,140,60,0)')
      g.fillStyle = glow
      g.beginPath()
      g.arc(cx, cy, R * 0.75, 0, 7)
      g.fill()
      for (const p of pts) {
        const x1 = p.x * cyw + p.z * syw
        const z1 = -p.x * syw + p.z * cyw
        const y2 = p.y * cp - z1 * sp
        const z2 = p.y * sp + z1 * cp
        const k = 2.8 / (2.8 - z2)
        const depth = (z2 + 1) / 2
        const on = ns[p.c]?.status === 'live'
        const f = flare.current[p.c]
        const tw = 0.75 + Math.sin(time * 2 + p.tw) * 0.25
        g.globalAlpha = Math.min(1, (0.16 + depth * 0.6) * tw * (on || p.core ? 1 : 0.45) + (p.core ? 0 : f * 0.6))
        const s = (p.s + (p.core ? 0.6 : 0) + f * 1.2) * (0.7 + depth * 0.6) * 3.2
        g.drawImage(p.core ? SPR_CORE : on ? SPR[p.c] : SPR_GREY, cx + x1 * scale * k - s, cy + y2 * scale * k - s, s * 2, s * 2)
      }
      g.globalAlpha = 1

      // links and data packets: inputs flow in, results flow out; nothing moves on a node without live data
      lay.nodes.forEach((n, i) => {
        const node = ns[i]
        if (!node) return
        const on = node.status === 'live'
        const col = on ? COLORS[i] : GREY
        const dx = cx + Rd * Math.cos(n.t)
        const dy = cy + Rd * Math.sin(n.t)
        const mx = (n.x + dx) / 2
        const my = (n.y + dy) / 2 + (n.y < cy - 1 ? -12 : n.y > cy + 1 ? 12 : 0)
        g.globalCompositeOperation = 'source-over'
        g.setLineDash(on ? [] : [3, 5])
        g.strokeStyle = rgba(col, on ? 0.24 : 0.2)
        g.beginPath()
        g.moveTo(n.x, n.y)
        g.quadraticCurveTo(mx, my, dx, dy)
        g.stroke()
        g.setLineDash([])
        if (!on) return
        g.globalCompositeOperation = 'lighter'
        for (let k = 0; k < 2; k++) {
          const ph = (time * 0.32 + i * 0.17 + k / 2) % 1
          if (node.inbound && ph < prev[i][k]) flare.current[i] = Math.max(flare.current[i], 0.5)
          prev[i][k] = ph
          const tt = node.inbound ? ph : 1 - ph
          const u = 1 - tt
          const px = u * u * n.x + 2 * u * tt * mx + tt * tt * dx
          const py = u * u * n.y + 2 * u * tt * my + tt * tt * dy
          g.globalAlpha = Math.sin(ph * Math.PI)
          g.drawImage(SPR[i], px - 7, py - 7, 14, 14)
        }
        g.globalAlpha = 1
      })

      // node rings: how full each one is
      g.globalCompositeOperation = 'source-over'
      lay.nodes.forEach((n, i) => {
        const node = ns[i]
        if (!node) return
        const on = node.status === 'live'
        const col = on ? COLORS[i] : GREY
        const r = lay.r
        g.fillStyle = '#060b16'
        g.beginPath()
        g.arc(n.x, n.y, r + 4, 0, 7)
        g.fill()
        g.lineCap = 'round'
        g.lineWidth = 3
        g.strokeStyle = 'rgba(255,255,255,0.09)'
        g.beginPath()
        g.arc(n.x, n.y, r, 0, 7)
        g.stroke()
        if (node.load > 0) {
          g.strokeStyle = rgba(col, 0.95)
          g.beginPath()
          g.arc(n.x, n.y, r, -Math.PI / 2, -Math.PI / 2 + Math.min(0.999, node.load) * Math.PI * 2)
          g.stroke()
        }
        g.globalCompositeOperation = 'lighter'
        const s = (on ? 8 : 5) + flare.current[i] * 6
        g.drawImage(on ? SPR[i] : SPR_GREY, n.x - s, n.y - s, s * 2, s * 2)
        g.globalCompositeOperation = 'source-over'
      })
      g.lineWidth = 1
      if (motion) raf = requestAnimationFrame(frame)
    }
    if (motion) raf = requestAnimationFrame(frame)
    else frame(4000)
    return () => {
      cancelAnimationFrame(raf)
      seen.stop()
    }
    // a still picture (motion off) is redrawn when the data changes
  }, [size, count, motion, stillKey])

  const lay = size.W ? layout(size.W, size.H) : null
  const liveCount = nodes.filter((n) => n.status === 'live').length
  return (
    <div className="core-stage" ref={wrap}>
      <canvas ref={cv} aria-hidden="true" />
      <div className="core-hud">
        <b>NEO · ORCHESTRATOR</b>
        <span>
          <i className={liveCount ? 'up' : 'muted'}>●</i> {lang === 'vi' ? `${liveCount}/${nodes.length} nguồn đang chạy` : `${liveCount} of ${nodes.length} feeds live`}
        </span>
      </div>
      {lay &&
        nodes.map((n, i) => {
          const p = lay.nodes[i]
          return (
            <button
              key={n.id}
              className={`core-node ${n.status}`}
              style={{ left: p.x, top: p.y - lay.r - 6, ['--c' as string]: rgba(n.status === 'live' ? COLORS[i] : GREY, 1), ['--ring' as string]: `${lay.r * 2 + 12}px` }}
              onClick={() => onNode(n.id)}
              title={`${L(n.name)}: ${L(n.note)}. ${lang === 'vi' ? 'Nguồn' : 'Source'}: ${n.source}`}
            >
              <b>{L(n.name)}</b>
              {!lay.narrow && <span>{L(n.note)}</span>}
            </button>
          )
        })}
      <div className="core-name">
        <b>NEO</b>
        <span>
          {lang === 'vi' ? 'bộ não thứ hai' : 'second brain'} · {memory.toLocaleString()} {lang === 'vi' ? 'ghi nhớ' : 'memories'}
        </span>
      </div>
    </div>
  )
}
