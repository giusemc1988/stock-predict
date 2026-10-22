import { fmtPct, fmtUsd, tone } from '../lib/format'
import { useHubT } from '../lib/hubText'
import { useLang } from '../lib/i18n'
import { practiceEquity, PRACTICE_START, type PracticeState } from '../lib/practice'
import { RUVIEW } from '../lib/ruview'
import { CLUSTERS, TOOLS, toolOpen, type ClusterId, type HubPage } from '../lib/toolHub'
import { StatRow, type IconName, type Stat } from './StatCard'

interface Props {
  practice: PracticeState
  buys: number
  on: { net: boolean; ruview: boolean }
  /** Open a page of the app (the same targets the Tool Hub opens). */
  onPage: (p: HubPage) => void
}

const ICON: Record<ClusterId, IconName> = { trading: 'trend', esp32: 'chip', network: 'wifi', build: 'code', studio: 'film' }
// where a group's card goes: its main page, or the Tool Hub for groups made of links
const OPENS: Partial<Record<ClusterId, HubPage>> = { esp32: 'ruview-flash', network: 'net' }

/** One card per project the hub runs, in each project's Tool Hub colour. Every number comes from data the hub already has. */
export function HubProjects({ practice, buys, on, onPage }: Props) {
  const t = useHubT()
  const vi = useLang() === 'vi'
  const tone_ = (id: ClusterId) => CLUSTERS.find((c) => c.id === id)!.tone
  const label = (id: ClusterId) => {
    const l = CLUSTERS.find((c) => c.id === id)!.label
    return vi ? l.vi : l.en
  }
  const equity = practiceEquity(practice)
  const change = (equity / PRACTICE_START - 1) * 100
  const toHub = () => document.getElementById('hub-tools')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const trading: Stat = {
    key: 'trading',
    label: label('trading'),
    icon: ICON.trading,
    accent: tone_('trading'),
    value: fmtUsd(equity),
    chip: { text: fmtPct(change), tone: tone(change) },
    sub: t('pjTradingSub', { b: buys, n: practice.open.length }),
    title: t('pjVsStart'),
    onClick: () => onPage('trade'),
  }
  const ruview: Stat = {
    key: 'ruview',
    label: 'RuView',
    icon: 'radar',
    accent: '#5fd6c8',
    value: RUVIEW.release.replace(/-.*$/, ''),
    chip: on.ruview ? { text: t('pjBeta'), tone: 'info', icon: 'radar' } : { text: t('pjOff'), tone: 'flat' },
    sub: t('pjRuviewSub'),
    title: t('pjRuviewTitle'),
    onClick: () => onPage('ruview'),
    disabled: !on.ruview,
  }
  const groups: Stat[] = CLUSTERS.filter((c) => c.id !== 'trading').map((c) => {
    const mine = TOOLS.filter((n) => n.cluster === c.id)
    const ready = mine.filter((n) => toolOpen(n, on)).length
    const soon = mine.filter((n) => n.action.kind === 'soon').length
    const page = OPENS[c.id]
    const pageOn = page !== 'net' || on.net
    return {
      key: c.id,
      label: label(c.id),
      icon: ICON[c.id],
      accent: c.tone,
      value: `${ready}/${mine.length}`,
      chip: soon ? { text: t('pjSoonN', { n: soon }), tone: 'warn', icon: 'clock' } : ready === mine.length ? { text: t('pjReady'), tone: 'up', icon: 'check' } : { text: t('pjOff'), tone: 'flat' },
      sub: t('pjToolsReady'),
      onClick: page && pageOn && (page !== 'ruview-flash' || on.ruview) ? () => onPage(page) : toHub,
    }
  })

  return (
    <section className="hub-projects" aria-label={t('pjTitle')}>
      <StatRow items={[trading, ruview, ...groups]} className="sc-projects" />
    </section>
  )
}
