export interface Toast {
  id: number
  tone: 'ok' | 'bad' | 'info'
  title: string
  body?: string
}

export function Toasts({ toasts, onClose }: { toasts: Toast[]; onClose: (id: number) => void }) {
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`toast-card t-${t.tone}`}
          role={t.tone === 'bad' ? 'alert' : 'status'}
          aria-label={`${t.title}${t.body ? `. ${t.body}` : ''}. Dismiss`}
          onClick={() => onClose(t.id)}
        >
          <b>{t.title}</b>
          {t.body && <span>{t.body}</span>}
        </button>
      ))}
    </div>
  )
}
