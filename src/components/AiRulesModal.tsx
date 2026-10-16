import { useMemo, useState, useEffect } from 'react'
import { SKILLS, setSkillStatus, skillVersion, statusOf, useSkillStatuses, type SkillStatus } from '../lib/skills'
import { runSkillTests } from '../lib/skillTests'
import { DEFAULT_AI_RULES, RULE_FIELDS, setAiRules, useAiRules, type AiRules, type RuleField } from '../lib/aiRules'
import { useLang, useT, type Key } from '../lib/i18n'

const GROUPS: { id: RuleField['group']; label: Key }[] = [
  { id: 'call', label: 'rulesCall' },
  { id: 'sizing', label: 'rulesSizing' },
  { id: 'gates', label: 'rulesGates' },
  { id: 'costs', label: 'rulesCosts' },
  { id: 'modules', label: 'rulesModules' },
  { id: 'jarvis', label: 'rulesJarvis' },
]

/** Settings > AI rules: edit the analyst's thresholds, sizing limits, risk gates and modules. */
export function AiRulesModal({ onClose }: { onClose: () => void }) {
  const t = useT()
  const lang = useLang()
  const rules = useAiRules()
  // numbers are kept as text while typing so an empty box doesn't snap to a value
  const [draft, setDraft] = useState<Record<string, string | boolean>>(() => ({ ...rules }) as unknown as Record<string, string | boolean>)
  const set = (k: keyof AiRules, v: string | boolean) => setDraft((d) => ({ ...d, [k]: v }))
  const statuses = useSkillStatuses()
  const tests = useMemo(() => runSkillTests(), [])
  const failed = new Set(tests.filter((x) => !x.ok).map((x) => x.id))
  const vi = lang === 'vi'
  const STATUS: Record<SkillStatus, string> = { approved: vi ? 'Đã duyệt' : 'Approved', quarantine: vi ? 'Cách ly' : 'Quarantine', revoked: vi ? 'Thu hồi' : 'Revoked' }
  const [telegramToken, setTelegramToken] = useState('')
  const [telegramChatId, setTelegramChatId] = useState('')
  const [telegramSaved, setTelegramSaved] = useState(false)
  const [telegramTestLoading, setTelegramTestLoading] = useState(false)
  const [telegramTestResult, setTelegramTestResult] = useState<{ ok: boolean; message?: string; error?: string } | null>(null)
  const [showToken, setShowToken] = useState(false)
  const [savedTokenPreview, setSavedTokenPreview] = useState<string>('')

  useEffect(() => {
    // Load Telegram config from server
    fetch('/api/practice/telegram/config')
      .then((r) => r.json())
      .then((data) => {
        if (data.config) {
          setTelegramToken(data.config.token || '')
          setTelegramChatId(data.config.chatId || '')
        }
      })
      .catch(() => {})
  }, [])

  const saveTelegramConfig = async () => {
    const cleanToken = telegramToken.replace(/\s/g, '')
    const cleanChatId = telegramChatId.replace(/\s/g, '')
    if (!cleanToken || !cleanChatId) {
      alert(vi ? 'Token và Chat ID không được trống' : 'Token and Chat ID cannot be empty')
      return
    }
    try {
      const res = await fetch('/api/practice/telegram/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: cleanToken, chatId: cleanChatId }),
      })
      if (res.ok) {
        // Show preview of saved token
        if (cleanToken.length > 14) {
          setSavedTokenPreview(`${cleanToken.substring(0, 10)}…${cleanToken.substring(cleanToken.length - 4)}`)
        } else {
          setSavedTokenPreview(cleanToken)
        }
        setTelegramSaved(true)
        setTelegramTestResult(null)
        setTimeout(() => setTelegramSaved(false), 3000)
      } else {
        alert(vi ? 'Lỗi lưu Telegram config' : 'Error saving Telegram config')
      }
    } catch (e) {
      alert(vi ? 'Lỗi kết nối' : 'Connection error')
    }
  }

  const sendTelegramTest = async () => {
    setTelegramTestLoading(true)
    setTelegramTestResult(null)
    try {
      const res = await fetch('/api/practice/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = (await res.json().catch(() => ({ error: 'Failed to parse response' }))) as Record<string, unknown>
      if (res.ok) {
        setTelegramTestResult({ ok: true, message: data.message ? String(data.message) : 'Test message sent' })
      } else {
        setTelegramTestResult({ ok: false, error: data.error ? String(data.error) : 'Failed to send test message' })
      }
    } catch (e) {
      setTelegramTestResult({ ok: false, error: e instanceof Error ? e.message : 'Connection error' })
    } finally {
      setTelegramTestLoading(false)
    }
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal ai-rules" onClick={(e) => e.stopPropagation()}>
        <h3>{t('aiRules')}</h3>
        <p className="muted">{t('aiRulesIntro')}</p>
        {GROUPS.map((g) => (
          <div key={g.id} className="rules-group">
            <div className="section-title">{t(g.label)}</div>
            {RULE_FIELDS.filter((f) => f.group === g.id).map((f) =>
              f.min == null ? (
                <label key={f.key} className="rule-row toggle">
                  <input type="checkbox" checked={!!draft[f.key]} onChange={(e) => set(f.key, e.target.checked)} />
                  <span>{lang === 'vi' ? f.vi : f.en}</span>
                </label>
              ) : (
                <label key={f.key} className="rule-row">
                  <span>{lang === 'vi' ? f.vi : f.en}</span>
                  <span className="rule-input">
                    <input
                      className="mono"
                      type="number"
                      inputMode="decimal"
                      min={f.min}
                      max={f.max}
                      step={f.step}
                      value={String(draft[f.key])}
                      onChange={(e) => set(f.key, e.target.value)}
                    />
                    {f.unit && <em>{f.unit}</em>}
                  </span>
                </label>
              ),
            )}
          </div>
        ))}
        {draft.telegramNotifications && (
          <div className="rules-group">
            <div className="section-title">{vi ? '🔔 Cấu hình Telegram' : '🔔 Telegram Configuration'}</div>
            <p className="muted">
              {vi
                ? 'Nhắn tin từ BotFather (@BotFather) để tạo bot mới. Nhập token của bot và Chat ID (ID của bạn hoặc nhóm). Lưu ngay để nhận cảnh báo giao dịch trên Telegram.'
                : 'Message BotFather (@BotFather) to create a new bot. Paste the token and your Chat ID (your ID or group ID) to receive trade alerts on Telegram.'}
            </p>
            <label className="field">
              <span>Telegram Bot Token</span>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <input
                  type={showToken ? 'text' : 'password'}
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                  autoComplete="new-password"
                  placeholder={vi ? 'Ví dụ: 123456:ABC-DEF...' : 'e.g., 123456:ABC-DEF...'}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    color: 'inherit',
                    fontSize: '16px',
                  }}
                  title={vi ? 'Hiển thị/ẩn' : 'Show/hide'}
                >
                  {showToken ? '🙈' : '👁️'}
                </button>
              </div>
            </label>
            <label className="field">
              <span>{vi ? 'Chat ID của bạn' : 'Your Chat ID'}</span>
              <input
                type="text"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                autoComplete="off"
                placeholder={vi ? 'Ví dụ: 123456789' : 'e.g., 123456789'}
              />
            </label>
            <p className="muted tiny">
              {vi
                ? '💡 Cách lấy Chat ID: Thêm bot vào chat, gửi /start, sau đó truy cập https://api.telegram.org/botTOKEN/getUpdates để xem Chat ID của bạn'
                : '💡 How to get Chat ID: Add the bot to your chat, send /start, then visit https://api.telegram.org/botTOKEN/getUpdates to see your Chat ID'}
            </p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button
                className={telegramSaved ? 'primary ok' : 'primary'}
                onClick={saveTelegramConfig}
              >
                {telegramSaved ? (vi ? '✓ Đã lưu' : '✓ Saved') : vi ? 'Lưu Telegram' : 'Save Telegram'}
              </button>
              <button
                className="primary"
                onClick={sendTelegramTest}
                disabled={telegramTestLoading || !telegramToken.trim() || !telegramChatId.trim()}
              >
                {telegramTestLoading ? (vi ? '⏳ Gửi tin...' : '⏳ Sending...') : vi ? 'Gửi tin thử' : 'Send test'}
              </button>
            </div>
            {telegramSaved && savedTokenPreview && (
              <p className="muted tiny" style={{ marginTop: '8px' }}>
                {vi ? '✓ Token đã lưu: ' : '✓ Saved token: '}
                <code>{savedTokenPreview}</code>
              </p>
            )}
            {telegramTestResult && (
              <p className={`muted tiny ${telegramTestResult.ok ? 'up' : 'down'}`} style={{ marginTop: '8px' }}>
                {telegramTestResult.ok ? '✓ ' : '✗ '}
                {telegramTestResult.ok ? telegramTestResult.message : telegramTestResult.error}
              </p>
            )}
          </div>
        )}
        {draft.skillRegistryOn && (
          <div className="rules-group">
            <div className="section-title">{vi ? 'Kỹ năng (chỉ kỹ năng được duyệt mới tạo tín hiệu; lưu ngay)' : 'Skills (only approved skills feed signals; saved right away)'}</div>
            <p className="muted">
              {vi
                ? 'Mỗi kỹ năng được kiểm thử trên dữ liệu giả lập khi mở ứng dụng; kỹ năng không đạt sẽ bị cách ly. Không tải hay chạy mã từ GitHub hoặc do AI viết.'
                : 'Each skill is self-tested on simulated bars when the app opens; one that fails is quarantined. No code is downloaded from GitHub or written by an AI.'}
            </p>
            {SKILLS.map((k) => {
              const st = statusOf(k.id, statuses, failed)
              const test = tests.find((x) => x.id === k.id)
              const v = vi ? k.vi : k.en
              return (
                <div key={k.id} className="rule-row skill-row">
                  <span>
                    <b>{v.name}</b> <em className="muted">v{skillVersion(k)} · {k.category}</em>
                    <br />
                    <span className="muted">
                      {v.does} {k.limits} · {vi ? 'Nguồn' : 'Source'}: {k.source} · {vi ? 'Quyền' : 'Permissions'}: {k.permissions.join(', ')} · {vi ? 'Kiểm thử' : 'Self-test'}:{' '}
                      <span className={test?.ok ? 'up' : 'down'}>{test?.ok ? (vi ? 'đạt' : 'passed') : `${vi ? 'không đạt' : 'failed'} (${test?.detail})`}</span>
                    </span>
                  </span>
                  <select value={st} onChange={(e) => setSkillStatus(k.id, e.target.value as SkillStatus)} aria-label={v.name}>
                    {(['approved', 'quarantine', 'revoked'] as SkillStatus[]).map((x) => (
                      <option key={x} value={x}>
                        {STATUS[x]}
                      </option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        )}
        <div className="modal-actions">
          <button onClick={() => setDraft({ ...DEFAULT_AI_RULES } as unknown as Record<string, string | boolean>)}>{t('resetDefaults')}</button>
          <button onClick={onClose}>{t('cancel')}</button>
          <button
            className="primary"
            onClick={() => {
              // sanitize clamps numbers into range and keeps the old value for an empty box
              const merged = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v === '' ? rules[k as keyof AiRules] : v]))
              setAiRules(merged as unknown as AiRules)
              onClose()
            }}
          >
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  )
}
