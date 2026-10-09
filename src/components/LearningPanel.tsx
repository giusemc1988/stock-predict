import { useEffect, useState } from 'react'
import { APP_VERSION } from '../data/releases'

/** What the AI has tested and learned, read from public/learning.json (refreshed by the daily run). */
interface Learning {
  updated: string
  method: string
  classification: Record<string, { always_up_acc: number; logistic_acc: number; logistic_auc: number; gboost_auc: number }>
  replay: { model: string; results: Record<string, Record<string, { learner?: Stats; always_buy?: Stats; note?: string }>> }
  lessons: string[]
  daily: { date: string; summary: string }[]
}

interface Stats {
  n: number
  hit_rate?: number
  avg_fwd_pct?: number
}

const pct = (x?: number) => (x === undefined ? '–' : `${(x * 100).toFixed(1)}%`)

export function LearningPanel() {
  const [data, setData] = useState<Learning | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('learning.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  if (error) return <div className="muted">Could not load the learning report: {error}</div>
  if (!data) return <div className="muted">Loading…</div>

  return (
    <div className="learning">
      <p className="muted">App v{APP_VERSION}. Data updated {data.updated}. Paper research only, not financial advice.</p>
      <p>{data.method}</p>

      <h4>Direction models (accuracy vs always-up)</h4>
      <table>
        <thead>
          <tr>
            <th>Horizon</th>
            <th>Always up</th>
            <th>Logistic</th>
            <th>AUC</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(data.classification).map(([h, v]) => (
            <tr key={h}>
              <td>{h}d</td>
              <td>{pct(v.always_up_acc)}</td>
              <td>{pct(v.logistic_acc)}</td>
              <td>{v.logistic_auc.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4>Journal learner replay, by year</h4>
      {Object.entries(data.replay.results).map(([h, years]) => (
        <details key={h}>
          <summary>{h}-day horizon</summary>
          <table>
            <thead>
              <tr>
                <th>Year</th>
                <th>Learner trades</th>
                <th>Learner hit rate</th>
                <th>Always-buy hit rate</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(years).map(([y, v]) => (
                <tr key={y}>
                  <td>{y}</td>
                  <td>{v.learner?.n ?? 0}</td>
                  <td>{pct(v.learner?.hit_rate)}</td>
                  <td>{pct(v.always_buy?.hit_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ))}

      <h4>What we learned</h4>
      <ul>
        {data.lessons.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>

      <h4>Daily runs</h4>
      {data.daily.length === 0 ? (
        <p className="muted">No daily runs recorded yet.</p>
      ) : (
        <ul>
          {data.daily.map((d) => (
            <li key={d.date}>
              <strong>{d.date}</strong>: {d.summary}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
