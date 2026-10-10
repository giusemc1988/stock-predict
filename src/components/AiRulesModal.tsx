import { useMemo, useState } from 'react'
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
