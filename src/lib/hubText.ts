/**
 * Every label on the Hub home page, in English and Vietnamese, in one place.
 * Each entry must have both languages; scripts/i18n.test.ts checks none is empty.
 */
import { useLang, type Lang } from './i18n'

export type Bi = { en: string; vi: string }

export const HUB_TEXT = {
  bestPick: { en: "Today's best pick", vi: 'Dự đoán tốt nhất hôm nay' },
  scanOff: { en: 'The practice scan is off (Settings > AI rules).', vi: 'Quét luyện tập đang tắt (Cài đặt > Quy tắc AI).' },
  noPickYet: { en: 'No BUY call passes the rules yet. It shows here when the next scan finds one.', vi: 'Chưa có lệnh MUA nào đạt quy tắc. Jarvis sẽ hiện ở đây khi lần quét tới tìm được.' },
  openTrading: { en: 'Open Trading', vi: 'Mở trang Trading' },
  why: { en: 'Why?', vi: 'Vì sao?' },
  tradeScore: { en: 'trade score (0-100)', vi: 'điểm giao dịch (0-100)' },
  analyst: { en: 'Analyst', vi: 'Phân tích' },
  volVsAvg: { en: 'Volume vs avg', vi: 'Khối lượng / TB' },
  rank: { en: 'Rank', vi: 'Hạng' },
  agentsAgree: { en: '{n} of 6 agents agree', vi: '{n}/6 agent đồng ý' },
  notProven: { en: 'Signals are not proven yet: Jarvis has not beaten SPY. Paper trading only.', vi: 'Tín hiệu chưa được chứng minh: Jarvis chưa thắng SPY. Chỉ giao dịch tiền ảo.' },
  board: { en: 'Prediction board', vi: 'Bảng dự đoán' },
  boardDots: { en: 'dots = 6 agents', vi: 'chấm = 6 agent' },
  boardEmpty: { en: 'No BUY calls in the last scan.', vi: 'Chưa có lệnh MUA nào trong lần quét gần nhất.' },
  signalFlow: { en: 'View signal flow', vi: 'Xem quy trình tín hiệu' },
  boardLegend: { en: 'Filled = agrees · ring = disagrees · faint = no data. Hover for the reason.', vi: 'Đặc = đồng ý · viền = không · mờ = chưa có dữ liệu. Rê chuột để xem lý do.' },
  studio: { en: 'Studio', vi: 'Studio' },
  comingSoon: { en: 'coming soon', vi: 'sắp có' },
  soon: { en: 'Soon', vi: 'Sắp có' },
  openTool: { en: 'Open →', vi: 'Mở →' },
  mediaLab: { en: 'Media Lab', vi: 'Media Lab' },
  mediaLabNote: { en: 'AI or real?', vi: 'AI hay thật?' },
  imageEdit: { en: 'Image edit', vi: 'Sửa hình' },
  imageEditNote: { en: 'Remove bg, covers', vi: 'Xóa nền, ảnh bìa' },
  videoEdit: { en: 'Video edit', vi: 'Sửa video' },
  videoEditNote: { en: 'Cut, captions', vi: 'Cắt, phụ đề' },
  outside: { en: 'Best outside tools (new tab)', vi: 'Tool tốt nhất bên ngoài (mở tab mới)' },
  outsideNote: { en: 'Free limits are set by each company and change often.', vi: 'Giới hạn miễn phí do các hãng đặt và hay thay đổi.' },
  klingNote: { en: 'Text to video, daily free credits', vi: 'Video từ chữ, có credit miễn phí mỗi ngày' },
  capcutNote: { en: 'Free editor, auto captions', vi: 'Sửa video miễn phí, phụ đề tự động' },
  opusNote: { en: 'Long video to short clips', vi: 'Cắt video dài thành clip ngắn' },
  geminiNote: { en: 'Make and edit images', vi: 'Tạo và sửa hình' },
  devices: { en: 'Projects, devices & home network', vi: 'Dự án, thiết bị và mạng nhà' },
  yoursOnly: { en: 'yours only', vi: 'chỉ của anh' },
  esp32: { en: 'ESP32 price screen', vi: 'ESP32 màn hình giá' },
  esp32Note: { en: 'Not connected yet', vi: 'Chưa kết nối' },
  bayNote: { en: 'Your AI agent: Jarvis sends tasks and gets results by API', vi: 'AI agent của anh: Jarvis gửi việc và nhận kết quả qua API' },
  homeNet: { en: 'Home network', vi: 'Mạng nhà' },
  homeNetNote: { en: 'Device list, Wi-Fi channels, speed test', vi: 'Danh sách thiết bị, kênh Wi-Fi, đo tốc độ' },
  ble: { en: 'Nearby Bluetooth', vi: 'Bluetooth gần đây' },
  bleNote: { en: 'Find a lost device', vi: 'Tìm đồ bị lạc' },
  ruview: { en: 'RuView sensing', vi: 'RuView cảm biến' },
  ruviewNote: { en: 'Presence at home from Wi-Fi signals, no camera (beta)', vi: 'Biết có người trong nhà bằng sóng Wi-Fi, không camera (beta)' },
  devicesNote: { en: 'For your own network and devices only. No attack tools.', vi: 'Chỉ dùng cho mạng và thiết bị của anh. Không có công cụ tấn công.' },
  navLabel: { en: 'Hub navigation', vi: 'Điều hướng hub' },
  tabPredict: { en: 'Predict', vi: 'Dự đoán' },
  tabTrading: { en: 'Trading', vi: 'Trading' },
  thTitle: { en: 'Tool Hub', vi: 'Tool Hub' },
  thGraph: { en: 'Graph', vi: 'Đồ thị' },
  thList: { en: 'List', vi: 'Danh sách' },
  thSearch: { en: 'Search tools… (e.g. flash, wifi, speed)', vi: 'Tìm công cụ… (ví dụ: nạp, wifi, tốc độ)' },
  thNone: { en: 'No tool matches.', vi: 'Không có công cụ nào khớp.' },
  thOff: { en: 'Off in Settings', vi: 'Đang tắt trong Cài đặt' },
  thOpensTab: { en: 'Opens a new tab', vi: 'Mở tab mới' },
  thNote: { en: 'Every item opens the real tool. Grey = coming soon or switched off in Settings > AI rules.', vi: 'Mục nào cũng mở đúng công cụ thật. Màu xám = sắp có hoặc đang tắt trong Cài đặt > Quy tắc AI.' },
  thOpenTrades: { en: '{n} open trades', vi: '{n} lệnh đang mở' },
  thCalls: { en: '{n} BUY calls', vi: '{n} lệnh MUA' },
  tabTools: { en: 'Tools', vi: 'Công cụ' },
  tabDevices: { en: 'Devices', vi: 'Thiết bị' },
  language: { en: 'Language', vi: 'Ngôn ngữ' },
} satisfies Record<string, Bi>

export type HubKey = keyof typeof HUB_TEXT

/** A hub label in the given language; `{n}` style slots are filled from `vars`. */
export function hubText(lang: Lang, key: HubKey, vars: Record<string, string | number> = {}) {
  return HUB_TEXT[key][lang].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`))
}

/** Translator for hub labels in the current language. */
export function useHubT() {
  const lang = useLang()
  return (key: HubKey, vars?: Record<string, string | number>) => hubText(lang, key, vars)
}
