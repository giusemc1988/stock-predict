/** Small ⓘ that explains a term in plain English on hover or tap. */
export function InfoTip({ text }: { text: string }) {
  return (
    <span className="info" tabIndex={0} aria-label={text}>
      i<span className="info-pop">{text}</span>
    </span>
  )
}
