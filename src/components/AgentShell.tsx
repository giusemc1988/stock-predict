import type { CSSProperties, ReactNode } from 'react'
import { PROJECTS, type ProjectId } from '../lib/projects'
import { useHubTheme } from '../lib/themes'
import { AgentFace } from './AgentFace'
import { LangSwitch } from './HubPanels'
import { ProjectLogo } from './ProjectLogo'
import './JarvisHub.css'
import './AgentShell.css'

/**
 * One agent's main page in the Neo Hub's glass look: the Hub wallpaper and theme, a glass top bar
 * (back, page title, status, language) and a hero with the agent's character, logo, name and tagline.
 * The page's own cards go in `children`; AgentShell.css gives the shared card classes (bf-card, sc,
 * net-row, …) the glass treatment. glass=false keeps the plain header, so the AI rule agentGlass can turn it off.
 */
export function AgentShell({
  id,
  title,
  sub,
  onBack,
  backLabel = '← Hub',
  status,
  actions,
  glass = true,
  className = '',
  children,
}: {
  id: ProjectId
  /** what the top bar says, e.g. "Echo · RuView sensing" */
  title: ReactNode
  /** one line under the agent's name */
  sub: ReactNode
  onBack: () => void
  backLabel?: string
  /** a short status (dot + words) shown on the right of the top bar */
  status?: ReactNode
  /** buttons or links shown under the tagline */
  actions?: ReactNode
  glass?: boolean
  className?: string
  children: ReactNode
}) {
  const theme = useHubTheme()
  const p = PROJECTS.find((x) => x.id === id)
  const hue = p?.hue ?? '#d9a3ff'
  const name = p?.name ?? id

  if (!glass)
    return (
      <main className={`net-page ${className}`}>
        <div className="hub-head">
          <div className="net-title">
            <button className="btn net-back" onClick={onBack}>{backLabel}</button>
            <span className="hub-hello">{title}</span>
          </div>
          <div className="net-status">
            {status}
            <LangSwitch />
          </div>
        </div>
        {actions && <div className="ag-acts">{actions}</div>}
        {children}
      </main>
    )

  return (
    <main className={`net-page ag hg ag-${id} ${className}`} data-theme={theme} style={{ '--k': hue } as CSSProperties}>
      <div className="hg-wall" aria-hidden="true">
        <i className="hg-b1" />
        <i className="hg-b2" />
        <i className="hg-b3" />
      </div>
      <div className="hg-wrap ag-wrap">
        <header className="ag-bar hg-glass">
          <button className="btn net-back" onClick={onBack}>{backLabel}</button>
          <b className="ag-bar-t">{title}</b>
          {status && <span className="ag-status">{status}</span>}
          <LangSwitch />
        </header>

        <section className="ag-hero">
          <div className="ag-face" aria-hidden="true"><AgentFace id={id} hue={hue} /></div>
          <div className="ag-hero-t">
            <h1 className="ag-brand"><ProjectLogo id={id} hue={hue} className="ag-logo" />{name}</h1>
            <p className="ag-tag">{sub}</p>
            {actions && <div className="ag-acts">{actions}</div>}
          </div>
        </section>

        {children}
      </div>
    </main>
  )
}
