import { useState } from 'react'
import { APP_VERSION, RELEASES } from '../data/releases'

const SEEN_KEY = 'bluechip.seenVersion'

function readSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY)
  } catch {
    return null
  }
}

/** Shows the latest "What's new" once per version. Dismissing it remembers the version. */
export function WhatsNew() {
  const [seen, setSeen] = useState(() => readSeen())
  if (seen === APP_VERSION) return null
  const latest = RELEASES.find((r) => r.version === APP_VERSION) ?? RELEASES[0]

  const dismiss = () => {
    try {
      localStorage.setItem(SEEN_KEY, APP_VERSION)
    } catch {
      /* storage blocked: the banner will show again next load */
    }
    setSeen(APP_VERSION)
  }

  return (
    <div className="whats-new" role="dialog" aria-label="What's new">
      <div className="whats-new-head">
        <strong>What's new in v{APP_VERSION}</strong>
        <span className="muted">{latest.date}</span>
      </div>
      <ul>
        {latest.changes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <button onClick={dismiss}>Got it</button>
    </div>
  )
}
