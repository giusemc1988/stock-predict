import { useRuviewT } from '../lib/ruviewText'
import type { KitFirmware } from '../lib/s3Kit'

export type KitMode = 'echo' | 'nexus'
const WANT: Record<KitMode, KitFirmware> = { echo: 'ruview', nexus: 'nexus-scout' }

/** Shared by Echo and Nexus: which mode this page is, what the connected S3 board actually runs, and a switch to the other page. */
export function S3KitBar({ mode, firmware, connected, onSwitch }: { mode: KitMode; firmware: KitFirmware; connected: boolean; onSwitch?: () => void }) {
  const t = useRuviewT()
  const other: KitMode = mode === 'echo' ? 'nexus' : 'echo'
  const fwLabel = !connected || firmware === 'unknown' ? 'kitFwNone' : firmware === 'ruview' ? 'kitFwRuview' : 'kitFwNexus'
  const mismatch = connected && firmware !== 'unknown' && firmware !== WANT[mode]
  return (
    <div className="s3kit" role="group" aria-label="ESP32-S3">
      <span className="small"><b>{t(mode === 'echo' ? 'kitEcho' : 'kitNexus')}</b> · {t(fwLabel)}</span>
      {onSwitch && <button className="btn" onClick={onSwitch}>{t('kitSwitch', { mode: t(other === 'echo' ? 'kitEcho' : 'kitNexus') })}</button>}
      {mismatch && <p className="small net-note" role="status">{t('kitReflash')}</p>}
    </div>
  )
}
