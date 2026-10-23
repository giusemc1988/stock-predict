/** "2m ago" / "2 phút trước": how long ago a time was, for activity feeds. */
export function ago(ms: number, lang: 'en' | 'vi', now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000))
  const vi = lang === 'vi'
  if (s < 45) return vi ? 'vừa xong' : 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return vi ? `${m} phút trước` : `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return vi ? `${h} giờ trước` : `${h}h ago`
  const d = Math.round(h / 24)
  return vi ? `${d} ngày trước` : `${d}d ago`
}
