import { useMemo, useState } from 'react'
import { useLang } from '../lib/i18n'
import { CLUSTERS, TOOLS, graphLayout, searchTools, toolOpen, type HubPage, type ToolNode } from '../lib/toolHub'
import { useHubT } from '../lib/hubText'

type View = 'graph' | 'list'
const VIEW_KEY = 'bluechip.toolHubView'

function firstView(): View {
  try {
    const v = localStorage.getItem(VIEW_KEY)
    if (v === 'graph' || v === 'list') return v
  } catch {
    /* storage blocked: fall through */
  }
  // the graph's labels get too small on a phone, so phones start on the list
  return typeof window !== 'undefined' && window.matchMedia?.('(max-width: 700px)').matches ? 'list' : 'graph'
}

/** Tool Hub: every tool and project around Jarvis, as a graph or a list. Every item opens real work. */
export function ToolHub({ onPage, on, status = {} }: { onPage: (p: HubPage) => void; on: { net: boolean; ruview: boolean }; status?: Record<string, string> }) {
  const t = useHubT()
  const lang = useLang()
  const L = (b: { en: string; vi: string }) => b[lang]
  const [view, setView] = useState<View>(firstView)
  const [q, setQ] = useState('')
  const hits = useMemo(() => searchTools(q), [q])
  const lay = useMemo(() => graphLayout(), [])
  const searching = q.trim().length > 0

  const pick = (v: View) => {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* not kept; fine */
    }
  }
  const open = (n: ToolNode) => {
    if (!toolOpen(n, on)) return
    const a = n.action
    if (a.kind === 'page') onPage(a.page)
    else if (a.kind === 'url') window.open(a.url, '_blank', 'noopener,noreferrer')
    else if (a.kind === 'scroll') document.getElementById(a.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const stateOf = (n: ToolNode) => (n.action.kind === 'soon' ? t('soon') : toolOpen(n, on) ? (status[n.id] ?? (n.action.kind === 'url' ? t('thOpensTab') : t('openTool'))) : t('thOff'))

  return (
    <section className="bf-card th" id="hub-tools" aria-label={t('thTitle')}>
      <header>
        <h3>{t('thTitle')}</h3>
        <div className="seg small" role="tablist">
          <button role="tab" aria-selected={view === 'graph'} className={view === 'graph' ? 'on' : ''} onClick={() => pick('graph')}>{t('thGraph')}</button>
          <button role="tab" aria-selected={view === 'list'} className={view === 'list' ? 'on' : ''} onClick={() => pick('list')}>{t('thList')}</button>
        </div>
      </header>
      <input className="th-search" type="search" value={q} placeholder={t('thSearch')} aria-label={t('thSearch')} onChange={(e) => setQ(e.target.value)} />
      {searching && !hits.size && <p className="muted small">{t('thNone')}</p>}

      {view === 'graph' ? (
        <svg className="th-graph" viewBox={`0 0 ${lay.W} ${lay.H}`} role="group" aria-label={t('thTitle')}>
          {CLUSTERS.map((g) => {
            const gp = lay.groups.get(g.id)!
            return <line key={g.id} className="th-edge core" x1={lay.center.x} y1={lay.center.y} x2={gp.x} y2={gp.y} style={{ stroke: g.tone }} />
          })}
          {TOOLS.map((n) => {
            const gp = lay.groups.get(n.cluster)!
            const np = lay.nodes.get(n.id)!
            const g = CLUSTERS.find((c) => c.id === n.cluster)!
            return <line key={n.id} className={`th-edge${searching && !hits.has(n.id) ? ' dim' : ''}`} x1={gp.x} y1={gp.y} x2={np.x} y2={np.y} style={{ stroke: g.tone }} />
          })}
          <g className="th-core" transform={`translate(${lay.center.x} ${lay.center.y})`}>
            <circle r="30" />
            <text y="5" textAnchor="middle">Jarvis</text>
          </g>
          {CLUSTERS.map((g) => {
            const gp = lay.groups.get(g.id)!
            return (
              <g key={g.id} className="th-group" transform={`translate(${gp.x} ${gp.y})`} style={{ ['--k' as string]: g.tone }}>
                <circle r="9" />
                <text y="-15" textAnchor="middle">{L(g.label)}</text>
              </g>
            )
          })}
          {TOOLS.map((n) => {
            const np = lay.nodes.get(n.id)!
            const g = CLUSTERS.find((c) => c.id === n.cluster)!
            const live = toolOpen(n, on)
            const dim = searching && !hits.has(n.id)
            return (
              <g
                key={n.id}
                className={`th-node${live ? ' live' : ''}${dim ? ' dim' : ''}${searching && hits.has(n.id) ? ' hit' : ''}`}
                transform={`translate(${np.x} ${np.y})`}
                style={{ ['--k' as string]: g.tone }}
                role="button"
                tabIndex={live ? 0 : -1}
                aria-label={`${L(n.label)}: ${stateOf(n)}`}
                aria-disabled={!live}
                onClick={() => open(n)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open(n))}
              >
                <title>{`${L(n.label)} · ${L(n.note)}`}</title>
                <circle r="7" />
                <text y="21" textAnchor="middle">{L(n.label)}</text>
                <text className="th-state" y="34" textAnchor="middle">{stateOf(n)}</text>
              </g>
            )
          })}
        </svg>
      ) : (
        <div className="th-list">
          {CLUSTERS.map((g) => {
            const mine = TOOLS.filter((n) => n.cluster === g.id && hits.has(n.id))
            if (!mine.length) return null
            return (
              <div key={g.id} className="th-col" style={{ ['--k' as string]: g.tone }}>
                <h4>{L(g.label)}</h4>
                {mine.map((n) => {
                  const live = toolOpen(n, on)
                  return (
                    <button key={n.id} className={`th-item${live ? ' live' : ''}`} disabled={!live} onClick={() => open(n)}>
                      <b>{L(n.label)}</b>
                      <span>{L(n.note)}</span>
                      <em>{stateOf(n)}</em>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
      <p className="bf-source">{t('thNote')}</p>
    </section>
  )
}
