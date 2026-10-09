import { useState } from 'react'
import { DEFAULT_AI_RULES, RULE_FIELDS, setAiRules, useAiRules, type AiRules, type RuleField } from '../lib/aiRules'
import { useLang, useT, type Key } from '../lib/i18n'

const GROUPS: { id: RuleField['group']; label: Key }[] = [
  { id: 'call', label: 'rulesCall' },
  { id: 'sizing', label: 'rulesSizing' },
  { id: 'gates', label: 'rulesGates' },
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
