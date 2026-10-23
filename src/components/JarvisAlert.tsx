import { useEffect } from 'react'
import { JarvisAvatar } from './JarvisAvatar'

export interface JarvisAlertData {
  id: string
  symbol: string
  text: string
  tone: 'buy' | 'win' | 'loss'
}

/** Neo pops up when a practice trade opens or closes, HUD style, with Show me. Closes by itself after a few seconds. */
export function JarvisAlert({ alert, motion, showLabel, onShow, onClose }: { alert: JarvisAlertData; motion: boolean; showLabel: string; onShow?: () => void; onClose: () => void }) {
  useEffect(() => {
    const id = setTimeout(onClose, 9000)
    return () => clearTimeout(id)
  }, [alert.id, onClose])
  return (
    <div key={alert.id} className={`jarvis-alert ${alert.tone}${motion ? '' : ' still'}`} role="status">
      <i className="hud-scan" aria-hidden />
      <JarvisAvatar size={30} mood={alert.tone === 'loss' ? 'warning' : 'speaking'} motion={motion} />
      <div className="ja-body">
        <b className="mono">NEO // {alert.symbol}</b>
        <span>{alert.text}</span>
      </div>
      {onShow && (
        <button className="ja-show" onClick={onShow}>
          {showLabel}
        </button>
      )}
      <button className="tour-x" onClick={onClose} aria-label="Close">
        ×
      </button>
    </div>
  )
}
