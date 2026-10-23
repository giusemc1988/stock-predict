import type { BriefNode } from '../lib/brief'
import { fmtPct, tone } from '../lib/format'
import { AGENT_COLORS, agentVotes, agreeCount, type AgentVote, type VoteContext } from '../lib/hub'
import { useHubT, type Bi, type HubKey } from '../lib/hubText'
import { setLang, useLang } from '../lib/i18n'
import type { PickRow } from '../lib/practice'
import { pickSourceLabel } from '../lib/practicePicks'
import { SkRows } from './Skeleton'

const rgb = (i: number, a = 1) => `rgba(${AGENT_COLORS[i].join(',')},${a})`

/** Six dots, one per agent on the sphere, in the sphere's colors: filled agrees, ring disagrees, faint has no data. */
export function AgentDots({ votes, nodes }: { votes: AgentVote[]; nodes: BriefNode[] }) {
  const vi = useLang() === 'vi'
  const t = useHubT()
  return (
    <span className="hub-dots" role="img" aria-label={t('agentsAgree', { n: agreeCount(votes) })}>
      {votes.map((v, i) => {
        const name = nodes.find((n) => n.id === v.id)?.name ?? { en: v.id, vi: v.id }
        return <i key={v.id} className={`v-${v.vote}`} style={{ ['--c' as string]: rgb(i) }} title={`${vi ? name.vi : name.en}: ${vi ? v.why.vi : v.why.en}`} />
      })}
    </span>
  )
}

/** The language switch on the hub, the same setting as Settings > Language. */
export function LangSwitch() {
  const lang = useLang()
  const t = useHubT()
  return (
    <div className="seg small hub-lang" role="group" aria-label={t('language')}>
      <button className={lang === 'vi' ? 'on' : ''} onClick={() => setLang('vi')}>VI</button>
      <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
    </div>
  )
}

interface PickProps {
  picks: PickRow[]
  ctx: VoteContext
  nodes: BriefNode[]
  scanOn: boolean
  onOpen: (p: PickRow) => void
  onWhy: (p: PickRow) => void
  onDesk: () => void
  /** The first scan has not finished yet (Dashboard cards and motion): show grey placeholders. */
  loading?: boolean
}

/** Today's best pick next to the sphere: the scanner's #1 BUY with what each agent thinks of it. */
export function HubBestPick({ picks, ctx, nodes, scanOn, onOpen, onWhy, onDesk, loading }: PickProps) {
  const vi = useLang() === 'vi'
  const t = useHubT()
  const L = (b: Bi) => (vi ? b.vi : b.en)
  const top = picks[0]
  if (!top && loading)
    return (
      <section className="hub-pick empty" aria-busy="true">
        <span className="hub-tag">{t('bestPick')}</span>
        <SkRows rows={3} cols={1} className="sk-pick" />
      </section>
    )
  if (!top)
    return (
      <section className="hub-pick empty">
        <span className="hub-tag">{t('bestPick')}</span>
        <p className="muted">{scanOn ? t('noPickYet') : t('scanOff')}</p>
        <div className="bf-acts">
          <button className="btn prime" onClick={onDesk}>{t('openTrading')}</button>
        </div>
      </section>
    )
  const votes = agentVotes(top, ctx)
  return (
    <section className="hub-pick">
      <header>
        <span className="hub-tag">{t('bestPick')}</span>
        <span className="muted small">{L(pickSourceLabel[top.source])}</span>
      </header>
      <button className="hub-sym" onClick={() => onOpen(top)}>
        <b className="mono">{top.symbol}</b>
        <span className={`mono ${tone(top.gainPct ?? 0)}`}>{top.gainPct != null ? fmtPct(top.gainPct) : ''}</span>
      </button>
      <div className="hub-score">
        <div className="hub-bar"><i style={{ width: `${Math.max(4, Math.min(100, top.tradeScore ?? 0))}%` }} /></div>
        <span className="small"><b className="mono">{top.tradeScore != null ? Math.round(top.tradeScore) : '—'}</b> {t('tradeScore')}</span>
      </div>
      <div className="hub-kv">
        <div><span>{t('analyst')}</span><b className={top.verdict === 'BUY' ? 'up' : top.verdict === 'SELL' ? 'down' : ''}>{top.verdict ?? '—'}</b></div>
        <div><span>{t('volVsAvg')}</span><b className="mono">{top.volVsAvg != null ? `${top.volVsAvg.toFixed(1)}×` : '—'}</b></div>
        <div><span>{t('rank')}</span><b className="mono">#{top.place}</b></div>
      </div>
      <div className="hub-agree">
        <span className="small muted">{t('agentsAgree', { n: agreeCount(votes) })}</span>
        <div className="hub-chips">
          {votes.map((v, i) => {
            const name = nodes.find((x) => x.id === v.id)?.name
            return (
              <span key={v.id} className={`hub-chip v-${v.vote}`} style={{ ['--c' as string]: rgb(i) }} title={L(v.why)}>
                {name ? L(name) : v.id}
              </span>
            )
          })}
        </div>
      </div>
      <p className="hub-note small muted">{t('notProven')}</p>
      <div className="bf-acts">
        <button className="btn prime" onClick={onDesk}>{t('openTrading')}</button>
        <button className="btn" onClick={() => onWhy(top)}>{t('why')}</button>
      </div>
    </section>
  )
}

/** The prediction board: every BUY call with its score and the six agent dots. */
export function HubBoard({ picks, ctx, nodes, onOpen, onWhy, loading }: Omit<PickProps, 'onDesk' | 'scanOn'>) {
  const t = useHubT()
  return (
    <section className="bf-card hub-board" id="hub-board">
      <header>
        <h3>{t('board')}</h3>
        <span className="muted small">{t('boardDots')}</span>
      </header>
      {!picks.length && (loading ? <SkRows rows={4} cols={3} /> : <p className="muted">{t('boardEmpty')}</p>)}
      {picks.slice(0, 8).map((p) => (
        <div key={p.symbol} className="hub-brow">
          <button className="hub-brow-main" onClick={() => onOpen(p)}>
            <b className="mono">{p.symbol}</b>
            <span className="hub-bar"><i style={{ width: `${Math.max(4, Math.min(100, p.tradeScore ?? 0))}%` }} /></span>
            <span className="mono small">{p.tradeScore != null ? Math.round(p.tradeScore) : '—'}</span>
            <AgentDots votes={agentVotes(p, ctx)} nodes={nodes} />
          </button>
          <button className="bf-info-btn" onClick={() => onWhy(p)} title={t('signalFlow')}>ℹ</button>
        </div>
      ))}
      <p className="bf-source">{t('boardLegend')}</p>
    </section>
  )
}

const STUDIO: { k: string; t: HubKey; d: HubKey; c: string }[] = [
  { k: 'lab', t: 'mediaLab', d: 'mediaLabNote', c: '#ff8a6b' },
  { k: 'img', t: 'imageEdit', d: 'imageEditNote', c: '#4fe0c0' },
  { k: 'vid', t: 'videoEdit', d: 'videoEditNote', c: '#f2c45a' },
]

const OUTSIDE: { n: string; url: string; d: HubKey }[] = [
  { n: 'Kling', url: 'https://klingai.com', d: 'klingNote' },
  { n: 'CapCut', url: 'https://www.capcut.com', d: 'capcutNote' },
  { n: 'OpusClip', url: 'https://www.opus.pro', d: 'opusNote' },
  { n: 'Gemini', url: 'https://gemini.google.com', d: 'geminiNote' },
]

/** Studio: the creative tools around the predictor. The in-app tools come in later steps; the outside tools open in a new tab. */
export function HubStudio() {
  const t = useHubT()
  return (
    <section className="bf-card hub-studio" id="hub-studio">
      <header>
        <h3>{t('studio')}</h3>
        <span className="muted small">{t('comingSoon')}</span>
      </header>
      <div className="hub-tools">
        {STUDIO.map((s) => (
          <div key={s.k} className="hub-tool" style={{ ['--k' as string]: s.c }} aria-disabled="true">
            <b>{t(s.t)}</b>
            <span>{t(s.d)}</span>
            <em>{t('soon')}</em>
          </div>
        ))}
      </div>
      <details className="hub-outside">
        <summary>{t('outside')}</summary>
        {OUTSIDE.map((o) => (
          <a key={o.n} href={o.url} target="_blank" rel="noreferrer noopener">
            <b>{o.n}</b>
            <span>{t(o.d)}</span>
          </a>
        ))}
        <p className="bf-source">{t('outsideNote')}</p>
      </details>
    </section>
  )
}

const DEVICES: { k: string; t: HubKey | null; name?: string; d: HubKey; agent?: boolean; net?: boolean; rv?: boolean }[] = [
  { k: 'esp32', t: 'esp32', d: 'esp32Note' },
  { k: 'bay', t: null, name: 'BayReady', d: 'bayNote', agent: true },
  { k: 'net', t: 'homeNet', d: 'homeNetNote', net: true },
  { k: 'ble', t: 'ble', d: 'bleNote', net: true },
  { k: 'ruview', t: 'ruview', d: 'ruviewNote', rv: true },
]

/** Projects, devices and home network: what the hub connects to. Home network and Bluetooth open the Wi-Fi page, RuView its own page; the rest come in later steps. */
export function HubDevices({ onNet, onRuview }: { onNet?: () => void; onRuview?: () => void }) {
  const t = useHubT()
  return (
    <section className="bf-card hub-devices" id="hub-devices">
      <header>
        <h3>{t('devices')}</h3>
        <span className="muted small">{t('yoursOnly')}</span>
      </header>
      {DEVICES.map((d) => {
        const open = d.net ? onNet : d.rv ? onRuview : undefined
        const inner = (
          <>
            <i className={`led${open ? ' on' : ''}`} />
            <div>
              <b>{d.t ? t(d.t) : d.name}</b>
              <span>{t(d.d)}</span>
            </div>
            <em>{open ? t('openTool') : t('soon')}</em>
          </>
        )
        return open ? (
          <button key={d.k} className="hub-dev live" onClick={open}>{inner}</button>
        ) : (
          <div key={d.k} className={`hub-dev${d.agent ? ' agent' : ''}`}>{inner}</div>
        )
      })}
      <p className="bf-source">{t('devicesNote')}</p>
    </section>
  )
}

/** Phone tab bar for the hub. */
export function HubTabbar({ onDesk, tools = false, onHub }: { onDesk: () => void; tools?: boolean; onHub?: () => void }) {
  const t = useHubT()
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return (
    <nav className="hub-tabbar" aria-label={t('navLabel')}>
      <button className="on" onClick={() => go('hub-top')}><i />{t('tabPredict')}</button>
      <button onClick={onDesk}><i />{t('tabTrading')}</button>
      {onHub ? (
        <button onClick={onHub}><i />Hub</button>
      ) : tools ? (
        <button onClick={() => go('hub-board')}><i />{t('board')}</button>
      ) : (
        <button onClick={() => go('hub-devices')}><i />{t('tabDevices')}</button>
      )}
      <button onClick={() => go('hub-studio')}><i />{t('studio')}</button>
    </nav>
  )
}
