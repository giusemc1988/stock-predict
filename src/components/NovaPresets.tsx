import { useEffect, useState } from 'react'
import { useLang } from '../lib/i18n'
import { STUDIO_TEXT, type StudioKey } from '../lib/studio/text'
import { cleanKitSettings } from '../lib/studio/postkit'
import { cleanRenderOpts } from '../lib/studioJobs'
import { MAX_PRESETS, type NovaPreset } from '../lib/studio/presets'
import type { StudioMode } from '../lib/studio/script'

/** where NovaPostKit and StudioRenderPanel keep their settings on this device */
export const KIT_STORE = 'nova.postkit.v1'
export const VIDEO_STORE = 'nova.video.v1'

const read = (key: string): unknown => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null')
  } catch {
    return null
  }
}

/** Save the current mode, size, post kit and video settings under a name; pick one to load it back. */
export function NovaPresets({ mode, aspect, onApply }: { mode: StudioMode; aspect: NovaPreset['aspect']; onApply: (p: NovaPreset) => void }) {
  const lang = useLang()
  const t = (k: StudioKey) => STUDIO_TEXT[k][lang]
  const [list, setList] = useState<NovaPreset[]>([])
  const [pick, setPick] = useState('')
  const [name, setName] = useState('')
  const [naming, setNaming] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    void fetch('/api/studio/presets')
      .then((r) => r.json())
      .then((j: { presets?: NovaPreset[] }) => setList(j.presets ?? []))
      .catch(() => {})
  }, [])

  const store = async (next: NovaPreset[]) => {
    const r = await fetch('/api/studio/presets', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ presets: next }) }).catch(() => null)
    const j = (await r?.json().catch(() => null)) as { presets?: NovaPreset[]; error?: string } | null
    if (!r?.ok || !j?.presets) return setMsg(`${t('presetFailed')} ${j?.error ?? ''}`)
    setList(j.presets)
  }

  const save = async () => {
    const n = name.trim()
    if (!n) return
    const p: NovaPreset = { name: n.slice(0, 40), at: Date.now(), mode, aspect, kit: cleanKitSettings(read(KIT_STORE)), video: cleanRenderOpts(read(VIDEO_STORE)) }
    await store([p, ...list.filter((x) => x.name.toLowerCase() !== n.toLowerCase())])
    setPick(p.name)
    setNaming(false)
    setName('')
    setMsg(`${t('presetSaved')} “${p.name}”`)
  }

  const apply = (n: string) => {
    setPick(n)
    const p = list.find((x) => x.name === n)
    if (!p) return
    try {
      localStorage.setItem(KIT_STORE, JSON.stringify(p.kit))
      localStorage.setItem(VIDEO_STORE, JSON.stringify(p.video))
    } catch {
      /* storage blocked: the page still takes mode and size */
    }
    onApply(p)
    setMsg(`${t('presetApplied')} “${p.name}”`)
  }

  const remove = async () => {
    await store(list.filter((x) => x.name !== pick))
    setMsg(`${t('presetDeleted')} “${pick}”`)
    setPick('')
  }

  return (
    <div className="nv-presets">
      <div className="nv-presets-row">
        <select className="btn" value={pick} onChange={(e) => apply(e.target.value)} aria-label={t('presetPick')}>
          <option value="">{list.length ? t('presetPick') : t('presetNone')}</option>
          {list.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
        {pick && <button className="btn small" onClick={() => void remove()}>{t('serverDelete')}</button>}
        {!naming && <button className="btn small" disabled={list.length >= MAX_PRESETS} onClick={() => setNaming(true)}>＋ {t('presetSave')}</button>}
      </div>
      {naming && (
        <div className="nv-presets-row">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder={t('presetName')} aria-label={t('presetName')} autoFocus onKeyDown={(e) => e.key === 'Enter' && void save()} />
          <button className="btn small primary" disabled={!name.trim()} onClick={() => void save()}>{t('keySave')}</button>
          <button className="btn small" onClick={() => setNaming(false)}>✕</button>
        </div>
      )}
      <p className="small muted">{msg ?? t('presetNote')}</p>
    </div>
  )
}
