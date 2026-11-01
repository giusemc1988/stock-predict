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
import { sameOrigin, withSavedKeys, type KeyStore } from '../lib/brainKeys'
import { buildGroupPrompt, cleanTripSave, fallbackGroup, mergeTrips, parseGroupResponse, parseTrips, TRIPS_KEY, type LumiLine, type LumiMode } from '../lib/lumiTranslate'

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
const MAX_AUDIO_BYTES = 4 * 1024 * 1024

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
    const out = new FormData()
    out.append('file', audio, 'chunk.webm')
    out.append('model', 'whisper-large-v3-turbo')
    out.append('response_format', 'verbose_json')
    const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { authorization: `Bearer ${groqKey}` },
      body: out,
      signal: AbortSignal.timeout(20000),
    }).catch(() => null)
    if (!r?.ok) return json({ error: `Groq Whisper lỗi (${r?.status ?? 'network'})` }, 502)
    const j = (await r.json()) as { text?: string; language?: string }
    const text = (j.text ?? '').trim()
    return json({ text, lang: j.language ?? 'und' })
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
