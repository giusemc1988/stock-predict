import { useEffect, useState } from 'react'
import { useLang } from '../lib/i18n'

interface KeyRow {
  id: string
  name: string
  on: boolean
  source: 'saved' | 'server' | 'none'
}

const LINKS: Record<string, string> = {
  gemini: 'https://aistudio.google.com/apikey',
  groq: 'https://console.groq.com/keys',
  nvidia: 'https://build.nvidia.com/settings/api-keys',
}

const TXT = {
  en: {
    title: 'Free AI keys',
    intro: 'Paste a free key to let Jarvis use that AI for questions he cannot answer himself. Keys are saved on the server, never in this browser, and are never shown again. The AI only explains; it never trades.',
    getOne: 'get one',
    save: 'Save',
    test: 'Test',
    remove: 'Remove',
    saved: 'saved',
    server: 'set on the server',
    none: 'not set',
    placeholder: 'Paste key here',
    noStorage: 'Key storage is not set up on this server yet, so keys cannot be saved here.',
    loadFail: 'Could not reach the server (the boxes work on the deployed site, not on a plain local preview).',
    working: 'Working',
    failed: 'Failed',
  },
  vi: {
    title: 'Khóa AI miễn phí',
    intro: 'Dán khóa miễn phí để Jarvis dùng AI đó khi gặp câu hỏi tự mình chưa trả lời được. Khóa được lưu trên máy chủ, không lưu trong trình duyệt, và không bao giờ hiện lại. AI chỉ giải thích, không bao giờ giao dịch.',
    getOne: 'lấy khóa',
    save: 'Lưu',
    test: 'Thử',
    remove: 'Xóa',
    saved: 'đã lưu',
    server: 'đặt trên máy chủ',
    none: 'chưa có',
    placeholder: 'Dán khóa vào đây',
    noStorage: 'Máy chủ chưa bật nơi lưu khóa, nên chưa lưu khóa ở đây được.',
    loadFail: 'Không kết nối được máy chủ (các ô này chỉ chạy trên trang đã deploy, không chạy trên bản xem thử cục bộ).',
    working: 'Dùng được',
    failed: 'Lỗi',
  },
}

async function call(url: string, init?: RequestInit) {
  const r = await fetch(url, init)
  const j = (await r.json().catch(() => ({}))) as { keys?: KeyRow[]; error?: string; ok?: boolean }
  return { ok: r.ok, ...j }
}

export function AiKeysSection() {
  const x = TXT[useLang() === 'vi' ? 'vi' : 'en']
  const [rows, setRows] = useState<KeyRow[] | null>(null)
  const [canSave, setCanSave] = useState(true)
  const [down, setDown] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState('')

  useEffect(() => {
    let live = true
    fetch('/api/brain/status')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: { keys?: KeyRow[]; canSave?: boolean }) => {
        if (!live) return
        setRows(Array.isArray(j.keys) ? j.keys : [])
        setCanSave(j.canSave !== false)
      })
      .catch(() => live && setDown(true))
    return () => {
      live = false
    }
  }, [])

  const say = (id: string, m: string) => setMsg((p) => ({ ...p, [id]: m }))
  const act = async (id: string, kind: 'save' | 'test' | 'remove') => {
    setBusy(id + kind)
    say(id, '')
    try {
      if (kind === 'save') {
        const r = await call('/api/brain/key', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, key: drafts[id] ?? '' }) })
        if (r.ok && r.keys) {
          setRows(r.keys)
          setDrafts((p) => ({ ...p, [id]: '' }))
        } else say(id, r.error ?? x.failed)
      } else if (kind === 'remove') {
        const r = await call(`/api/brain/key?id=${id}`, { method: 'DELETE' })
        if (r.ok && r.keys) setRows(r.keys)
        else say(id, r.error ?? x.failed)
      } else {
        const r = await call('/api/brain/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) })
        say(id, r.ok ? x.working : `${x.failed}: ${r.error ?? ''}`)
      }
    } catch {
      say(id, x.loadFail)
    }
    setBusy('')
  }

  return (
    <>
      <h3>{x.title}</h3>
      <p className="muted">{x.intro}</p>
      {down && <p className="muted">{x.loadFail}</p>}
      {rows && !canSave && <p className="muted">{x.noStorage}</p>}
      {rows?.map((row) => (
        <div className="field" key={row.id}>
          <span>
            {row.name} ({x[row.source]}){' '}
            <a href={LINKS[row.id]} target="_blank" rel="noreferrer">
              {x.getOne}
            </a>
          </span>
          <input
            type="password"
            autoComplete="off"
            value={drafts[row.id] ?? ''}
            placeholder={x.placeholder}
            disabled={!canSave}
            onChange={(e) => setDrafts({ ...drafts, [row.id]: e.target.value })}
          />
          <div className="modal-actions">
            <button disabled={!canSave || !drafts[row.id]?.trim() || !!busy} onClick={() => act(row.id, 'save')}>
              {x.save}
            </button>
            <button disabled={!row.on || !!busy} onClick={() => act(row.id, 'test')}>
              {x.test}
            </button>
            <button disabled={row.source !== 'saved' || !!busy} onClick={() => act(row.id, 'remove')}>
              {x.remove}
            </button>
          </div>
          {msg[row.id] && <small className="warn">{msg[row.id]}</small>}
        </div>
      ))}
    </>
  )
}
