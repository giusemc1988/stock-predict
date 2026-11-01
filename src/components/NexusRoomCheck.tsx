/**
 * Nexus pocket scout, the easy part: one big "Check this room" button, a plain verdict, lists of possible
 * cameras / trackers with a "Find it" button, and the hot / cold finder. All logic lives in src/lib/nexusHunt.ts;
 * this only draws it. Everything is passive: the board listens, nothing is transmitted.
 */
import { useState } from 'react'
import { huntFill, huntRange, type Hit, type HuntState, type Reason, type RoomReport } from '../lib/nexusHunt'
import { useNetT } from '../lib/netText'
import { NovaProgress } from './NovaProgress'

type T = ReturnType<typeof useNetT>

const REASON_KEY = {
  ssid: 'hrSsid', oui: 'hrOui', hidden: 'hrHidden', open: 'hrOpen', chip: 'hrChip', name: 'hrName',
  near: 'hrNear', apple: 'hrApple', tile: 'hrTile', smarttag: 'hrSmarttag',
} as const

const reasonText = (t: T, r: Reason) => t(REASON_KEY[r.code], { x: r.arg ?? '' })

function HitList({ title, hits, usb, onFind, t }: { title: string; hits: Hit[]; usb: boolean; onFind: (h: Hit) => void; t: T }) {
  return (
    <div className="scout-hits">
      <b className="small">{title}: {hits.length === 0 ? t('huntNone') : hits.length}</b>
      {hits.map((h) => (
        <div key={h.id} className={`scout-hit ${h.score >= 3 ? 'hot' : ''}`}>
          <div>
            <b>{h.label}</b> <small className="mono muted">{h.rssi} dBm</small>
            <p className="small muted">{h.reasons.map((r) => reasonText(t, r)).join(' · ')}</p>
          </div>
          {usb && <button className="btn" onClick={() => onFind(h)}>{t('huntFind')}</button>}
        </div>
      ))}
    </div>
  )
}

export function NexusRoomCheck({
  connected, usb, running, report, hunting, onCheck, onFind, onStopFind,
}: {
  connected: boolean
  usb: boolean
  running: boolean
  report: RoomReport | null
  hunting: { target: Hit; state: HuntState } | null
  onCheck: () => void
  onFind: (h: Hit) => void
  onStopFind: () => void
}) {
  const t = useNetT()
  const [details, setDetails] = useState(false)
  const v = report?.verdict
  const vTitle = v === 'safe' ? t('verdictSafe') : v === 'check' ? t('verdictCheck') : t('verdictBad')
  const vText = v === 'safe' ? t('verdictSafeText') : v === 'check' ? t('verdictCheckText') : t('verdictBadText')
  const hs = hunting?.state
  const range = hs ? huntRange(hs.misses >= 3 ? null : hs.rssi) : null
  const trendText = hs?.trend === 'hotter' ? t('finderHot') : hs?.trend === 'colder' ? t('finderCold') : hs?.trend === 'same' ? t('finderSame') : ''
  const rangeText = range === 'touch' ? t('rangeTouch') : range === 'close' ? t('rangeClose') : range === 'near' ? t('rangeNear') : range === 'far' ? t('rangeFar') : t('rangeLost')
  return (
    <div className="scout-room">
      <button className="btn scout-big" disabled={!connected || running} onClick={onCheck}>{report ? t('roomBtnAgain') : t('roomBtn')}</button>
      {!connected && <p className="small muted">{t('roomNeedConn')}</p>}
      {running && <NovaProgress label={t('roomRunning')} secs={35} />}

      {report && !running && (
        <div className={`scout-verdict ${v}`} role="status">
          <b className="scout-verdict-title">{vTitle}</b>
          <p>{vText}</p>
          <p className="small muted">{t('roomSummary', { wifi: report.wifiCount, ble: report.bleCount })}</p>
          <button className="btn" onClick={() => setDetails((d) => !d)} aria-expanded={details}>{details ? t('detailsHide') : t('detailsShow')}</button>
          {details && (
            <div className="scout-details">
              <HitList title={t('huntCameras')} hits={report.cameras} usb={usb} onFind={onFind} t={t} />
              <HitList title={t('huntTrackers')} hits={report.trackers} usb={usb} onFind={onFind} t={t} />
              <HitList title={t('huntIot')} hits={report.iot} usb={usb} onFind={onFind} t={t} />
              {!usb && <p className="small muted">{t('finderUsbOnly')}</p>}
            </div>
          )}
        </div>
      )}

      {hunting && hs && (
        <div className="scout-finder">
          <b>{t('finderTitle')}: {hunting.target.label}</b>
          <p className="small muted">{t('finderHow')}</p>
          <div className="scout-finder-num mono">{hs.rssi == null ? '—' : `${Math.round(hs.rssi)} dBm`}</div>
          <div className="scout-finder-bar" aria-hidden="true"><i style={{ width: `${Math.round(huntFill(hs.misses >= 3 ? null : hs.rssi) * 100)}%` }} /></div>
          <p className="small">{hs.rssi == null && hs.misses < 3 ? t('finderWaiting') : `${rangeText}${trendText ? ' · ' + trendText : ''}`}</p>
          <button className="btn" onClick={onStopFind}>{t('finderStop')}</button>
        </div>
      )}

      <div className="scout-tips">
        <b className="small">{t('tipsTitle')}</b>
        <ul className="small muted">
          <li>{t('tip1')}</li><li>{t('tip2')}</li><li>{t('tip3')}</li><li>{t('tip4')}</li><li>{t('tip5')}</li>
        </ul>
      </div>
    </div>
  )
}
