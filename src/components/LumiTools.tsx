import { useCallback, useEffect, useState } from 'react'
import type { Bi } from '../lib/hubText'
import { CURRENCIES, convert, findMoney, formatVnd, parseStoredRates, RATES_KEY, ratesFresh, type Money, type Rates } from '../lib/lumiMoney'
import { CULTURE, SCAMS, LUMI_LANGS, PHRASE_CATS, phrasesFor, speechTag, type LumiLang, type PhraseCat } from '../lib/lumiPhrases'
import { addWord, parseVocab, removeWord, tripsToText, VOCAB_KEY, type LumiTrip, type LumiWord } from '../lib/lumiTranslate'

/**
 * Lumi's travel tools beside "Listen": two-way talk, offline phrasebook, money to VND, trip
 * vocabulary and etiquette tips. Speech in/out uses the browser's free Web Speech APIs; translation
 * goes through /api/lumi/say (free AI rotation). Vocabulary and rates stay on the phone.
 */

type Lang = 'en' | 'vi'
const T = {
  you: { en: 'I speak (Vietnamese)', vi: 'Anh nói (tiếng Việt)' },
  them: { en: 'They speak', vi: 'Họ nói' },
  typeHere: { en: 'Or type a sentence…', vi: 'Hoặc gõ câu cần dịch…' },
  translate: { en: 'Translate', vi: 'Dịch' },
  toThem: { en: 'VI → them', vi: 'VI → họ' },
  toMe: { en: 'Them → VI', vi: 'Họ → VI' },
  listeningNow: { en: 'Listening… speak now', vi: 'Đang nghe… nói đi anh' },
  noSpeech: { en: 'This browser has no speech recognition; type instead.', vi: 'Trình duyệt này không nhận giọng nói, anh gõ chữ nhé.' },
  speak: { en: '🔊 Speak', vi: '🔊 Đọc' },
  keep: { en: '☆ Keep', vi: '☆ Lưu từ' },
  kept: { en: '★ Kept', vi: '★ Đã lưu' },
  failed: { en: 'Could not translate right now.', vi: 'Chưa dịch được, thử lại sau.' },
  all: { en: 'All', vi: 'Tất cả' },
  offline: { en: 'Works offline. Tap a phrase to show it big and read it aloud.', vi: 'Dùng được khi mất mạng. Chạm vào câu để hiện to và đọc lên.' },
  amount: { en: 'Amount', vi: 'Số tiền' },
  rateOld: { en: 'Rates from', vi: 'Tỷ giá lúc' },
  noRates: { en: 'No rates yet. Open once with internet.', vi: 'Chưa có tỷ giá. Mở một lần khi có mạng.' },
  wordsEmpty: { en: 'Nothing kept yet. Tap "☆ Keep" on a translation or phrase.', vi: 'Chưa có từ nào. Bấm "☆ Lưu từ" ở câu dịch hoặc câu nói sẵn.' },
  quiz: { en: 'Quiz me', vi: 'Ôn tập' },
  reveal: { en: 'Show answer', vi: 'Xem nghĩa' },
  next: { en: 'Next', vi: 'Câu khác' },
  remove: { en: 'Remove', vi: 'Xóa' },
  close: { en: 'Close', vi: 'Đóng' },
} satisfies Record<string, Bi>

/** Reads aloud with the phone's own voice (free, offline on most phones). */
export function speak(text: string, tag: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = tag
  u.rate = 0.92
  window.speechSynthesis.speak(u)
}

type Recog = { lang: string; interimResults: boolean; maxAlternatives: number; onresult: ((e: { results: { 0: { transcript: string } }[] }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void }
function recognizer(): (new () => Recog) | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recog; webkitSpeechRecognition?: new () => Recog }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** One sentence of speech -> text, via the browser's recognizer. Resolves '' on silence/error. */
function hearOnce(tag: string): Promise<string> {
  const R = recognizer()
  if (!R) return Promise.resolve('')
  return new Promise((resolve) => {
    const r = new R()
    r.lang = tag
    r.interimResults = false
    r.maxAlternatives = 1
    let got = ''
    r.onresult = (e) => { got = e.results[0]?.[0]?.transcript ?? '' }
    r.onerror = () => resolve('')
    r.onend = () => resolve(got)
    r.start()
  })
}

/** Vocabulary kept in localStorage, shared by the tools. */
export function useVocab() {
  const [words, setWords] = useState<LumiWord[]>(() => (typeof localStorage === 'undefined' ? [] : parseVocab(localStorage.getItem(VOCAB_KEY))))
  const save = (next: LumiWord[]) => {
    setWords(next)
    try { localStorage.setItem(VOCAB_KEY, JSON.stringify(next)) } catch { /* storage full: keep in memory */ }
  }
  return {
    words,
    keep: (w: Omit<LumiWord, 'id' | 'at'>) => save(addWord(words, w)),
    drop: (id: string) => save(removeWord(words, id)),
    has: (text: string) => words.some((x) => x.text === text),
  }
}

/** Free FX rates: cached on the phone for 12h, refreshed from /api/lumi/rates when online. */
export function useRates(): Rates | null {
  const [rates, setRates] = useState<Rates | null>(() => (typeof localStorage === 'undefined' ? null : parseStoredRates(localStorage.getItem(RATES_KEY))))
  useEffect(() => {
    if (ratesFresh(rates)) return
    let dead = false
    fetch('/api/lumi/rates')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Rates | null) => {
        if (dead || !j || !j.perUsd) return
        setRates(j)
        try { localStorage.setItem(RATES_KEY, JSON.stringify(j)) } catch { /* ignore */ }
      })
      .catch(() => {})
    return () => { dead = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return rates
}

/** Small "≈ 275.000 ₫" chips for the prices found in a conversation. */
export function MoneyChips({ found, rates }: { found: Money[]; rates: Rates | null }) {
  if (!rates || !found.length) return null
  return (
    <span className="lumi-chips">
      {found.slice(0, 4).map((m, i) => {
        const v = m.cur === 'VND' ? null : convert(m.amount, m.cur, 'VND', rates)
        return v == null ? null : <span key={i} className="lumi-chip">💱 {m.amount.toLocaleString()} {m.cur} {formatVnd(v)}</span>
      })}
    </span>
  )
}

export function LangPicker({ value, onChange }: { value: LumiLang; onChange: (l: LumiLang) => void }) {
  return (
    <div className="lumi-tabs" role="radiogroup">
      {LUMI_LANGS.map((l) => (
        <button key={l.code} className={value === l.code ? 'on' : ''} onClick={() => onChange(l.code)}>{l.name}</button>
      ))}
    </div>
  )
}

interface ToolProps { lang: Lang; target: LumiLang; vocab: ReturnType<typeof useVocab> }

/** Two-way talk: each side taps, speaks one sentence, the phone shows + reads the translation. */
export function LumiTalk({ lang, target, vocab }: ToolProps) {
  const L = (k: keyof typeof T) => T[k][lang]
  const [text, setText] = useState('')
  const [busy, setBusy] = useState<'' | 'hear' | 'say'>('')
  const [err, setErr] = useState<string | null>(null)
  const [turns, setTurns] = useState<{ dir: 'vi2x' | 'x2vi'; src: string; out: string; roman?: string }[]>([])

  const translate = useCallback(async (src: string, dir: 'vi2x' | 'x2vi') => {
    if (!src.trim()) return
    setBusy('say')
    setErr(null)
    try {
      const r = await fetch('/api/lumi/say', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: src, dir, lang: target }) })
      const j = (await r.json()) as { text?: string; roman?: string; error?: string }
      if (!r.ok || !j.text) throw new Error(j.error)
      setTurns((t) => [{ dir, src, out: j.text!, roman: j.roman }, ...t].slice(0, 20))
      speak(j.text, dir === 'vi2x' ? speechTag(target) : 'vi-VN')
      setText('')
    } catch (e) {
      setErr((e as Error).message || L('failed'))
    } finally {
      setBusy('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, lang])

  const hearThen = async (dir: 'vi2x' | 'x2vi') => {
    if (!recognizer()) { setErr(L('noSpeech')); return }
    setBusy('hear')
    setErr(null)
    const heard = await hearOnce(dir === 'vi2x' ? 'vi-VN' : speechTag(target))
    setBusy('')
    if (heard) void translate(heard, dir)
  }

  const name = LUMI_LANGS.find((l) => l.code === target)?.name ?? target
  return (
    <section className="bf-card">
      <div className="lumi-two">
        <button className="btn primary" disabled={!!busy} onClick={() => void hearThen('vi2x')}>🎙 {L('you')}</button>
        <button className="btn" disabled={!!busy} onClick={() => void hearThen('x2vi')}>🎙 {L('them')} ({name})</button>
      </div>
      {busy === 'hear' && <p className="small ok">{L('listeningNow')}</p>}
      <div className="lumi-type lumi-say">
        <input value={text} placeholder={L('typeHere')} onChange={(e) => setText(e.target.value)} maxLength={300} />
        <button className="btn" disabled={!!busy || !text.trim()} onClick={() => void translate(text, 'vi2x')}>{L('toThem')}</button>
        <button className="btn" disabled={!!busy || !text.trim()} onClick={() => void translate(text, 'x2vi')}>{L('toMe')}</button>
      </div>
      {err && <p className="small" role="alert">{err}</p>}
      {turns.map((t, i) => {
        const foreign = t.dir === 'vi2x' ? t.out : t.src
        const vi = t.dir === 'vi2x' ? t.src : t.out
        return (
          <div key={i} className={`lumi-turn ${t.dir}`}>
            <p className="small muted">{t.src}</p>
            <p className="lumi-big">{t.out}</p>
            {t.roman && <p className="small muted">{t.roman}</p>}
            <div className="ag-acts">
              <button className="btn" onClick={() => speak(t.out, t.dir === 'vi2x' ? speechTag(target) : 'vi-VN')}>{L('speak')}</button>
              <button className="btn" onClick={() => vocab.keep({ lang: target, text: foreign, vi })}>{vocab.has(foreign) ? L('kept') : L('keep')}</button>
            </div>
          </div>
        )
      })}
    </section>
  )
}

/** Offline phrasebook: tap shows the sentence big (to hand the phone over) and reads it out. */
export function LumiPhrasebook({ lang, target, vocab }: ToolProps) {
  const L = (k: keyof typeof T) => T[k][lang]
  const [cat, setCat] = useState<PhraseCat | 'all'>('all')
  const [big, setBig] = useState<{ text: string; vi: string } | null>(null)
  return (
    <section className="bf-card">
      <p className="small muted">{L('offline')}</p>
      <div className="lumi-tabs">
        <button className={cat === 'all' ? 'on' : ''} onClick={() => setCat('all')}>{L('all')}</button>
        {PHRASE_CATS.map((c) => <button key={c.id} className={cat === c.id ? 'on' : ''} onClick={() => setCat(c.id)}>{c[lang]}</button>)}
      </div>
      <div className="lumi-phrases">
        {phrasesFor(cat, target).map((p) => (
          <button key={p.id} className="lumi-conv" onClick={() => { setBig(p); speak(p.text, speechTag(target)) }}>
            <p><b>{p.text}</b></p>
            <small>{p.vi}</small>
          </button>
        ))}
      </div>
      {big && (
        <div className="lumi-modal" role="dialog" onClick={() => setBig(null)}>
          <div className="bf-card" onClick={(e) => e.stopPropagation()}>
            <p className="lumi-huge">{big.text}</p>
            <p className="small muted">{big.vi}</p>
            <div className="ag-acts">
              <button className="btn" onClick={() => speak(big.text, speechTag(target))}>{L('speak')}</button>
              <button className="btn" onClick={() => vocab.keep({ lang: target, text: big.text, vi: big.vi })}>{vocab.has(big.text) ? L('kept') : L('keep')}</button>
              <button className="btn" onClick={() => setBig(null)}>{L('close')}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

/** Money to VND calculator, with the last rates kept on the phone. */
export function LumiMoney({ lang, rates }: { lang: Lang; rates: Rates | null }) {
  const L = (k: keyof typeof T) => T[k][lang]
  const [amount, setAmount] = useState('10')
  const [cur, setCur] = useState<string>(() => (typeof localStorage === 'undefined' ? 'USD' : localStorage.getItem('lumi:cur') ?? 'USD'))
  const n = Number(amount.replace(',', '.'))
  const v = rates && n > 0 ? convert(n, cur, 'VND', rates) : null
  const pick = (c: string) => { setCur(c); try { localStorage.setItem('lumi:cur', c) } catch { /* ignore */ } }
  return (
    <section className="bf-card">
      <div className="lumi-type">
        <input inputMode="decimal" aria-label={L('amount')} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <select value={cur} onChange={(e) => pick(e.target.value)}>
          {CURRENCIES.filter((c) => c !== 'VND').map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      {rates ? (
        <>
          <p className="lumi-huge">{v != null ? formatVnd(v) : '—'}</p>
          <div className="lumi-chips">
            {[1, 5, 10, 20, 50, 100].map((q) => {
              const x = convert(q, cur, 'VND', rates)
              return x == null ? null : <span key={q} className="lumi-chip">{q} {cur} {formatVnd(x)}</span>
            })}
          </div>
          <p className="small muted">{L('rateOld')} {new Date(rates.at).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')} · open.er-api.com</p>
        </>
      ) : (
        <p className="small muted">{L('noRates')}</p>
      )}
    </section>
  )
}

/** Kept sentences, with a simple flash-card quiz. */
export function LumiVocab({ lang, vocab }: { lang: Lang; vocab: ReturnType<typeof useVocab> }) {
  const L = (k: keyof typeof T) => T[k][lang]
  const [quiz, setQuiz] = useState<number | null>(null)
  const [shown, setShown] = useState(false)
  const words = vocab.words
  if (!words.length) return <section className="bf-card"><p className="small muted">{L('wordsEmpty')}</p></section>
  const q = quiz != null ? words[quiz % words.length] : null
  const tag = (w: LumiWord) => speechTag((LUMI_LANGS.find((l) => l.code === w.lang)?.code ?? 'en') as LumiLang)
  return (
    <section className="bf-card">
      <div className="ag-acts">
        <button className="btn primary" onClick={() => { setQuiz(Math.floor(Math.random() * words.length)); setShown(false) }}>{L('quiz')}</button>
      </div>
      {q && (
        <div className="lumi-turn">
          <p className="lumi-big">{q.text}</p>
          {shown ? <p className="small">{q.vi}</p> : <button className="btn" onClick={() => setShown(true)}>{L('reveal')}</button>}
          <div className="ag-acts">
            <button className="btn" onClick={() => speak(q.text, tag(q))}>{L('speak')}</button>
            <button className="btn" onClick={() => { setQuiz((quiz ?? 0) + 1 + Math.floor(Math.random() * Math.max(1, words.length - 1))); setShown(false) }}>{L('next')}</button>
          </div>
        </div>
      )}
      <div className="lumi-phrases">
        {words.map((w) => (
          <div key={w.id} className="lumi-conv">
            <p><b>[{w.lang}]</b> {w.text}</p>
            <small>{w.vi}</small>
            <div className="ag-acts">
              <button className="btn" onClick={() => speak(w.text, tag(w))}>{L('speak')}</button>
              <button className="btn" onClick={() => vocab.drop(w.id)}>{L('remove')}</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/** Etiquette tips for the chosen language's country. Offline, hand-written. */
export function LumiCulture({ lang, target }: { lang: Lang; target: LumiLang }) {
  const c = CULTURE[target]
  return (
    <section className="bf-card">
      <header><h3>{c.country}</h3></header>
      <ul className="lumi-tips">
        {c.tips.map((t, i) => <li key={i}>{t[lang]}</li>)}
      </ul>
    </section>
  )
}

const T2 = {
  snap: { en: '📷 Take or pick a photo of a menu / sign', vi: '📷 Chụp hoặc chọn ảnh thực đơn / biển báo' },
  reading: { en: 'Reading the photo…', vi: 'Đang đọc ảnh…' },
  nothing: { en: 'No readable text found. Try a closer, sharper photo.', vi: 'Không đọc được chữ. Chụp gần và rõ hơn nhé.' },
  photoNote: { en: 'The photo is only sent to the free AI to read it, never stored.', vi: 'Ảnh chỉ gửi cho AI miễn phí đọc, không lưu lại.' },
  notesEmpty: { en: 'No saved trips yet. In Listen, tap "☆ Save this trip".', vi: 'Chưa có chuyến nào. Ở tab Nghe, bấm "☆ Lưu chuyến này".' },
  copy: { en: 'Copy all', vi: 'Chép tất cả' },
  share: { en: 'Share', vi: 'Chia sẻ' },
  copied: { en: 'Copied.', vi: 'Đã chép.' },
  scams: { en: 'Common scams', vi: 'Chiêu lừa hay gặp' },
} satisfies Record<string, Bi>

/** Shrinks a photo in the browser so the upload is small (max 1280px, JPEG). */
async function shrink(file: File): Promise<string> {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k)
  c.height = Math.round(bmp.height * k)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.8)
}

/** Menu / sign photo -> Vietnamese, with a short note per dish. */
export function LumiMenu({ lang, target, vocab, rates }: ToolProps & { rates: Rates | null }) {
  const L = (k: keyof typeof T2) => T2[k][lang]
  const LT = (k: keyof typeof T) => T[k][lang]
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [items, setItems] = useState<{ orig: string; vi: string; note?: string; price?: string }[] | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const onFile = async (f: File | undefined) => {
    if (!f) return
    setErr(null)
    setItems(null)
    setBusy(true)
    try {
      const url = await shrink(f)
      setPreview(url)
      const r = await fetch('/api/lumi/menu', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image: url }) })
      const j = (await r.json()) as { items?: typeof items; error?: string }
      if (!r.ok) throw new Error(j.error)
      setItems(j.items ?? [])
    } catch (e) {
      setErr((e as Error).message || LT('failed'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="bf-card">
      <label className="btn primary lumi-snap">
        {L('snap')}
        <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
      </label>
      <p className="small muted">{L('photoNote')}</p>
      {preview && <img className="lumi-preview" src={preview} alt="" />}
      {busy && <p className="small ok">{L('reading')}</p>}
      {err && <p className="small" role="alert">{err}</p>}
      {items && !items.length && <p className="small">{L('nothing')}</p>}
      {items && items.length > 0 && (
        <div className="lumi-phrases">
          {items.map((it, i) => {
            const money = it.price ? findMoney(it.price) : []
            return (
              <div key={i} className="lumi-conv">
                <p><b>{it.vi}</b>{it.price && <span className="muted"> · {it.price}</span>}</p>
                <small>{it.orig}</small>
                {it.note && <small>{it.note}</small>}
                <MoneyChips found={money} rates={rates} />
                <div className="ag-acts">
                  <button className="btn" onClick={() => speak(it.orig, speechTag(target))}>{LT('speak')}</button>
                  <button className="btn" onClick={() => vocab.keep({ lang: target, text: it.orig, vi: it.vi })}>{vocab.has(it.orig) ? LT('kept') : LT('keep')}</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

/** Saved trips (summaries only), grouped by day, with Copy / Share as plain text. */
export function LumiNotebook({ lang }: { lang: Lang }) {
  const L = (k: keyof typeof T2) => T2[k][lang]
  const [trips, setTrips] = useState<LumiTrip[] | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    fetch('/api/lumi/trips')
      .then((r) => (r.ok ? r.json() : { trips: [] }))
      .then((j: { trips?: LumiTrip[] }) => setTrips(j.trips ?? []))
      .catch(() => setTrips([]))
  }, [])
  if (trips == null) return <section className="bf-card"><p className="small muted">…</p></section>
  if (!trips.length) return <section className="bf-card"><p className="small muted">{L('notesEmpty')}</p></section>
  const text = tripsToText(trips, lang === 'vi' ? 'vi-VN' : 'en-US')
  const share = async () => {
    const nav = navigator as Navigator & { share?: (d: { title: string; text: string }) => Promise<void> }
    if (nav.share) await nav.share({ title: 'Lumi', text }).catch(() => {})
    else { await navigator.clipboard?.writeText(text).catch(() => {}); setMsg(L('copied')) }
  }
  return (
    <section className="bf-card">
      <div className="ag-acts">
        <button className="btn" onClick={() => { void navigator.clipboard?.writeText(text).then(() => setMsg(L('copied'))).catch(() => {}) }}>{L('copy')}</button>
        <button className="btn" onClick={() => void share()}>{L('share')}</button>
        {msg && <span className="small ok">{msg}</span>}
      </div>
      <pre className="lumi-notes">{text}</pre>
    </section>
  )
}

/** Static list of scams per country (shown under etiquette tips). */
export function ScamList({ lang, target }: { lang: Lang; target: LumiLang }) {
  const s = SCAMS[target]
  if (!s?.length) return null
  return (
    <section className="bf-card">
      <header><h3>⚠ {T2.scams[lang]}</h3></header>
      <ul className="lumi-tips">{s.map((x, i) => <li key={i}>{x[lang]}</li>)}</ul>
    </section>
  )
}
