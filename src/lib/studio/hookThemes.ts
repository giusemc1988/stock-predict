import type { Lang } from './script'

/**
 * Chanh's default hook themes for the Faceless channel (2026-10-30). Tech / Google News hooks are not banned or deleted:
 * they stay in their own "saved for later" block and are used only when he says he is making a tech or news video.
 */
export interface HookTheme {
  id: 'dark' | 'sad' | 'daily' | 'nature'
  name: Record<Lang, string>
  /** the rule given to the AI when it writes a hook */
  rule: Record<Lang, string>
  /** topic ideas, tap to use */
  seeds: { en: string; vi: string }[]
}

export const HOOK_THEMES: HookTheme[] = [
  {
    id: 'dark',
    name: { en: 'Dark psychology', vi: 'Tâm lý đen tối' },
    rule: { en: 'dark psychology, only to recognise it and defend yourself, never teaching manipulation, never diagnosing', vi: 'tâm lý đen tối, chỉ để nhận diện và tự vệ, không dạy thao túng, không chẩn đoán' },
    seeds: [
      { en: 'The person who only calls when they need something', vi: 'Người chỉ gọi khi cần anh giúp' },
      { en: 'Silence as a punishment', vi: 'Im lặng để trừng phạt' },
      { en: 'Guilt-tripping dressed up as love', vi: 'Bắt anh thấy có lỗi, gọi đó là yêu' },
      { en: 'Sweet words that never become actions', vi: 'Lời ngọt không bao giờ thành việc làm' },
    ],
  },
  {
    id: 'sad',
    name: { en: 'Sad truths', vi: 'Sự thật buồn' },
    rule: { en: 'a sad truth about people that everyone has lived through', vi: 'một sự thật buồn về con người mà ai cũng từng trải' },
    seeds: [
      { en: 'Friends drift apart without a fight', vi: 'Bạn bè xa nhau không cần một lần cãi vã' },
      { en: 'Nobody notices the day you stop trying', vi: 'Không ai để ý ngày anh thôi cố gắng' },
      { en: 'You grow up the day you stop explaining yourself', vi: 'Lớn lên là khi thôi giải thích với người không muốn hiểu' },
      { en: 'Some people only miss you when they are alone', vi: 'Có người chỉ nhớ anh khi họ cô đơn' },
    ],
  },
  {
    id: 'daily',
    name: { en: 'Everyday moments', vi: 'Khoảnh khắc đời thường' },
    rule: { en: 'a small everyday moment that touches the heart, remembering how it felt more than what was said', vi: 'một khoảnh khắc đời thường dễ chạm tim, nhớ cảm giác hơn nhớ lời nói' },
    seeds: [
      { en: 'A real friend asks "did you eat?" not "are you okay?"', vi: 'Bạn thật hỏi "ăn chưa" thay vì "ổn không"' },
      { en: 'The light left on for you at night', vi: 'Ngọn đèn ai đó chừa lại cho anh ban đêm' },
      { en: 'A message that only says "home safe?"', vi: 'Tin nhắn chỉ có ba chữ "về tới chưa"' },
      { en: 'You forget the words but never the feeling', vi: 'Anh quên lời họ nói, nhưng không quên cảm giác họ để lại' },
    ],
  },
  {
    id: 'nature',
    name: { en: 'Flying nature', vi: 'Thiên nhiên bay' },
    rule: { en: 'flying nature tied to a feeling: rain, flying, a castle, the sea', vi: 'thiên nhiên bay gắn với cảm xúc: mưa, bay, lâu đài, biển' },
    seeds: [
      { en: 'Flying above the clouds when the heart is heavy', vi: 'Bay trên mây khi lòng đang nặng' },
      { en: 'Rain that washes the tiredness away', vi: 'Cơn mưa rửa trôi mệt mỏi' },
      { en: 'A castle in the clouds, quiet at last', vi: 'Lâu đài trên mây, cuối cùng cũng yên' },
      { en: 'The sea does not answer, and that is why we tell it everything', vi: 'Biển không trả lời, nên anh kể hết cho biển' },
    ],
  },
]

/** The sentence added to the hook prompts. */
export function hookRule(lang: Lang): string {
  const list = HOOK_THEMES.map((t, i) => `${i + 1}. ${t.rule[lang]}`).join('; ')
  return lang === 'vi'
    ? `Mỗi hook chỉ thuộc một trong 4 nhóm: ${list}. Hook là 1 câu ngắn, dưới 15 chữ, tiếng Việt cụ thể, có hình ảnh, khớp với kịch bản và nền video. Không dùng hook về công nghệ hay tin tức.`
    : `Each hook belongs to exactly one of 4 themes: ${list}. A hook is one short sentence, under 15 words, concrete, with an image, matching the script and the video background. No tech or news hooks.`
}
