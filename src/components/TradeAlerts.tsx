import { useEffect, useRef, useState } from 'react'
import type { TradeAlert } from '../worker/practiceCycle'
import { useAiRules } from '../lib/aiRules'
import { useSwipeDismiss } from '../lib/swipeDismiss'

/** Each card closes by itself after a few seconds, or swipe it left/right. */
function AlertCard({ alert, onClose }: { alert: TradeAlert; onClose: () => void }) {
  const swipe = useSwipeDismiss(onClose)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const id = setTimeout(() => closeRef.current(), 8000)
    return () => clearTimeout(id)
  }, [alert.id])
  return (
    <div className="alert-card" {...swipe}>
      <div className="alert-header">
        <span className="alert-symbol">{alert.symbol}</span>
        <span className="alert-side">BUY</span>
        <button className="alert-close" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="alert-body">
        <div className="alert-row">
          <span className="label">Entry:</span>
          <span className="value">${alert.entry.toFixed(2)}</span>
        </div>
        <div className="alert-row">
          <span className="label">Stop:</span>
          <span className="value">${alert.stop.toFixed(2)}</span>
        </div>
        <div className="alert-row">
          <span className="label">Target:</span>
          <span className="value">${alert.target.toFixed(2)}</span>
        </div>
        <div className="alert-row">
          <span className="label">Reason:</span>
          <span className="value">{alert.reason}</span>
        </div>
        {alert.ruleName && (
          <div className="alert-row">
            <span className="label">Rule:</span>
            <span className="value">{alert.ruleName}</span>
          </div>
        )}
      </div>
    </div>
  )
}

interface AlertNotification extends TradeAlert {
  dismissed?: boolean
}

export function TradeAlerts() {
  const rules = useAiRules()
  const [alerts, setAlerts] = useState<AlertNotification[]>([])

  // Fetch alerts from the server
  const fetchAlerts = async () => {
    if (!rules.practiceTradeNotifications) return
    try {
      const res = await fetch('/api/practice/alerts')
      const data = (await res.json()) as { alerts?: TradeAlert[] }
      if (data.alerts && data.alerts.length > 0) {
        // Add any new alerts that aren't already displayed
        setAlerts((prev) => {
          const existing = new Set(prev.map((a) => a.id))
          const newAlerts = data.alerts!.filter((a) => !existing.has(a.id))
          return [...prev, ...newAlerts]
        })
        // Clear alerts from server after we've shown them
        await fetch('/api/practice/alerts/clear', { method: 'POST' })
      }
    } catch (e) {
      console.error('Failed to fetch alerts:', e)
    }
  }

  // Poll for alerts every 30 seconds when practice mode is on
  useEffect(() => {
    if (!rules.practiceMode) return
    fetchAlerts()
    const interval = setInterval(fetchAlerts, 30000)
    return () => clearInterval(interval)
  }, [rules.practiceMode, rules.practiceTradeNotifications])

  const dismissAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }

  const displayAlerts = alerts.filter((a) => !a.dismissed)
  if (!rules.practiceTradeNotifications || displayAlerts.length === 0) return null

  return (
    <div className="trade-alerts">
      {displayAlerts.map((alert) => (
        <AlertCard key={alert.id} alert={alert} onClose={() => dismissAlert(alert.id)} />
      ))}
    </div>
  )
}
