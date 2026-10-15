/**
 * One turn of a conversation with Jarvis, typed or spoken: works out what was asked and what to
 * answer, from the app's own records. It changes nothing: an action comes back as a proposal
 * that you confirm, and a stock or replay comes back for the app to open.
 */
import { understand } from './listen'
import { alreadySo, describeAction, parseCommand, type JarvisAction } from './jarvisActions'
import { ask, greeting, stockMemory, type AskContext, type Bi } from './jarvis'

export interface ChatTurn {
  who: 'me' | 'jarvis'
  text: Bi
  time: number
  /** A change Jarvis proposed; it waits for your tap. */
  action?: JarvisAction
  settled?: 'done' | 'cancelled'
  /** The free-AI helper that wrote this answer, e.g. "Gemini". */
  by?: string
}

export interface ChatReply {
  text: Bi[]
  action?: JarvisAction
  /** Open this stock and explain it on the chart. */
  stock?: string
  /** Walk through this practice trade on the chart. */
  trade?: string
  replay?: boolean
  /** Jarvis didn't understand; the free-AI helper may answer instead, if switched on. */
  unsure?: boolean
}

export interface ChatDeps {
  ctx: AskContext
  name: string
  known: { symbol: string; name: string }[]
  watchlist: string[]
  canAct: boolean
  canStock: boolean
  canReplay: boolean
  canShow: boolean
}

const HELLO = /^\s*(hi|hello|hey|good (morning|afternoon|evening)|yo|chào|xin chào|alo)\b/i

export function chatReply(text: string, d: ChatDeps): ChatReply {
  const { ctx } = d
  const cmd = d.canAct ? parseCommand(text, d.known) : null
  if (cmd) {
    const what = describeAction(cmd)
    if (alreadySo(cmd, ctx.rules, ctx.killSwitch, d.watchlist)) return { text: [{ en: `No need: "${what.en}" is already the case.`, vi: `Không cần: "${what.vi}" đã như vậy rồi.` }] }
    return { text: [{ en: `I can ${what.en.charAt(0).toLowerCase()}${what.en.slice(1)}. Tap Do it to confirm.`, vi: `Tôi có thể: ${what.vi}. Bấm Làm đi để xác nhận.` }], action: cmd }
  }
  const u = understand(text, d.known)
  if (u?.kind === 'stock' && d.canStock) return { text: [...stockMemory(u.symbol, ctx.state), { en: `Opening ${u.symbol} now; I'll walk you through it on the chart.`, vi: `Đang mở ${u.symbol}; tôi sẽ giải thích trên biểu đồ.` }], stock: u.symbol }
  if (u?.kind === 'replay' && d.canReplay) return { text: [{ en: "Let's replay today's practice trades on the chart.", vi: 'Cùng xem lại các lệnh luyện tập hôm nay trên biểu đồ.' }], replay: true }
  if (u?.kind === 'ask') {
    const lines = ask(u.id, ctx)
    const last = [...ctx.state.open, ...ctx.state.trades].sort((a, b) => b.openedAt - a.openedAt)[0]
    return u.id === 'whyBuy' && d.canShow && last ? { text: lines, trade: last.id } : { text: lines }
  }
  if (HELLO.test(text)) return { text: [greeting(d.name, ctx.state, ctx.killSwitch, ctx.now)] }
  // not sure what was asked: talk about the stock on screen rather than give up
  if (ctx.symbol)
    return {
      unsure: true,
      text: [
        { en: `I'm not sure I understood, so here's what I know about ${ctx.symbol}, the stock on screen.`, vi: `Tôi chưa chắc đã hiểu, nên đây là điều tôi biết về ${ctx.symbol}, mã đang xem.` },
        ...ask('thisStock', ctx),
        { en: 'You can also ask "did you buy it too high?", "what\'s my risk" or "why TSLA?".', vi: 'Bạn cũng có thể hỏi "bạn có mua giá cao không?", "rủi ro" hoặc "vì sao TSLA?".' },
      ],
    }
  return {
    unsure: true,
    text: [
      {
        en: 'I didn\'t catch that. Try a stock ("why AAPL?"), "what\'s my risk", "what have you learned", "pause practice" or "replay today".',
        vi: 'Tôi chưa hiểu. Thử hỏi một mã ("vì sao AAPL?"), "rủi ro", "bạn học được gì", "tạm dừng luyện tập" hoặc "xem lại hôm nay".',
      },
    ],
  }
}

const CHAT_KEY = 'arc.jarvisChat.v1'
export const MAX_CHAT = 60

export function loadChat(): ChatTurn[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAT_KEY) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export function saveChat(turns: ChatTurn[]) {
  try {
    localStorage.setItem(CHAT_KEY, JSON.stringify(turns.slice(-MAX_CHAT)))
  } catch {
    /* storage blocked: the chat lasts for this visit only */
  }
}

/** Plain-words help when the microphone fails. */
export function listenProblem(err: string): Bi | null {
  if (!err || err === 'aborted') return null
  if (err === 'no-speech') return { en: "I didn't hear anything. Tap the mic, wait for \"Listening\", then speak.", vi: 'Tôi không nghe thấy gì. Bấm micro, đợi chữ "Đang nghe" rồi nói.' }
  if (err === 'not-allowed' || err === 'service-not-allowed')
    return {
      en: 'The microphone is blocked. Allow it for this site (tap the lock or "aA" icon next to the address), then tap the mic again. You can also type below.',
      vi: 'Micro đang bị chặn. Cho phép micro cho trang này (bấm biểu tượng ổ khóa hoặc "aA" cạnh địa chỉ), rồi bấm micro lại. Bạn cũng có thể gõ bên dưới.',
    }
  if (err === 'unsupported') return { en: "This browser can't listen. Type below, or use the mic key on your keyboard. Chrome, Edge and Safari can listen.", vi: 'Trình duyệt này không nghe được. Hãy gõ bên dưới hoặc dùng nút micro trên bàn phím. Chrome, Edge và Safari nghe được.' }
  if (err === 'network') return { en: 'Listening needs the internet in this browser. Check your connection, or type below.', vi: 'Trình duyệt cần mạng để nghe. Kiểm tra kết nối hoặc gõ bên dưới.' }
  return { en: `I couldn't hear you (${err}). Try again, or type below.`, vi: `Tôi không nghe được (${err}). Thử lại hoặc gõ bên dưới.` }
}
