/**
 * Nova's post kit: hooks, titles, a caption per platform and hashtags, in EN and/or VI, all adjustable.
 * The AI writes it on the Worker (studioServer.writePostKit); with no AI, fallbackKit builds one from the
 * script so the step is never empty. Pure functions, tested in scripts/novapostkit.test.ts.
 */
import { hookRule } from './hookThemes'
import type { Lang, Script } from './script'

export type Platform = 'tiktok' | 'instagram' | 'youtube' | 'facebook'
export type Tone = 'curious' | 'friendly' | 'bold' | 'calm' | 'funny' | 'expert'
export type CaptionLength = 'short' | 'medium' | 'long'
export type KitKind = 'hook' | 'title' | 'caption'

export const PLATFORMS: { id: Platform; name: string; limit: number }[] = [
  { id: 'tiktok', name: 'TikTok', limit: 2200 },
  { id: 'instagram', name: 'Instagram', limit: 2200 },
  { id: 'youtube', name: 'YouTube', limit: 5000 },
  { id: 'facebook', name: 'Facebook', limit: 63206 },
]
export const TONES: Tone[] = ['curious', 'friendly', 'bold', 'calm', 'funny', 'expert']
export const LENGTHS: CaptionLength[] = ['short', 'medium', 'long']
/** YouTube cuts titles at 100 characters */
export const TITLE_LIMIT = 100

export interface KitSettings {
  hooks: number
  titles: number
  tone: Tone
  platforms: Platform[]
  length: CaptionLength
  hashtags: number
  emoji: boolean
  cta: boolean
  langs: Lang[]
  /** hooks follow the channel's 4 themes (src/lib/studio/hookThemes.ts); off = the old free-form hooks */
  themes: boolean
}

export const DEFAULT_KIT: KitSettings = { hooks: 4, titles: 5, tone: 'curious', platforms: ['tiktok', 'instagram', 'youtube', 'facebook'], length: 'medium', hashtags: 8, emoji: true, cta: true, langs: ['vi', 'en'], themes: true }

export interface KitLang {
  hooks: string[]
  titles: string[]
  /** caption text without hashtags; fullCaption adds them */
  captions: Partial<Record<Platform, string>>
  /** without the # */
  hashtags: string[]
}
export type PostKit = Partial<Record<Lang, KitLang>>

const clamp = (n: unknown, lo: number, hi: number, d: number) => (Number.isFinite(Number(n)) ? Math.max(lo, Math.min(hi, Math.round(Number(n)))) : d)
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d)

export function cleanKitSettings(body: unknown): KitSettings {
  const b = (body ?? {}) as Partial<Record<keyof KitSettings, unknown>>
  const platforms = (Array.isArray(b.platforms) ? b.platforms : []).filter((p): p is Platform => PLATFORMS.some((x) => x.id === p))
  const langs = (Array.isArray(b.langs) ? b.langs : []).filter((l): l is Lang => l === 'en' || l === 'vi')
  return {
    hooks: clamp(b.hooks, 1, 5, DEFAULT_KIT.hooks),
    titles: clamp(b.titles, 1, 10, DEFAULT_KIT.titles),
    tone: oneOf(b.tone, TONES, DEFAULT_KIT.tone),
    platforms: platforms.length ? [...new Set(platforms)] : DEFAULT_KIT.platforms,
    length: oneOf(b.length, LENGTHS, DEFAULT_KIT.length),
    hashtags: clamp(b.hashtags, 0, 15, DEFAULT_KIT.hashtags),
    emoji: b.emoji === undefined ? DEFAULT_KIT.emoji : !!b.emoji,
    cta: b.cta === undefined ? DEFAULT_KIT.cta : !!b.cta,
    langs: langs.length ? [...new Set(langs)] : DEFAULT_KIT.langs,
    themes: b.themes === undefined ? DEFAULT_KIT.themes : !!b.themes,
  }
}

const TONE_TEXT: Record<Tone, Record<Lang, string>> = {
  curious: { en: 'curious and intriguing', vi: 'gây tò mò' },
  friendly: { en: 'warm and friendly', vi: 'thân thiện, gần gũi' },
  bold: { en: 'bold and punchy', vi: 'mạnh mẽ, dứt khoát' },
  calm: { en: 'calm and gentle', vi: 'nhẹ nhàng, bình yên' },
  funny: { en: 'light and funny', vi: 'hài hước, vui vẻ' },
  expert: { en: 'clear and expert', vi: 'rõ ràng, như chuyên gia' },
}
const LENGTH_TEXT: Record<CaptionLength, Record<Lang, string>> = {
  short: { en: '1 to 2 short sentences', vi: '1 đến 2 câu ngắn' },
  medium: { en: '3 to 4 sentences', vi: '3 đến 4 câu' },
  long: { en: '5 to 7 sentences in 2 or 3 short paragraphs', vi: '5 đến 7 câu, chia 2 hoặc 3 đoạn ngắn' },
}

const scriptOf = (s: Script, lang: Lang) => `${lang === 'vi' ? 'Chủ đề' : 'Topic'}: ${s.topic[lang]}\n${lang === 'vi' ? 'Kịch bản' : 'Script'}:\n${s[lang].join('\n')}`

/** System and user prompt for the whole kit in one language; the answer is JSON. */
export function kitPrompt(lang: Lang, k: KitSettings, s: Script): [string, string] {
  const plats = k.platforms.map((p) => PLATFORMS.find((x) => x.id === p)!.name).join(', ')
  const keys = k.platforms.map((p) => `"${p}": "..."`).join(', ')
  if (lang === 'vi')
    return [
      [
        'Bạn viết nội dung đăng mạng xã hội bằng tiếng Việt tự nhiên, như người Việt nói. Không dịch từ tiếng Anh.',
        `Giọng văn: ${TONE_TEXT[k.tone].vi}.`,
        `Viết ${k.hooks} câu hook mở đầu video (mỗi câu tối đa 12 chữ, không emoji, không hashtag, mỗi câu một kiểu khác nhau).`,
        k.themes ? hookRule('vi') : '',
        `Viết ${k.titles} tiêu đề (tối đa 70 ký tự, không hashtag).`,
        `Viết caption cho từng nền tảng: ${plats}. Mỗi caption ${LENGTH_TEXT[k.length].vi}, hợp với nền tảng đó, KHÔNG có hashtag.`,
        k.emoji ? 'Caption có vài emoji hợp lý.' : 'Caption không có emoji.',
        k.cta ? 'Cuối mỗi caption có một câu kêu gọi (theo dõi, lưu, chia sẻ, bình luận) hợp với nền tảng.' : 'Không có câu kêu gọi hành động.',
        `Đưa ${Math.max(k.hashtags, 1)} hashtag liên quan (không có dấu #, không dấu cách, có thể có dấu tiếng Việt).`,
        `Chỉ trả về JSON đúng dạng: {"hooks": ["..."], "titles": ["..."], "captions": {${keys}}, "hashtags": ["..."]}`,
      ].filter(Boolean).join(' '),
      scriptOf(s, lang),
    ]
  return [
    [
      'You write social media copy in natural English.',
      `Tone: ${TONE_TEXT[k.tone].en}.`,
      `Write ${k.hooks} opening hooks for the video (at most 12 words each, no emoji, no hashtags, each a different style).`,
      k.themes ? hookRule('en') : '',
      `Write ${k.titles} titles (at most 70 characters, no hashtags).`,
      `Write a caption for each platform: ${plats}. Each caption is ${LENGTH_TEXT[k.length].en}, fits that platform, and has NO hashtags.`,
      k.emoji ? 'Captions use a few fitting emoji.' : 'Captions use no emoji.',
      k.cta ? 'Each caption ends with one call to action (follow, save, share, comment) that fits the platform.' : 'No call to action.',
      `Give ${Math.max(k.hashtags, 1)} relevant hashtags (no # sign, no spaces).`,
      `Return only JSON in exactly this shape: {"hooks": ["..."], "titles": ["..."], "captions": {${keys}}, "hashtags": ["..."]}`,
    ].filter(Boolean).join(' '),
    scriptOf(s, lang),
  ]
}

/** One new hook, title or caption, different from the ones already there. The answer is plain text. */
export function itemPrompt(lang: Lang, k: KitSettings, s: Script, kind: KitKind, avoid: string[], platform?: Platform): [string, string] {
  const name = PLATFORMS.find((x) => x.id === platform)?.name ?? 'TikTok'
  const what = {
    hook: lang === 'vi' ? 'một câu hook mở đầu video, tối đa 12 chữ, không emoji, không hashtag' : 'one opening hook for the video, at most 12 words, no emoji, no hashtags',
    title: lang === 'vi' ? 'một tiêu đề, tối đa 70 ký tự, không hashtag' : 'one title, at most 70 characters, no hashtags',
    caption:
      lang === 'vi'
        ? `một caption cho ${name}, ${LENGTH_TEXT[k.length].vi}, không hashtag${k.emoji ? ', có vài emoji' : ', không emoji'}${k.cta ? ', cuối có một câu kêu gọi hành động' : ''}`
        : `one ${name} caption, ${LENGTH_TEXT[k.length].en}, no hashtags${k.emoji ? ', a few emoji' : ', no emoji'}${k.cta ? ', ending with one call to action' : ''}`,
  }[kind] + (kind === 'hook' && k.themes ? `. ${hookRule(lang)}` : '')
  const not = avoid.filter(Boolean).slice(0, 10).map((a) => `- ${a.replace(/\s+/g, ' ').slice(0, 200)}`).join('\n')
  if (lang === 'vi')
    return [`Bạn viết nội dung mạng xã hội bằng tiếng Việt tự nhiên. Giọng văn: ${TONE_TEXT[k.tone].vi}. Viết ${what}. Phải khác hẳn các bản đã có. Chỉ trả về đúng nội dung đó, không giải thích, không ngoặc kép.`, `${scriptOf(s, lang)}${not ? `\nĐã có:\n${not}` : ''}`]
  return [`You write social media copy in natural English. Tone: ${TONE_TEXT[k.tone].en}. Write ${what}. It must be clearly different from the ones already there. Return only that text, no explanation, no quotes.`, `${scriptOf(s, lang)}${not ? `\nAlready there:\n${not}` : ''}`]
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max) : '')
const strs = (v: unknown, max: number, n: number) => [...new Set((Array.isArray(v) ? v : []).map((x) => str(x, max).replace(/^["“]+|["”]+$/g, '')).filter(Boolean))].slice(0, n)

/** "#Ocean Facts" / "oceanfacts" -> "OceanFacts"; keeps Vietnamese letters, drops the rest. */
export const cleanTag = (t: string) => t.replace(/^#+/, '').replace(/[^\p{L}\p{N}_]+/gu, '').slice(0, 40)

/** The AI's JSON answer (often wrapped in ``` or chatter) -> one language of the kit, or null. */
export function parseKit(text: string, k: KitSettings): KitLang | null {
  const m = /\{[\s\S]*\}/.exec(text)
  if (!m) return null
  let j: Record<string, unknown>
  try {
    j = JSON.parse(m[0]) as Record<string, unknown>
  } catch {
    return null
  }
  const caps = (j.captions ?? {}) as Record<string, unknown>
  const captions: Partial<Record<Platform, string>> = {}
  for (const p of k.platforms) {
    const c = str(caps[p], PLATFORMS.find((x) => x.id === p)!.limit)
    if (c) captions[p] = c.replace(/(?:\s*#[\p{L}\p{N}_]+)+\s*$/u, '').trim()
  }
  const out: KitLang = {
    hooks: strs(j.hooks, 160, k.hooks),
    titles: strs(j.titles, TITLE_LIMIT, k.titles),
    captions,
    hashtags: [...new Set(strs(j.hashtags, 60, 30).map(cleanTag).filter(Boolean))].slice(0, k.hashtags),
  }
  return out.hooks.length || out.titles.length || Object.keys(captions).length ? out : null
}

/** The first plain line of an answer for one item (or the whole text for a caption). */
export function parseItem(text: string, kind: KitKind): string {
  const t = text.replace(/^```\w*|```$/gm, '').trim()
  if (kind === 'caption') return t.replace(/(?:\s*#[\p{L}\p{N}_]+)+\s*$/u, '').trim().slice(0, 2200)
  return (t.split(/\r?\n/).map((l) => l.replace(/^\s*(?:[-*•]|\d+[.):])\s*/, '').replace(/^["“'«]+|["”'»]+$/g, '').trim()).find(Boolean) ?? '').slice(0, kind === 'title' ? TITLE_LIMIT : 160)
}

// ---------- the no-AI kit, from the script itself ----------

const lowerFirst = (s: string) => (/^[A-ZÀ-Ỹ][a-zà-ỹ]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s)
const noEnd = (s: string) => s.replace(/[.?!…]+$/, '')

const HOOKS: Record<Lang, ((t: string) => string)[]> = {
  en: [
    (t) => `Nobody talks about this: ${lowerFirst(t)}.`,
    (t) => `${t}: the part most people miss.`,
    (t) => `Stop scrolling. ${t}.`,
    (t) => `The truth about ${lowerFirst(t)}.`,
    (t) => `Watch to the end: ${lowerFirst(t)}.`,
    (t) => `I did not believe this either. ${t}.`,
    (t) => `Three seconds to see ${lowerFirst(t)} differently.`,
    (t) => `Did you know this? ${t}.`,
  ],
  vi: [
    (t) => `Ít ai nói về điều này: ${lowerFirst(t)}.`,
    (t) => `${t}: điều nhiều người bỏ lỡ.`,
    (t) => `Dừng lướt một chút. ${t}.`,
    (t) => `Sự thật về ${lowerFirst(t)}.`,
    (t) => `Xem đến cuối nhé: ${lowerFirst(t)}.`,
    (t) => `Mình cũng từng không tin. ${t}.`,
    (t) => `Ba giây để bạn nhìn khác về ${lowerFirst(t)}.`,
    (t) => `Bạn đã biết chưa? ${t}.`,
  ],
}
const TITLES: Record<Lang, ((t: string) => string)[]> = {
  en: [(t) => t, (t) => `${t} | EN + VI`, (t) => `${t}, explained in 60 seconds`, (t) => `The truth about ${lowerFirst(t)}`, (t) => `What nobody tells you: ${lowerFirst(t)}`, (t) => `${t} (you will not forget this)`, (t) => `Why ${lowerFirst(t)} matters`, (t) => `${t}: 1 minute, 1 new idea`, (t) => `Before you scroll: ${lowerFirst(t)}`],
  vi: [(t) => t, (t) => `${t} | Song ngữ`, (t) => `${t} trong 60 giây`, (t) => `Sự thật về ${lowerFirst(t)}`, (t) => `Điều ít ai nói: ${lowerFirst(t)}`, (t) => `${t} (xem là nhớ)`, (t) => `Vì sao ${lowerFirst(t)} lại quan trọng`, (t) => `${t}: 1 phút, 1 điều mới`, (t) => `Trước khi lướt: ${lowerFirst(t)}`],
}
const CTA: Record<Lang, Record<Platform, string>> = {
  en: { tiktok: 'Follow for part 2.', instagram: 'Save this for later and send it to a friend.', youtube: 'Subscribe for more shorts like this.', facebook: 'Share this with someone who would like it.' },
  vi: { tiktok: 'Theo dõi để xem phần 2 nhé.', instagram: 'Lưu lại để xem sau và gửi cho bạn bè nhé.', youtube: 'Đăng ký kênh để xem thêm video như thế này.', facebook: 'Chia sẻ cho người bạn nghĩ sẽ thích nhé.' },
}
const TONE_EMOJI: Record<Tone, string> = { curious: '🤔', friendly: '😊', bold: '🔥', calm: '🌿', funny: '😂', expert: '📌' }
const PLATFORM_TAGS: Record<Platform, string[]> = { tiktok: ['fyp', 'xuhuong'], instagram: ['reels', 'explore'], youtube: ['shorts', 'youtubeshorts'], facebook: ['reels', 'viral'] }
const STOP = new Set('the a an of and or to in on is are was for your you my our we it its why how what with that this not still never ever just mostly very really about from into more most la va cua cho voi nhung mot cac khi thi lai'.split(' '))
const wordsOf = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').match(/[a-z0-9]+/g) ?? []

function fallbackTags(s: Script, k: KitSettings, lang: Lang): string[] {
  const key = wordsOf(s.topic.en).filter((w) => !STOP.has(w) && w.length > 2)
  const keyVi = lang === 'vi' ? wordsOf(s.topic.vi).filter((w) => !STOP.has(w) && w.length > 2) : []
  const joined = key.length > 1 ? [key.slice(0, 3).join('')] : []
  const mode = { faceless: ['facts', 'didyouknow'], philosophy: ['mindset', 'philosophy'], trip: ['travel', 'travelvlog'] }[s.mode]
  const modeVi = { faceless: ['sựthật', 'kiếnthức'], philosophy: ['sốngchậm', 'triếtlý'], trip: ['dulịch', 'chuyếnđi'] }[s.mode]
  const plat = k.platforms.flatMap((p) => PLATFORM_TAGS[p])
  return [...new Set([...joined, ...keyVi.slice(0, 2), ...key.slice(0, 3), ...(lang === 'vi' ? modeVi : []), ...mode, ...plat])].map(cleanTag).filter(Boolean).slice(0, k.hashtags)
}

function fallbackCaption(s: Script, k: KitSettings, lang: Lang, p: Platform): string {
  const lines = s[lang].length ? s[lang] : [s.topic[lang]]
  const pick = k.length === 'short' ? [lines[0]] : k.length === 'medium' ? [lines[0], lines[lines.length - 1]] : lines
  const body = [...new Set(pick)].join(k.length === 'long' ? '\n\n' : ' ')
  const lead = k.emoji ? `${TONE_EMOJI[k.tone]} ` : ''
  return `${lead}${body}${k.cta ? `\n\n${CTA[lang][p]}${k.emoji ? ' 👇' : ''}` : ''}`
}

/** A full kit with no AI: template hooks and titles around the topic, captions from the script lines. */
export function fallbackKit(s: Script, k: KitSettings): PostKit {
  const kit: PostKit = {}
  for (const lang of k.langs) {
    const topic = noEnd(s.topic[lang] || s.topic.en)
    const first = s[lang][0]
    const hooks = [...new Set([...(first ? [first] : []), ...HOOKS[lang].map((f) => f(topic))])].slice(0, k.hooks)
    const titles = [...new Set([...TITLES[lang].map((f) => f(topic)), ...(first ? [`${noEnd(first)}…`] : [])])].map((x) => x.slice(0, TITLE_LIMIT)).slice(0, k.titles)
    const captions: Partial<Record<Platform, string>> = {}
    for (const p of k.platforms) captions[p] = fallbackCaption(s, k, lang, p)
    kit[lang] = { hooks, titles, captions, hashtags: fallbackTags(s, k, lang) }
  }
  return kit
}

/** AI answers can come up short: fill each list from the no-AI kit up to the asked number. */
export function fillKit(ai: KitLang | null, base: KitLang, k: KitSettings): KitLang {
  if (!ai) return base
  const pad = (a: string[], b: string[], n: number) => [...new Set([...a, ...b])].slice(0, n)
  const captions: Partial<Record<Platform, string>> = {}
  for (const p of k.platforms) captions[p] = ai.captions[p] || base.captions[p]
  return { hooks: pad(ai.hooks, base.hooks, k.hooks), titles: pad(ai.titles, base.titles, k.titles), captions, hashtags: pad(ai.hashtags, base.hashtags, k.hashtags) }
}

/** What gets copied: the caption, then the hashtags, cut to the platform's limit. */
export function fullCaption(kit: KitLang, p: Platform, tags = kit.hashtags.length): string {
  const limit = PLATFORMS.find((x) => x.id === p)?.limit ?? 2200
  const hash = kit.hashtags.slice(0, tags).map((t) => `#${t}`).join(' ')
  const text = `${kit.captions[p] ?? ''}${hash ? `\n\n${hash}` : ''}`.trim()
  return text.length > limit ? text.slice(0, limit) : text
}
