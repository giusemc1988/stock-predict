/**
 * Video Studio scripts: modes, the AI prompt, the built-in library (works with no AI and no key),
 * and the Title Lab (titles, hashtags, captions in EN and VI). Pure functions, tested in scripts/studio.test.ts.
 */
export type StudioMode = 'faceless' | 'philosophy' | 'trip'
export type Lang = 'en' | 'vi'

export interface Script {
  topic: { en: string; vi: string }
  mode: StudioMode
  /** one line per scene; EN and VI are separate originals with the same scene count */
  en: string[]
  vi: string[]
}

const MODE_STYLE: Record<StudioMode, Record<Lang, string>> = {
  faceless: {
    en: 'A punchy faceless short: a hook, surprising true facts, and a closing line that makes people comment.',
    vi: 'Một video ngắn không lộ mặt, cuốn hút: câu mở đầu gây tò mò, vài sự thật bất ngờ, câu kết khiến người xem muốn bình luận.',
  },
  philosophy: {
    en: 'A calm philosophy short: simple, warm reflections about life. No technology words.',
    vi: 'Một video ngắn triết lý, nhẹ nhàng: suy ngẫm giản dị, ấm áp về cuộc sống. Không dùng từ ngữ công nghệ.',
  },
  trip: {
    en: 'A personal travel short told in first person: arrival, small moments, a feeling to take home.',
    vi: 'Một video ngắn kể chuyến đi ở ngôi thứ nhất: lúc đến, những khoảnh khắc nhỏ, cảm xúc mang về.',
  },
}

/** The channel's slide limits (Settings > Nova channel script rules): 3 to 5, 4 by default, about 44 s in all. */
export const CHANNEL = { min: 3, max: 5, def: 4, seconds: 44, maxSlide: 15 }

const CHANNEL_RULES: Record<Lang, string> = {
  en: ' Each line is one complete, meaningful idea that stands on its own. Tone: human behaviour and psychology facts told as recognition and self-defence, never how to manipulate anyone, never diagnosing a person, never invented statistics. Use concrete, vivid words.',
  vi: ' Mỗi dòng là một ý trọn vẹn, đứng được một mình. Giọng văn: sự thật về hành vi và tâm lý con người, kể theo hướng giúp người xem nhận ra và tự bảo vệ mình, không bao giờ dạy cách thao túng ai, không chẩn đoán ai, không bịa số liệu. Dùng từ cụ thể, có hình ảnh, đúng cách nói của người Việt.',
}

/**
 * System and user prompt for one language. Each language is asked on its own and told to write
 * natively, so the two scripts are two originals, not a translation of each other.
 */
export function studioPrompt(lang: Lang, mode: StudioMode, topic: string, scenes: number, channel = false): [string, string] {
  if (lang === 'vi')
    return [
      `Bạn là biên kịch video ngắn viết bằng tiếng Việt tự nhiên, như người Việt nói. ${MODE_STYLE[mode].vi} Không dịch từ tiếng Anh. Trả về đúng ${scenes} dòng, mỗi dòng là một cảnh, tối đa 16 chữ, không đánh số, không emoji, không hashtag.${channel ? CHANNEL_RULES.vi : ''}`,
      `Chủ đề: ${topic}`,
    ]
  return [
    `You are a short-video scriptwriter writing natural English. ${MODE_STYLE[mode].en} Return exactly ${scenes} lines, one per scene, at most 16 words each, no numbering, no emoji, no hashtags.${channel ? CHANNEL_RULES.en : ''}`,
    `Topic: ${topic}`,
  ]
}

/** Scene lines from an AI answer: drops numbering, bullets, quotes, JSON brackets and empty lines. */
export function parseScenes(text: string, max: number): string[] {
  const t = text.replace(/```[a-z]*/gi, '')
  // some models answer with a JSON array (or {"scenes": [...]}) on one line: that is the scenes, not one scene
  const arr = t.match(/\[[\s\S]*\]/)?.[0]
  if (arr) {
    try {
      const j = JSON.parse(arr) as unknown
      if (Array.isArray(j) && j.every((x) => typeof x === 'string')) return j.map((x) => x.trim()).filter((x) => x.length > 1).slice(0, max)
    } catch {
      /* not JSON: read it line by line */
    }
  }
  // "1. a 2. b 3. c" on one line: break before each number
  const lines = /\n/.test(t.trim()) ? t.split(/\r?\n/) : t.split(/\s+(?=\d+[.)]\s)/)
  return lines
    .map((l) => l.replace(/^\s*(?:[-*•>]|\d+[.):]|scene\s*\d+[:.-]?|cảnh\s*\d+[:.-]?)\s*/i, '').replace(/^["“'\[]+|["”'\],]+$/g, '').trim())
    .filter((l) => l.length > 1)
    .slice(0, max)
}

/** Built-in scripts: no AI, no key. EN and VI were written separately for each. */
export const LIBRARY: Script[] = [
  {
    mode: 'faceless',
    topic: { en: 'The ocean is mostly unexplored', vi: 'Đại dương gần như chưa được khám phá' },
    en: ['We have better maps of Mars than of our own ocean floor.', 'More than eighty percent of the ocean has never been seen by people.', 'Sunlight gives up about one kilometre down. Below that, it is night forever.', 'Down there, animals make their own light to hunt and to hide.', 'What do you think is still waiting in the dark?'],
    vi: ['Bản đồ sao Hỏa còn rõ hơn bản đồ đáy biển của chính chúng ta.', 'Hơn tám mươi phần trăm đại dương chưa từng có ai nhìn thấy.', 'Xuống sâu chừng một cây số là ánh nắng tắt hẳn, đêm kéo dài mãi mãi.', 'Ở dưới đó, sinh vật tự phát sáng để săn mồi và lẩn trốn.', 'Theo bạn, còn điều gì đang chờ trong bóng tối ấy?'],
  },
  {
    mode: 'faceless',
    topic: { en: 'Why honey never spoils', vi: 'Vì sao mật ong không bao giờ hỏng' },
    en: ['Archaeologists found honey in Egyptian tombs that was still safe to eat.', 'Honey has so little water that bacteria simply dry out inside it.', 'Bees add an enzyme that slowly makes a mild natural disinfectant.', 'Seal the jar and it can outlast the person who bought it.', 'What food in your kitchen would you bet lasts longest?'],
    vi: ['Người ta tìm thấy mật ong trong lăng mộ Ai Cập mà vẫn ăn được.', 'Mật ong ít nước đến mức vi khuẩn vào là bị rút khô.', 'Ong còn tiết ra một loại men, tạo thành chất sát khuẩn nhẹ tự nhiên.', 'Đậy kín nắp, hũ mật có thể sống lâu hơn cả người mua nó.', 'Trong bếp nhà bạn, món nào để được lâu nhất?'],
  },
  {
    mode: 'faceless',
    topic: { en: 'Your brain on a walk', vi: 'Bộ não khi bạn đi bộ' },
    en: ['A twenty-minute walk can change how your brain feels for hours.', 'Blood flow rises, and so does a protein that helps brain cells grow.', 'Many people get their best ideas while walking, not sitting.', 'No gym, no app, no subscription. Just shoes.', 'When did you last walk with no phone in your hand?'],
    vi: ['Chỉ hai mươi phút đi bộ đã đủ làm đầu óc bạn khác đi cả buổi.', 'Máu lên não nhiều hơn, kèm một loại đạm giúp tế bào não phát triển.', 'Nhiều người nảy ra ý hay khi đang đi, chứ không phải lúc ngồi.', 'Không cần phòng gym, không cần app, chỉ cần một đôi giày.', 'Lần cuối bạn đi bộ mà không cầm điện thoại là khi nào?'],
  },
  {
    mode: 'philosophy',
    topic: { en: 'Slow is not behind', vi: 'Chậm không có nghĩa là thua' },
    en: ['Some flowers bloom in spring. Some wait for autumn.', 'Nobody tells the late flower it has failed.', 'Your pace is not a race against anyone else.', 'Water is soft, and still it shapes the stone.', 'Keep going. Gently is still going.'],
    vi: ['Có loài hoa nở mùa xuân, có loài đợi đến mùa thu.', 'Chẳng ai trách bông hoa nở muộn là thất bại.', 'Nhịp sống của bạn đâu phải cuộc đua với ai.', 'Nước mềm mại, vậy mà vẫn mài mòn được đá.', 'Cứ bước tiếp. Đi chậm vẫn là đang đi.'],
  },
  {
    mode: 'philosophy',
    topic: { en: 'What you can carry', vi: 'Những gì mình mang theo được' },
    en: ['You cannot carry every worry and still walk light.', 'Put down what was never yours to hold.', 'Keep the people who make silence feel easy.', 'A small, clear life is not a small life.', 'Travel light. Arrive kind.'],
    vi: ['Ôm hết mọi lo toan thì làm sao bước nhẹ được.', 'Hãy đặt xuống những thứ vốn không phải của mình.', 'Giữ lại những người mà ngồi im bên nhau cũng thấy dễ chịu.', 'Sống gọn gàng, rõ ràng đâu có nghĩa là sống nhỏ bé.', 'Mang ít hành lý. Đến nơi bằng sự tử tế.'],
  },
  {
    mode: 'trip',
    topic: { en: 'A weekend away', vi: 'Một cuối tuần đi xa' },
    en: ['We left before sunrise, coffee still too hot to drink.', 'The road opened up and the city noise fell behind.', 'Small things stayed with me: a street, a smile, a long lunch.', 'Nothing big happened, and that was the best part.', 'Already planning the next one.'],
    vi: ['Đi từ lúc trời chưa sáng, ly cà phê còn nóng chưa uống được.', 'Đường mở ra, tiếng ồn thành phố lùi lại phía sau.', 'Những điều nhỏ cứ ở lại: một góc phố, một nụ cười, bữa trưa thật dài.', 'Chẳng có gì to tát, và đó mới là phần hay nhất.', 'Đã bắt đầu tính chuyến sau rồi.'],
  },
]

export const libraryFor = (mode: StudioMode) => LIBRARY.filter((s) => s.mode === mode)

/** Lines a person typed: one scene per line in each box. Both sides are cut to the shorter one. */
export function fromText(topic: string, mode: StudioMode, en: string, vi: string, topicVi = ''): Script {
  const a = parseScenes(en, 12)
  const b = parseScenes(vi, 12)
  const n = Math.min(a.length, b.length)
  // no Vietnamese topic typed: the Vietnamese hook line stands in, never the English topic
  return { topic: { en: topic, vi: topicVi.trim() || b[0] || topic }, mode, en: a.slice(0, n), vi: b.slice(0, n) }
}

const words = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').match(/[a-z0-9]+/g) ?? []
const STOP = new Set('the a an of and or to in on is are was for your you my our we it its why how what with that this not still never ever just mostly very really about from into more most'.split(' '))
const MODE_TAGS: Record<StudioMode, string[]> = { faceless: ['facts', 'didyouknow', 'shorts'], philosophy: ['philosophy', 'mindset', 'shorts'], trip: ['travel', 'travelvlog', 'shorts'] }
const MODE_TAGS_VI: Record<StudioMode, string[]> = { faceless: ['sựthật', 'cóthểbạnchưabiết'], philosophy: ['triết lý', 'sống chậm'].map((t) => t.replace(/\s/g, '')), trip: ['dulịch', 'chuyếnđi'] }

export interface TitleLab {
  titles: { en: string[]; vi: string[] }
  hashtags: string[]
  caption: { en: string; vi: string }
}

/** Titles, hashtags and captions from the script itself (no AI needed). */
export function titleLab(s: Script): TitleLab {
  const tEn = s.topic.en.replace(/\.$/, '')
  const tVi = s.topic.vi.replace(/\.$/, '')
  const hook = { en: s.en[0] ?? tEn, vi: s.vi[0] ?? tVi }
  const key = words(tEn).filter((w) => !STOP.has(w) && w.length > 2).slice(0, 3)
  const hashtags = [...new Set([...key, ...MODE_TAGS[s.mode], ...MODE_TAGS_VI[s.mode]])].map((w) => `#${w}`)
  const titles = {
    en: s.mode === 'trip' ? [tEn, `${tEn} (EN/VI)`, `A little ${tEn.toLowerCase()}`] : [tEn, `${tEn} | EN + VI`, `${hook.en.replace(/[.?!]$/, '')}…`],
    vi: s.mode === 'trip' ? [tVi, `${tVi} (VI/EN)`, `Nhật ký: ${tVi.toLowerCase()}`] : [tVi, `${tVi} | Song ngữ`, `${hook.vi.replace(/[.?!]$/, '')}…`],
  }
  const tags = hashtags.join(' ')
  return {
    titles,
    hashtags,
    caption: { en: `${hook.en}\n\n${s.en[s.en.length - 1] ?? ''}\n\n${tags}`, vi: `${hook.vi}\n\n${s.vi[s.vi.length - 1] ?? ''}\n\n${tags}` },
  }
}
