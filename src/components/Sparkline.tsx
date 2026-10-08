export function Sparkline({ data, width = 64, height = 22 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return <svg width={width} height={height} />
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * width).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`)
  const up = data[data.length - 1] >= data[0]
  const color = up ? 'var(--up)' : 'var(--down)'
  return (
    <svg width={width} height={height} className="spark">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}
