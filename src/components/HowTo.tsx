import { useLang } from '../lib/i18n'

/** The short "what is in this card / what to do / what to tap" block every form carries (Chanh's rule: no form without instructions). */
export function HowTo({ what, doIt, tap }: { what: string; doIt: string; tap: string }) {
  const vi = useLang() === 'vi'
  return (
    <div className="how-to small">
      <p><b>{vi ? 'Có gì ở đây:' : 'What is here:'}</b> {what}</p>
      <p><b>{vi ? 'Làm gì:' : 'What to do:'}</b> {doIt}</p>
      <p><b>{vi ? 'Bấm gì:' : 'What to tap:'}</b> {tap}</p>
    </div>
  )
}
