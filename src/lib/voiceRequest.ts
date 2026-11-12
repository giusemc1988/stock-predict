/**
 * Max voice request box: turn what Chanh said (or typed) into a clean prompt for Claude.
 * Pure text, no network, no AI call: free and instant.
 */

/** The Neo Hub project in the Claude app: the Send step copies the prompt, then opens this. */
export const CLAUDE_PROJECT_URL = 'https://claude.ai/code/project/chan_01NfgMG7G4GnxKVmGwjNnPXP'

const FILLERS = /(^|[\s,.])(ờ+|ừm+|ừ+|ừ thì|à+|ạ+|hử|ơ|uh+|um+|umm+|er|hmm+|you know|kiểu như là|tức là|thì là|thế là)(?=[\s,.?!]|$)/gi

/** Clean speech-to-text: drop filler sounds, repeated words, extra spaces, and fix the end of the sentence. */
export function tidySpeech(raw: string): string {
  let t = raw.replace(/\s+/g, ' ').trim()
  if (!t) return ''
  t = t.replace(FILLERS, '$1')
  // "làm làm cái này" -> "làm cái này" (same word twice in a row)
  t = t.replace(/(?<![\p{L}\p{N}'])([\p{L}\p{N}']+)(\s+\1(?![\p{L}\p{N}']))+/giu, '$1')
  t = t.replace(/\s+([,.?!])/g, '$1').replace(/([,.])\1+/g, '$1').replace(/^[,.\s]+/, '').replace(/\s{2,}/g, ' ').trim()
  if (!t) return ''
  t = t.charAt(0).toUpperCase() + t.slice(1)
  return /[.?!]$/.test(t) ? t : `${t}.`
}

/** Build the prompt Chanh reviews and sends to Claude. */
export function buildPrompt(raw: string, page = 'Max'): string {
  const ask = tidySpeech(raw)
  if (!ask) return ''
  return [
    `Yêu cầu từ trang ${page} (Neo Hub):`,
    '',
    ask,
    '',
    'Hãy làm như sau:',
    '1. Nói ngắn gọn em hiểu anh muốn gì (nếu hiểu theo hai cách thì chọn cách hợp lý nhất và nói rõ).',
    '2. Đưa phương án + các bước, chỉ giữ cái cần làm.',
    '3. Viết sẵn một prompt hoàn chỉnh để anh copy và paste cho Muse (Milo) thực hiện việc máy: cài đặt, copy file, cấu hình, kiểm tra, rồi ghi lại kết quả.',
    '',
    'Luật cũ vẫn giữ: miễn phí, không lộ key/secret, giải thích đơn giản bằng tiếng Việt, không xoá hay bỏ tính năng nếu chưa hỏi, trả lời ngắn để tiết kiệm token.',
  ].join('\n')
}

/** Browser speech language for the box: Vietnamese picks up mixed Vietnamese + English words best. */
export type VoiceLang = 'vi-VN' | 'en-US'

/** Join what was said earlier with a new phrase. */
export function appendSpeech(prev: string, add: string): string {
  const a = add.trim()
  if (!a) return prev
  return prev.trim() ? `${prev.trim()} ${a}` : a
}
