import { useMemo, useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useLang } from '../lib/i18n'
import { STUDIO_TEXT, type StudioKey } from '../lib/studio/text'
import type { Lang, Script } from '../lib/studio/script'
import { LENGTHS, PLATFORMS, TITLE_LIMIT, TONES, cleanKitSettings, cleanTag, fallbackKit, fillKit, fullCaption, type KitKind, type KitLang, type KitSettings, type Platform, type PostKit } from '../lib/studio/postkit'

export function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <button className="btn small" onClick={() => void navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500) })}>
      {done ? '✓' : label}
    </button>
  )
}

const TONE_KEY = { curious: 'toneCurious', friendly: 'toneFriendly', bold: 'toneBold', calm: 'toneCalm', funny: 'toneFunny', expert: 'toneExpert' } as const satisfies Record<string, StudioKey>
const LEN_KEY = { short: 'lenShort', medium: 'lenMedium', long: 'lenLong' } as const satisfies Record<string, StudioKey>

/**
 * Nova step 5: hooks, titles, captions per platform and hashtags, every count and style adjustable.
 * It starts from the script (no AI); "Write with AI" replaces it, and each item can be edited or rewritten.
 */
export function NovaPostKit({ script }: { script: Script }) {
  const lang = useLang()
  const t = (k: StudioKey) => STUDIO_TEXT[k][lang]
  const [saved, setSaved] = useLocalStorage<Partial<KitSettings>>('nova.postkit.v1', {})
  const k = useMemo(() => cleanKitSettings(saved), [saved])
  const set = (patch: Partial<KitSettings>) => setSaved({ ...k, ...patch })
  // the AI kit (and the user's edits) belong to the topic they were made for
  const [ai, setAi] = useState<{ topic: string; kit: PostKit; by: string | null } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [view, setView] = useState<Lang>(lang)
  const base = useMemo(() => fallbackKit(script, k), [script, k])
  const mine = ai?.topic === script.topic.en ? ai : null
  const shown = (l: Lang): KitLang => fillKit(mine?.kit[l] ?? null, base[l]!, k)
  const cur: Lang = k.langs.includes(view) ? view : k.langs[0]
  const kit = shown(cur)

  const edit = (patch: Partial<KitLang>) => setAi({ topic: script.topic.en, by: mine?.by ?? null, kit: { ...(mine?.kit ?? {}), [cur]: { ...kit, ...patch } } })
  const editAt = (field: 'hooks' | 'titles', i: number, v: string) => edit({ [field]: kit[field].map((x, j) => (j === i ? v : x)) })
  const body = (only?: object) => JSON.stringify({ script: { topic: script.topic.en, topicVi: script.topic.vi, mode: script.mode, en: script.en, vi: script.vi }, settings: k, only })

  const writeAll = async () => {
    setBusy('all')
    setMsg(null)
    try {
      const r = await fetch('/api/studio/postkit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: body() })
      const j = (await r.json().catch(() => null)) as { kit?: PostKit; by?: string | null; error?: string } | null
      if (!r.ok || !j?.kit) throw new Error(j?.error ?? `HTTP ${r.status}`)
      setAi({ topic: script.topic.en, kit: j.kit, by: j.by ?? null })
      setMsg(j.by ? `${t('writtenBy')} ${j.by}` : t('kitNoAi'))
    } catch (e) {
      setMsg(`${t('kitNoAi')} (${(e as Error).message})`)
    } finally {
      setBusy(null)
    }
  }

  const redo = async (kind: KitKind, i: number, platform?: Platform) => {
    const id = `${kind}:${i}:${platform ?? ''}`
    setBusy(id)
    setMsg(null)
    const avoid = kind === 'hook' ? kit.hooks : kind === 'title' ? kit.titles : [kit.captions[platform!] ?? '']
    try {
      const r = await fetch('/api/studio/postkit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: body({ lang: cur, kind, platform, avoid }) })
      const j = (await r.json().catch(() => null)) as { text?: string; error?: string } | null
      if (!r.ok || !j?.text) throw new Error(j?.error ?? `HTTP ${r.status}`)
      if (kind === 'caption') edit({ captions: { ...kit.captions, [platform!]: j.text } })
      else editAt(kind === 'hook' ? 'hooks' : 'titles', i, j.text)
    } catch (e) {
      setMsg(`${t('aiFailed')} (${(e as Error).message})`)
    } finally {
      setBusy(null)
    }
  }

  const range = (label: StudioKey, key: 'hooks' | 'titles' | 'hashtags', min: number, max: number) => (
    <label className="vs-field">
      <span className="small muted">{t(label)}: <b>{k[key]}</b></span>
      <input type="range" min={min} max={max} value={k[key]} onChange={(e) => set({ [key]: Number(e.target.value) })} />
    </label>
  )
  const regen = (kind: KitKind, i: number, platform?: Platform) => (
    <button className="btn small" disabled={!!busy} aria-label={t('kitRedo')} title={t('kitRedo')} onClick={() => void redo(kind, i, platform)}>
      {busy === `${kind}:${i}:${platform ?? ''}` ? '…' : '↻'}
    </button>
  )
  const togglePlatform = (p: Platform) => set({ platforms: k.platforms.includes(p) ? k.platforms.filter((x) => x !== p) : [...k.platforms, p] })

  return (
    <div className="nv-kit">
      <div className="vs-row">
        <button className="btn primary" disabled={!!busy || !script.topic.en.trim()} onClick={() => void writeAll()}>✦ {busy === 'all' ? t('kitWriting') : t('kitWrite')}</button>
      </div>
      <p className="small muted">{msg ?? (mine?.by ? `${t('writtenBy')} ${mine.by}` : t('kitLocal'))}</p>

      <details className="vs-pexels nv-kit-set">
        <summary className="small">{t('kitSettings')}</summary>
        <div className="nv-kit-grid">
          {range('kitHooks', 'hooks', 1, 10)}
          {range('kitTitles', 'titles', 1, 10)}
          {range('kitHashtags', 'hashtags', 0, 15)}
          <label className="vs-field">
            <span className="small muted">{t('kitTone')}</span>
            <select className="btn" value={k.tone} onChange={(e) => set({ tone: e.target.value as KitSettings['tone'] })}>
              {TONES.map((x) => <option key={x} value={x}>{t(TONE_KEY[x])}</option>)}
            </select>
          </label>
        </div>
        <span className="small muted">{t('kitPlatforms')}</span>
        <div className="nv-chips" role="group" aria-label={t('kitPlatforms')}>
          {PLATFORMS.map((p) => (
            <button key={p.id} className={`nv-src${k.platforms.includes(p.id) ? ' on' : ''}`} aria-pressed={k.platforms.includes(p.id)} onClick={() => togglePlatform(p.id)}>{p.name}</button>
          ))}
        </div>
        <span className="small muted">{t('kitLength')}</span>
        <div className="seg small" role="group" aria-label={t('kitLength')}>
          {LENGTHS.map((x) => <button key={x} className={k.length === x ? 'on' : ''} onClick={() => set({ length: x })}>{t(LEN_KEY[x])}</button>)}
        </div>
        <span className="small muted">{t('serverLang')}</span>
        <div className="seg small" role="group" aria-label={t('serverLang')}>
          {([['vi'], ['en'], ['vi', 'en']] as Lang[][]).map((ls) => (
            <button key={ls.join()} className={k.langs.join() === ls.join() ? 'on' : ''} onClick={() => set({ langs: ls })}>{ls.length === 2 ? t('serverBoth') : ls[0].toUpperCase()}</button>
          ))}
        </div>
        <label className="vs-check"><input type="checkbox" checked={k.emoji} onChange={(e) => set({ emoji: e.target.checked })} /> {t('kitEmoji')}</label>
        <label className="vs-check"><input type="checkbox" checked={k.cta} onChange={(e) => set({ cta: e.target.checked })} /> {t('kitCta')}</label>
      </details>

      {k.langs.length > 1 && (
        <div className="seg small nv-kit-lang" role="group" aria-label={t('serverLang')}>
          {k.langs.map((l) => <button key={l} className={cur === l ? 'on' : ''} onClick={() => setView(l)}>{l.toUpperCase()}</button>)}
        </div>
      )}

      <h4 className="nv-kit-h">{t('kitHooks')} <span className="small muted">{kit.hooks.length}</span></h4>
      {kit.hooks.map((x, i) => (
        <div key={i} className="nv-kit-row">
          <span className="nv-kit-i">{i + 1}</span>
          <input value={x} onChange={(e) => editAt('hooks', i, e.target.value)} aria-label={`${t('kitHooks')} ${i + 1}`} />
          {regen('hook', i)}
          <Copy text={x} label={t('copy')} />
        </div>
      ))}

      <h4 className="nv-kit-h">{t('kitTitles')} <span className="small muted">{kit.titles.length}</span></h4>
      {kit.titles.map((x, i) => (
        <div key={i} className="nv-kit-row">
          <span className={`nv-kit-i${x.length > TITLE_LIMIT ? ' warn' : ''}`} title={`${x.length}/${TITLE_LIMIT}`}>{i + 1}</span>
          <input value={x} onChange={(e) => editAt('titles', i, e.target.value)} aria-label={`${t('kitTitles')} ${i + 1}`} />
          {regen('title', i)}
          <Copy text={x} label={t('copy')} />
        </div>
      ))}

      <h4 className="nv-kit-h">{t('kitCaptions')}</h4>
      {!k.platforms.length && <p className="small muted">{t('kitNoPlatform')}</p>}
      {PLATFORMS.filter((p) => k.platforms.includes(p.id)).map((p, i) => {
        const full = fullCaption(kit, p.id)
        return (
          <div key={p.id} className="nv-kit-cap nv-inset">
            <div className="vs-lab-row">
              <strong className="small">{p.name}</strong>
              <span className={`small ${full.length >= p.limit ? 'warn' : 'muted'}`}>{full.length}/{p.limit}</span>
            </div>
            <textarea rows={4} value={kit.captions[p.id] ?? ''} onChange={(e) => edit({ captions: { ...kit.captions, [p.id]: e.target.value } })} aria-label={`${t('kitCaptions')} ${p.name}`} />
            <div className="vs-row">
              {regen('caption', i, p.id)}
              <Copy text={full} label={t('kitCopyFull')} />
            </div>
          </div>
        )
      })}

      {k.hashtags > 0 && (
        <>
          <h4 className="nv-kit-h">{t('kitHashtags')} <span className="small muted">{kit.hashtags.length}</span></h4>
          <div className="nv-kit-row">
            <TagsInput
              key={kit.hashtags.join()}
              tags={kit.hashtags}
              label={t('kitHashtags')}
              onDone={(tags) => {
                edit({ hashtags: tags })
                // the count follows what was typed, so removed tags stay removed
                if (tags.length !== k.hashtags) set({ hashtags: Math.min(15, tags.length) })
              }}
            />
            <Copy text={kit.hashtags.map((x) => `#${x}`).join(' ')} label={t('copy')} />
          </div>
        </>
      )}
    </div>
  )
}

/** Hashtags as typed text; saved when the box loses focus, so spaces can be typed freely. */
function TagsInput({ tags, label, onDone }: { tags: string[]; label: string; onDone: (tags: string[]) => void }) {
  const [text, setText] = useState(tags.map((x) => `#${x}`).join(' '))
  const done = () => onDone([...new Set(text.split(/[\s,]+/).map(cleanTag).filter(Boolean))].slice(0, 15))
  return <input value={text} onChange={(e) => setText(e.target.value)} onBlur={done} aria-label={label} />
}
