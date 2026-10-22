/** Grey placeholders in the shape of the real layout while data loads (Dashboard cards and motion). The shimmer is a moving highlight (transform only). */
export function SkRows({ rows = 5, cols = 3, className = '' }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={`sk sk-rows ${className}`} style={{ ['--sk-cols' as string]: cols > 1 ? `1.4fr repeat(${cols - 1}, 1fr)` : '1fr' }} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="sk-row">
          {Array.from({ length: cols }, (_, j) => (
            <i key={j} className="sk-bar" />
          ))}
        </div>
      ))}
    </div>
  )
}

/** A candle-shaped placeholder for the price chart. */
export function SkChart({ label }: { label: string }) {
  const h = [38, 52, 44, 61, 57, 70, 64, 48, 55, 68, 74, 66, 59, 72, 80, 71, 63, 76]
  return (
    <div className="chart-empty sk sk-chart" role="status">
      <div className="sk-candles" aria-hidden="true">
        {h.map((v, i) => (
          <i key={i} style={{ height: `${v}%` }} />
        ))}
      </div>
      <span>{label}</span>
    </div>
  )
}
