/**
 * Neo and the project agents. Neo runs the whole hub; each project page has its own agent, named
 * after the project (Atlas, Iris, Echo, Volt, Nexus, Nova, Viraltech, Lumi, Max). Pure functions:
 * which agent a page has, what a question about the hub asks for, and the answer, from data the app
 * already has. Nothing here changes a setting; opening a page is the only thing it can ask for.
 */
import type { Bi } from './hubText'
import { PROJECTS, pageOn, readyCount, type HubOn, type Project, type ProjectId } from './projects'
import { fold, type HubPage } from './toolHub'

export const HUB_AGENT = 'Neo'

/** The pages the app shows; 'home' is the Hub. Same list as TopBar's Page. */
export type AppPage = 'home' | 'brief' | 'trade' | 'portfolio' | 'net' | 'ruview' | 'godseye' | 'studio' | 'viraltech'

/** What each agent knows a project by, besides its name: old names and plain words, accents removed. */
const ALIASES: Record<ProjectId, string[]> = {
  atlas: ['stock predictor', 'stock predict', 'co phieu', 'chung khoan', 'trading', 'giao dich'],
  argus: ['argus', 'gods eye', 'god eye', 'dia cau', 'globe'],
  echo: ['ruview', 'cam bien'],
  volt: ['esp32', 'esp 32'],
  nexus: ['wifi', 'wi fi', 'bluetooth'],
  nova: ['video studio', 'studio video', 'lam video'],
  viraltech: ['virraltech', 'mang xa hoi', 'social'],
  lumi: ['media lab'],
  forge: ['forge', 'app builder', 'tao app'],
}

/** The project whose agent lives on this page; null on the Hub, where Neo answers. */
export function agentProject(page: AppPage): Project | null {
  const id: ProjectId | null =
    page === 'trade' || page === 'brief' || page === 'portfolio'
      ? 'atlas'
      : page === 'godseye'
        ? 'argus'
        : page === 'ruview'
          ? 'echo'
          : page === 'net'
            ? 'nexus'
            : page === 'studio'
              ? 'nova'
              : page === 'viraltech'
                ? 'viraltech'
                : null
  return PROJECTS.find((p) => p.id === id) ?? null
}

/** The name shown on the chat on this page. */
export const agentName = (page: AppPage) => agentProject(page)?.name ?? HUB_AGENT

/** What the agents need to say how the hub is doing. Every value comes from the app. */
export interface HubFacts {
  on: HubOn
  equity: number
  changePct: number
  openTrades: number
  buyCalls: number
  scanning: boolean
  killSwitch: boolean
  version: string
  updates: number
  posts: { scheduled: number; published: number; draft: number }
  channels: { linked: number; total: number }
}

const clean = (s: string) => ` ${fold(s).replace(/['’]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()} `
const has = (t: string, w: string) => t.includes(` ${w} `)

/** The project a sentence names, by name, old name or plain words; null when none or more than one. */
export function namedProject(text: string): Project | null {
  const t = clean(text)
  const hits = PROJECTS.filter((p) => has(t, fold(p.name)) || ALIASES[p.id].some((a) => has(t, a)))
  return hits.length === 1 ? hits[0] : null
}

export type HubAsk = { kind: 'who' } | { kind: 'list' } | { kind: 'open'; project: Project | 'hub' } | { kind: 'status'; project: Project }

const OPEN = /^ (mo|open|vao|go to|take me to|show me|chuyen sang|qua) /
const STATUS = / (the nao|sao roi|ra sao|tinh hinh|trang thai|status|how is|hows|how are|doing|chay khong|on khong|co chay) /
const LIST = / (cac du an|nhung du an|du an nao|projects|all projects|tat ca du an|hub dang|whole hub|ca hub) /
const WHO = / (ban la ai|em la ai|may la ai|who are you|your name|ten gi|lam duoc gi|what can you do) /

/**
 * A question about the hub rather than about trading. Named projects win; on a project page,
 * "how is it going" without a name means that page's project.
 */
export function parseHubAsk(text: string, page: AppPage): HubAsk | null {
  const t = clean(text)
  if (WHO.test(t)) return { kind: 'who' }
  const named = namedProject(text)
  if (OPEN.test(t)) {
    if (named) return { kind: 'open', project: named }
    if (has(t, 'hub') || has(t, 'trang chinh') || has(t, 'home') || has(t, fold(HUB_AGENT))) return { kind: 'open', project: 'hub' }
  }
  if (LIST.test(t)) return { kind: 'list' }
  if (named && STATUS.test(t)) return { kind: 'status', project: named }
  const here = agentProject(page)
  if (here && here.id !== 'atlas' && STATUS.test(t)) return { kind: 'status', project: here }
  return null
}

const n = (v: number, en: string, vi: string): Bi => ({ en: `${v} ${en}${v === 1 ? '' : 's'}`, vi: `${v} ${vi}` })
const usd = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`
const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`

/** The one thing worth saying about a project beyond on/off and its tools. */
function detail(p: Project, f: HubFacts): Bi | null {
  switch (p.id) {
    case 'atlas': {
      const open = n(f.openTrades, 'open practice trade', 'lệnh luyện tập đang mở')
      const buys = n(f.buyCalls, 'buy call', 'mã nên mua')
      return {
        en: `Practice account ${usd(f.equity)} (${pct(f.changePct)} since the start), ${open.en}, ${buys.en} today. The scanner is ${f.scanning ? 'running' : 'paused'}${f.killSwitch ? ' and the kill switch is ON' : ''}. Paper money only.`,
        vi: `Tài khoản luyện tập ${usd(f.equity)} (${pct(f.changePct)} so với lúc đầu), ${open.vi}, ${buys.vi} hôm nay. Máy quét đang ${f.scanning ? 'chạy' : 'nghỉ'}${f.killSwitch ? ', nút dừng khẩn cấp đang BẬT' : ''}. Chỉ là tiền ảo.`,
      }
    }
    case 'argus':
      return { en: 'Flights, quakes and satellites are on the globe; open it to see which layers answer right now.', vi: 'Máy bay, động đất và vệ tinh trên địa cầu; mở ra để xem lớp nào đang có dữ liệu.' }
    case 'echo':
      return { en: 'It needs the home PC agent running to read the sensors.', vi: 'Cần máy nhà (home agent) đang chạy mới đọc được cảm biến.' }
    case 'volt':
      return { en: 'You can flash an ESP32 straight from Chrome.', vi: 'Có thể nạp ESP32 ngay từ Chrome.' }
    case 'nexus':
      return { en: 'The Android app scans the Wi-Fi the phone is on.', vi: 'App Android quét Wi-Fi mà điện thoại đang kết nối.' }
    case 'nova':
      return { en: 'It writes and renders bilingual videos in the browser.', vi: 'Viết và dựng video song ngữ ngay trong trình duyệt.' }
    case 'viraltech':
      return {
        en: `${f.channels.linked} of ${f.channels.total} channels linked; ${f.posts.scheduled} scheduled, ${f.posts.published} published, ${f.posts.draft} drafts.`,
        vi: `${f.channels.linked}/${f.channels.total} kênh đã nối; ${f.posts.scheduled} bài hẹn giờ, ${f.posts.published} đã đăng, ${f.posts.draft} bản nháp.`,
      }
    case 'lumi':
      return { en: 'The Media Lab is not built yet.', vi: 'Media Lab chưa làm xong.' }
    case 'forge':
      return { en: `The app is on v${f.version} after ${f.updates} updates. Asking me to fix code or build an app comes in a later update.`, vi: `App đang ở v${f.version} sau ${f.updates} lần cập nhật. Nhờ em sửa code hay tạo app sẽ có ở bản sau.` }
  }
}

/** One project's state in a sentence or two. */
export function projectStatus(p: Project, f: HubFacts): Bi {
  const rc = readyCount(p, f.on)
  const on = p.opens == null ? p.id !== 'lumi' : pageOn(p.opens, f.on)
  const tools = rc.total ? { en: ` ${rc.ready} of ${rc.total} tools open.`, vi: ` ${rc.ready}/${rc.total} công cụ dùng được.` } : { en: '', vi: '' }
  const d = detail(p, f)
  if (!on)
    return p.id === 'lumi'
      ? { en: `${p.name} (${p.what.en}): ${d?.en}${tools.en}`, vi: `${p.name} (${p.what.vi}): ${d?.vi}${tools.vi}` }
      : { en: `${p.name} (${p.what.en}) is switched off. Turn it on in Settings > AI rules.`, vi: `${p.name} (${p.what.vi}) đang tắt. Bật lại trong Cài đặt > Luật AI.` }
  return { en: `${p.name} (${p.what.en}) is on.${tools.en} ${d?.en ?? ''}`.trim(), vi: `${p.name} (${p.what.vi}) đang bật.${tools.vi} ${d?.vi ?? ''}`.trim() }
}

/** Who is talking on this page, and what to ask. */
export function introduce(page: AppPage): Bi {
  const p = agentProject(page)
  if (!p)
    return {
      en: `I'm ${HUB_AGENT}, I run the whole hub. Ask "how is Nova?", "which projects are running?", "open Iris", or anything about Atlas.`,
      vi: `Em là ${HUB_AGENT}, em quản lý cả hub. Hỏi "Nova thế nào?", "các dự án đang ra sao?", "mở Iris", hoặc bất cứ gì về Atlas.`,
    }
  return {
    en: `I'm ${p.name}, the ${p.what.en} agent in ${HUB_AGENT}'s hub. Ask "how is it going?", or say "open" and another project's name.`,
    vi: `Em là ${p.name}, agent ${p.what.vi} trong hub của ${HUB_AGENT}. Hỏi "đang thế nào?", hoặc nói "mở" kèm tên dự án khác.`,
  }
}

/** Where the app should go to open a project; null when it has no page or the page is off. */
export function openTarget(p: Project, on: HubOn): HubPage | 'brief' | null {
  if (p.opens == null || !pageOn(p.opens, on)) return null
  return p.opens
}

/** The answer to a hub question, and the page to open when one was asked for. */
export function answerHub(ask: HubAsk, page: AppPage, f: HubFacts): { text: Bi[]; open?: HubPage | 'brief' | 'home' } {
  if (ask.kind === 'who') return { text: [introduce(page)] }
  if (ask.kind === 'list') {
    const lines = PROJECTS.map((p) => projectStatus(p, f))
    const on = PROJECTS.filter((p) => (p.opens == null ? p.id !== 'lumi' : pageOn(p.opens, f.on))).length
    return { text: [{ en: `${on} of ${PROJECTS.length} projects are on.`, vi: `${on}/${PROJECTS.length} dự án đang bật.` }, ...lines] }
  }
  if (ask.kind === 'open') {
    if (ask.project === 'hub') return { text: [{ en: 'Opening the Hub.', vi: 'Em mở Hub.' }], open: 'home' }
    const p = ask.project
    const to = openTarget(p, f.on)
    if (to) return { text: [{ en: `Opening ${p.name}.`, vi: `Em mở ${p.name}.` }], open: to }
    if (p.opens == null) return { text: [{ en: `${p.name} has no page of its own yet; its tools are on its Hub card.`, vi: `${p.name} chưa có trang riêng; công cụ nằm trên thẻ của nó ở Hub.` }] }
    return { text: [{ en: `${p.name} is switched off. Turn it on in Settings > AI rules, then ask again.`, vi: `${p.name} đang tắt. Bật trong Cài đặt > Luật AI rồi hỏi lại.` }] }
  }
  return { text: [projectStatus(ask.project, f)] }
}

/** Lines for the free-AI helper (it reads at most 12): who is speaking, this page's project, and every project in one line. */
export function hubFactsForAi(page: AppPage, f: HubFacts): string[] {
  const p = agentProject(page)
  const who = p ? `You are speaking as ${p.name}, the ${p.what.en} agent, part of ${HUB_AGENT}'s hub.` : `You are speaking as ${HUB_AGENT}, who runs the whole hub.`
  const isOn = (x: Project) => (x.opens == null ? x.id !== 'lumi' : pageOn(x.opens, f.on))
  const all = `Projects: ${PROJECTS.map((x) => `${x.name} (${x.what.en}) ${isOn(x) ? 'on' : x.id === 'lumi' ? 'not built yet' : 'off'}`).join('; ')}.`
  return [who, ...(p ? [projectStatus(p, f).en] : []), all]
}
