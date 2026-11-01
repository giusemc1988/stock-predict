/**
 * /api/lumi/hear, /group, /trips: Lumi's three server calls.
 * - /hear: forwards one short audio chunk to Groq Whisper, returns {text, lang}. The audio is never
 *   written to disk or KV — it only ever exists in this request's memory.
 * - /group: takes recent transcript lines, asks a free AI helper to group them into conversations
 *   with a Vietnamese summary (src/lib/lumiTranslate.ts). Falls back to one bucket per language
 *   (no summary) when every helper is out of quota.
 * - /trips: GET lists saved trip summaries, POST appends one (text only, capped list, one KV key).
 */
import { callHelper, keyFor, PROVIDERS, type BrainEnv } from '../lib/brainServer'

const GEMINI_VISION = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest']
const GROQ_VISION = ['meta-llama/llama-4-scout-17b-16e-instruct', 'meta-llama/llama-4-maverick-17b-128e-instruct']
import { sameOrigin, withSavedKeys, type KeyStore } from '../lib/brainKeys'
import { audioFileName, buildGroupPrompt, buildSayPrompt, cleanHeard, cleanLiveVi, cleanSayText, MENU_PROMPT, parseImageDataUrl, parseMenuResponse, cleanTripSave, fallbackGroup, mergeTrips, parseGroupResponse, parseSayResponse, parseTrips, TRIPS_KEY, type LumiLine, type LumiMode, type SayDir } from '../lib/lumiTranslate'
import { isLumiLang, LANG_EN } from '../lib/lumiPhrases'
import { buildFastPrompt, buildGistPrompt, parseGist } from '../lib/lumiLive'
import { parseRates } from '../lib/lumiMoney'

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
const MAX_AUDIO_BYTES = 4 * 1024 * 1024

/** Cloudflare Workers AI binding (wrangler.jsonc "ai"): free daily quota, runs next to this Worker. */
type AiBinding = { run: (model: string, input: Record<string, unknown>) => Promise<unknown> }
type LumiEnv = BrainEnv & { AI?: AiBinding }

const FAST_GROQ = 'llama-3.1-8b-instant'
const FAST_SYS = 'You translate live speech into natural spoken Vietnamese. Output only the translation.'

/** m2m100: a translation-only model on Workers AI. Very fast; literal, so it is used for drafts. */
async function workersAiTranslate(env: LumiEnv, text: string, lang: string): Promise<string> {
  if (!env.AI || !text.trim()) return ''
  try {
    const out = (await env.AI.run('@cf/meta/m2m100-1.2b', { text: text.slice(0, 600), source_lang: lang && lang !== 'und' ? lang : 'en', target_lang: 'vi' })) as { translated_text?: string }
    return cleanLiveVi(out?.translated_text)
  } catch {
    return ''
  }
}

/**
 * Live Vietnamese for one caption, fastest first:
 * draft -> Workers AI m2m100, then Groq 8B; final -> Groq 8B with context, then the free rotation, then m2m100.
 */
export async function liveTranslate(env: LumiEnv, e: BrainEnv, text: string, lang: string, context: string[], draft: boolean): Promise<{ vi: string; by: string }> {
  if (lang === 'vi') return { vi: text, by: 'none' }
  if (draft) {
    const vi = await workersAiTranslate(env, text, lang)
    if (vi) return { vi, by: 'Workers AI m2m100' }
  }
  const user = buildFastPrompt(text, lang, context)
  const groq = PROVIDERS.find((p) => p.id === 'groq')
  const gk = groq?.key(e)
  if (groq && gk) {
    const vi = cleanLiveVi(await groq.call(gk, FAST_GROQ, FAST_SYS, user, fetch, undefined, 300).catch(() => null))
    if (vi) return { vi, by: `Groq ${FAST_GROQ}` }
  }
  for (const p of PROVIDERS) {
    const key = p.key(e)
    if (!key) continue
    try {
      const vi = cleanLiveVi(await callHelper(p, key, e, FAST_SYS, user, fetch, undefined, 300))
      if (vi) return { vi, by: p.name }
    } catch {
      // next helper
    }
  }
  if (!draft) {
    const vi = await workersAiTranslate(env, text, lang)
    if (vi) return { vi, by: 'Workers AI m2m100' }
  }
  return { vi: '', by: 'none' }
}

const cleanContext = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(-3).map((x) => x.slice(0, 300)) : [])

export async function lumiRoute(req: Request, pathname: string, env: BrainEnv, settings?: KeyStore): Promise<Response | null> {
  if (pathname === '/api/lumi/hear') {
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
    if (!sameOrigin(req)) return json({ error: 'Not allowed' }, 403)
    const e = await withSavedKeys(env, settings)
    const groqKey = keyFor(e, 'gsk_')
    if (!groqKey) return json({ error: 'Chưa có key Groq miễn phí. Lưu key Groq trong Cài đặt trước.' }, 409)
    const form = await req.formData().catch(() => null)
    const audio = form?.get('audio')
    if (!audio || typeof audio === 'string') return json({ error: 'Thiếu âm thanh' }, 400)
    if (audio.size > MAX_AUDIO_BYTES) return json({ error: 'Đoạn ghi âm quá dài' }, 413)
    if (audio.size < 2000) return json({ text: '', lang: 'und', vi: '' })
    const out = new FormData()
    out.append('file', audio, audioFileName(audio.type || 'audio/webm'))
    out.append('model', 'whisper-large-v3-turbo')
    out.append('response_format', 'verbose_json')
    const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { authorization: `Bearer ${groqKey}` },
      body: out,
      signal: AbortSignal.timeout(20000),
    }).catch(() => null)
    if (!r?.ok) {
      const detail = r ? (await r.text().catch(() => '')).slice(0, 160) : ''
      return json({ error: `Groq Whisper lỗi (${r?.status ?? 'mạng'})${r?.status === 429 ? ': hết lượt miễn phí, chờ 1 phút' : r?.status === 401 ? ': key Groq sai' : ''}`, detail }, 502)
    }
    const heard = cleanHeard((await r.json().catch(() => ({}))) as Parameters<typeof cleanHeard>[0])
    if (!heard.text) return json({ text: '', lang: heard.lang, vi: '' })
    if (heard.lang === 'vi') return json({ ...heard, vi: heard.text })
    // the page may only want the text (its instant browser captions already show a translation)
    if (form?.get('translate') === '0') return json({ ...heard, vi: '' })
    let context: string[] = []
    try { context = cleanContext(JSON.parse(String(form?.get('context') ?? '[]'))) } catch { /* no context */ }
    const t0 = Date.now()
    const tr = await liveTranslate(env as LumiEnv, e, heard.text, heard.lang, context, false)
    if (tr.vi) return json({ ...heard, vi: tr.vi, by: tr.by, ms: Date.now() - t0 })
    return json({ ...heard, vi: '', viError: 'Các AI miễn phí đều hết lượt, đang hiện bản gốc.' })
  }

  if (pathname === '/api/lumi/group') {
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
    if (!sameOrigin(req)) return json({ error: 'Not allowed' }, 403)
    const b = (await req.json().catch(() => null)) as { lines?: unknown; mode?: unknown } | null
    const rawLines = Array.isArray(b?.lines) ? b!.lines : []
    const lines: LumiLine[] = rawLines
      .filter((l): l is { text: unknown; lang: unknown; at: unknown } => !!l && typeof l === 'object')
      .map((l) => ({ text: typeof l.text === 'string' ? l.text : '', lang: typeof l.lang === 'string' ? l.lang : 'und', at: typeof l.at === 'number' ? l.at : 0 }))
      .filter((l) => l.text.trim())
    const mode: LumiMode = b?.mode === 'talk' ? 'talk' : 'ambient'
    if (!lines.length) return json({ conversations: [] })

    const e = await withSavedKeys(env, settings)
    const user = buildGroupPrompt(lines, mode)
    const system = 'You are a precise, honest assistant that groups overheard speech into conversations and summarizes each briefly in Vietnamese. Never invent details not in the lines given. Answer with JSON only.'
    for (const p of PROVIDERS) {
      const key = p.key(e)
      if (!key) continue
      try {
        const text = await callHelper(p, key, e, system, user, fetch, undefined, 500)
        if (text) {
          const groups = parseGroupResponse(text, lines)
          if (groups.length) return json({ conversations: groups, by: p.name })
        }
      } catch {
        // try the next helper
      }
    }
    return json({ conversations: fallbackGroup(lines), by: null })
  }

  if (pathname === '/api/lumi/say') {
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
    if (!sameOrigin(req)) return json({ error: 'Not allowed' }, 403)
    const b = (await req.json().catch(() => null)) as { text?: unknown; dir?: unknown; lang?: unknown } | null
    const text = cleanSayText(b?.text)
    const dir: SayDir = b?.dir === 'x2vi' ? 'x2vi' : 'vi2x'
    if (!text || !isLumiLang(b?.lang)) return json({ error: 'Thiếu câu cần dịch hoặc ngôn ngữ' }, 400)
    const e = await withSavedKeys(env, settings)
    const system = 'You are a precise translator for a traveler. Translate faithfully, politely, naturally. Answer with JSON only.'
    const user = buildSayPrompt(text, dir, LANG_EN[b.lang])
    for (const p of PROVIDERS) {
      const key = p.key(e)
      if (!key) continue
      try {
        const out = await callHelper(p, key, e, system, user, fetch, undefined, 300)
        const parsed = out ? parseSayResponse(out) : null
        if (parsed) return json({ ...parsed, by: p.name })
      } catch {
        // try the next helper
      }
    }
    return json({ error: 'Các AI miễn phí đều hết lượt, thử lại sau ít phút.' }, 503)
  }

  if (pathname === '/api/lumi/fast') {
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
    if (!sameOrigin(req)) return json({ error: 'Not allowed' }, 403)
    const b = (await req.json().catch(() => null)) as { text?: unknown; lang?: unknown; context?: unknown; draft?: unknown } | null
    const text = typeof b?.text === 'string' ? b.text.trim().slice(0, 600) : ''
    if (!text) return json({ error: 'Thiếu câu' }, 400)
    const lang = typeof b?.lang === 'string' ? b.lang.slice(0, 12) : 'und'
    const e = await withSavedKeys(env, settings)
    const t0 = Date.now()
    const out = await liveTranslate(env as LumiEnv, e, text, lang, cleanContext(b?.context), b?.draft === true)
    if (!out.vi) return json({ error: 'Các AI miễn phí đều hết lượt, thử lại sau ít phút.' }, 503)
    return json({ vi: out.vi, by: out.by, ms: Date.now() - t0 })
  }

  if (pathname === '/api/lumi/gist') {
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
    if (!sameOrigin(req)) return json({ error: 'Not allowed' }, 403)
    const b = (await req.json().catch(() => null)) as { lines?: unknown; talk?: unknown } | null
    const lines = (Array.isArray(b?.lines) ? b!.lines : [])
      .filter((l): l is { text: string; lang?: unknown } => !!l && typeof (l as { text?: unknown }).text === 'string')
      .map((l) => ({ text: l.text, lang: typeof l.lang === 'string' ? l.lang : 'und' }))
      .slice(-12)
    if (!lines.length) return json({ error: 'Chưa có gì để tóm tắt' }, 400)
    const e = await withSavedKeys(env, settings)
    const user = buildGistPrompt(lines, b?.talk === true)
    const sys = 'You follow live conversations for a Vietnamese traveler. Be brief and honest. Answer with JSON only.'
    for (const p of PROVIDERS) {
      const key = p.key(e)
      if (!key) continue
      try {
        const g = parseGist(await callHelper(p, key, e, sys, user, fetch, undefined, 400))
        if (g) return json({ ...g, by: p.name })
      } catch {
        // next helper
      }
    }
    return json({ error: 'Các AI miễn phí đều hết lượt.' }, 503)
  }

  if (pathname === '/api/lumi/menu') {
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
    if (!sameOrigin(req)) return json({ error: 'Not allowed' }, 403)
    const b = (await req.json().catch(() => null)) as { image?: unknown } | null
    const img = parseImageDataUrl(b?.image)
    if (!img) return json({ error: 'Ảnh không hợp lệ hoặc quá lớn' }, 400)
    const e = await withSavedKeys(env, settings)
    // the photo only lives in this request: sent to one vision model, never stored
    const gem = e.GEMINI_API_KEY
    if (gem) {
      for (const model of GEMINI_VISION) {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': gem },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ inlineData: { mimeType: img.mime, data: img.b64 } }, { text: MENU_PROMPT }] }], generationConfig: { maxOutputTokens: 2000, temperature: 0.2, thinkingConfig: { thinkingBudget: 0 } } }),
          signal: AbortSignal.timeout(25000),
        }).catch(() => null)
        if (!r?.ok) continue
        const j = (await r.json().catch(() => null)) as { candidates?: { content?: { parts?: { text?: string }[] } }[] } | null
        const text = j?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
        if (text) return json({ items: parseMenuResponse(text), by: 'Gemini' })
      }
    }
    const groq = keyFor(e, 'gsk_')
    if (groq) {
      for (const model of GROQ_VISION) {
        const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${groq}` },
          body: JSON.stringify({ model, max_tokens: 2000, temperature: 0.2, messages: [{ role: 'user', content: [{ type: 'text', text: MENU_PROMPT }, { type: 'image_url', image_url: { url: `data:${img.mime};base64,${img.b64}` } }] }] }),
          signal: AbortSignal.timeout(25000),
        }).catch(() => null)
        if (!r?.ok) continue
        const j = (await r.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null
        const text = j?.choices?.[0]?.message?.content ?? ''
        if (text) return json({ items: parseMenuResponse(text), by: 'Groq' })
      }
    }
    return json({ error: gem || groq ? 'AI đọc ảnh miễn phí đang hết lượt, thử lại sau ít phút.' : 'Cần key Gemini hoặc Groq miễn phí trong Cài đặt để đọc ảnh.' }, gem || groq ? 503 : 409)
  }

  if (pathname === '/api/lumi/rates') {
    if (req.method !== 'GET') return json({ error: 'GET only' }, 405)
    const r = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(8000) }).catch(() => null)
    const rates = r?.ok ? parseRates(await r.json().catch(() => null)) : null
    if (!rates) return json({ error: 'Không lấy được tỷ giá' }, 502)
    return json(rates)
  }

  if (pathname === '/api/lumi/trips') {
    if (!settings) return json({ error: 'Chưa bật lưu trữ trên server này' }, 501)
    if (req.method === 'GET') {
      const trips = parseTrips(await settings.get(TRIPS_KEY))
      return json({ trips })
    }
    if (req.method === 'POST') {
      if (!sameOrigin(req)) return json({ error: 'Not allowed' }, 403)
      const body = cleanTripSave(await req.json().catch(() => null))
      if (!body) return json({ error: 'Không có gì để lưu' }, 400)
      const existing = parseTrips(await settings.get(TRIPS_KEY))
      const id = crypto.randomUUID()
      const next = mergeTrips(existing, body, id, Date.now())
      await settings.put(TRIPS_KEY, JSON.stringify(next))
      return json({ ok: true, id })
    }
    return json({ error: 'GET or POST only' }, 405)
  }

  return null
}
