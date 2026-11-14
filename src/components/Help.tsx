import { useState, type ReactNode } from 'react'
import { useLang } from '../lib/i18n'
import { HELP, type HelpKey } from '../lib/maxHelp'

/** A one-line hint plus a small "?" that opens the fuller explanation (text in src/lib/maxHelp.ts). */
export function Help({ k }: { k: HelpKey }) {
  const lang = useLang()
  const [open, setOpen] = useState(false)
  const h = HELP[k]
  return (
    <span className="hp">
      <span className="hp-line">{h.line[lang]}</span>
      <button type="button" className="hp-q" aria-expanded={open} aria-label={`${lang === 'vi' ? 'Giải thích' : 'Explain'}: ${h.line[lang]}`} onClick={() => setOpen(!open)}>?</button>
      {open && <span className="hp-more" role="note">{h.more[lang]}</span>}
    </span>
  )
}

/** A control with its hint right under it. */
export function WithHelp({ k, children }: { k: HelpKey; children: ReactNode }) {
  return (
    <div className="hp-item">
      {children}
      <Help k={k} />
    </div>
  )
}
