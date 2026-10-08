export interface Toast {
  id: number
  tone: 'ok' | 'bad' | 'info'
  title: string
  body?: string
}

export function Toasts({ toasts, onClose }: { toasts: Toast[]; onClose: (id: number) => void }) {
  return (
    <div className="toasts" role="status">
      {toasts.map((t) => (
        <div key={t.id} className={`toast-card t-${t.tone}`} onClick={() => onClose(t.id)}>
          <b>{t.title}</b>
          {t.body && <span>{t.body}</span>}
        </div>
      ))}
    </div>
  )
}
