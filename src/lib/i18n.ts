/**
 * English and Vietnamese labels. The language is saved in this browser only.
 * Longer generated text (analyst reasons, robot tags, backtest notes) stays in English.
 */
import { useSyncExternalStore } from 'react'

export type Lang = 'en' | 'vi'

const en = {
  trade: 'Trade',
  portfolio: 'Portfolio',
  watchlist: 'Watchlist',
  all: 'All',
  crypto: 'Crypto',
  stocks: 'Stocks',
  sortDefault: 'Default',
  sortGainers: 'Top gainers',
  sortLosers: 'Top losers',
  sortVolume: 'Top volume',
  sortSuccess: 'Top AI signal success',
  aiAnalyst: 'AI Analyst',
  buyersSellers: 'Buyers & Sellers',
  learning: 'Learning',
  aiPicks: 'AI Picks',
  scanMyList: 'Scan my list',
  scanAgain: 'Scan again',
  scanning: 'Scanning…',
  picksIntro: "The analyst's call on each stock in your list, best first. Confidence is capped when the track record is weak. Not financial advice; paper trading only.",
  topAiCall: 'Top AI call',
  topAiSuccess: 'Top AI signal success',
  call: 'Call',
  confidence: 'Confidence',
  pastWinRate: 'Past win rate',
  why: 'Why',
  trades: 'trades',
  noTrades: 'no trades',
  smallSample: 'small sample',
  noData: 'No data for',
  notEnoughHistory: 'Not enough history to analyse yet.',
  successNote: "Win rate is from the app's backtest of past signals on each stock. Under 30 trades it is noise, not a track record.",
  scanFirst: 'Run "Scan my list" in the AI Picks tab first.',
  successFromScan: 'Past win rate from the last AI Picks scan. Under 30 trades is noise. Not financial advice.',
  open: 'open',
  settings: 'Settings',
  language: 'Language',
  chartSettings: 'Chart settings',
  smaPeriod: 'SMA period',
  bollPeriod: 'Bollinger period',
  bollWidth: 'Bollinger width (σ)',
  savedHere: 'Saved in this browser. Periods are clamped to 2–200 when loaded.',
  volume: 'Volume',
  whatsNew: "What's new",
  gotIt: 'Got it',
  notAdvice: 'Not financial advice. Paper trading only.',
  edge: 'edge',
  noEdge: 'no edge',
  inputsNote: 'These inputs describe the past. They do not predict the next move. Not financial advice.',
  rsi: 'RSI (14)',
  volVsAvg: 'Volume vs 20-bar average',
  buyShare: 'Buying share of recent volume',
  estimated: '(estimated from price)',
  reported: '(reported)',
  newsItems: 'News items: not connected yet',
  backtestLine: 'Backtest on this stock',
  strategyVsHold: 'strategy vs buy-and-hold',
  result: 'Result',
  analystReasons: "The analyst's reasons:",
  notEnoughData: 'not enough data',
  learnUpdated: 'App version',
  learnDataUpdated: 'Data updated',
  learnPaper: 'Paper research only, not financial advice.',
  directionModels: 'Direction models (accuracy vs always-up)',
  replayTitle: 'Journal learner replay, by year',
  lessons: 'What we learned',
  dailyRuns: 'Daily runs',
  noDailyRuns: 'No daily runs recorded yet.',
  horizonDay: 'day horizon',
  year: 'Year',
  learnerTrades: 'Learner trades',
  learnerHit: 'Learner hit rate',
  alwaysBuyHit: 'Always-buy hit rate',
  alwaysUp: 'Always up',
  logistic: 'Logistic',
  symbol: 'Symbol',
  of: 'of',
  horizon: 'Horizon',
  aiRules: 'AI rules',
  editAiRules: 'Edit AI rules',
  aiRulesIntro: 'Change how the AI analyst decides, sizes and checks orders. Saved in this browser. Paper trading only; not financial advice.',
  rulesCall: 'The call',
  rulesSizing: 'Position size (% of account)',
  rulesGates: 'Risk gates',
  rulesCosts: 'Trading costs (paper fills)',
  rulesModules: 'Modules',
  rulesJarvis: 'Jarvis, the Arc Brain',
  resetDefaults: 'Reset to defaults',
  save: 'Save',
  cancel: 'Cancel',
  appVersion: 'App version',
  stopAndScale: 'AI stop loss and scaling',
  stopLoss: 'Stop loss',
  scaleNote: '% is the share of the planned position. Open order ticket fills the stop and the 2R take-profit; scale-ins and partial exits you place yourself. Not financial advice.',
} as const

export type Key = keyof typeof en

const vi: Record<Key, string> = {
  trade: 'Giao dịch',
  portfolio: 'Danh mục',
  watchlist: 'Danh sách theo dõi',
  all: 'Tất cả',
  crypto: 'Tiền điện tử',
  stocks: 'Cổ phiếu',
  sortDefault: 'Mặc định',
  sortGainers: 'Tăng mạnh nhất',
  sortLosers: 'Giảm mạnh nhất',
  sortVolume: 'Khối lượng lớn nhất',
  sortSuccess: 'Tín hiệu AI thành công nhất',
  aiAnalyst: 'Phân tích AI',
  buyersSellers: 'Người mua & người bán',
  learning: 'Học tập',
  aiPicks: 'Gợi ý AI',
  scanMyList: 'Quét danh sách',
  scanAgain: 'Quét lại',
  scanning: 'Đang quét…',
  picksIntro: 'Khuyến nghị của phân tích AI cho từng cổ phiếu trong danh sách, xếp theo thứ tự tốt nhất trước. Độ tin cậy bị giới hạn khi lịch sử kém. Không phải lời khuyên đầu tư; chỉ giao dịch thử nghiệm.',
  topAiCall: 'Khuyến nghị AI hàng đầu',
  topAiSuccess: 'Tín hiệu AI thành công nhất',
  call: 'Khuyến nghị',
  confidence: 'Độ tin cậy',
  pastWinRate: 'Tỷ lệ thắng trong quá khứ',
  why: 'Lý do',
  trades: 'giao dịch',
  noTrades: 'chưa có giao dịch',
  smallSample: 'mẫu nhỏ',
  noData: 'Không có dữ liệu cho',
  notEnoughHistory: 'Chưa đủ lịch sử để phân tích.',
  successNote: 'Tỷ lệ thắng lấy từ kiểm thử lại các tín hiệu trước đây của ứng dụng trên từng cổ phiếu. Dưới 30 giao dịch thì chỉ là nhiễu, không phải thành tích thật.',
  scanFirst: 'Hãy bấm "Quét danh sách" trong tab Gợi ý AI trước.',
  successFromScan: 'Tỷ lệ thắng trong quá khứ từ lần quét Gợi ý AI gần nhất. Dưới 30 giao dịch là nhiễu. Không phải lời khuyên đầu tư.',
  open: 'mở',
  settings: 'Cài đặt',
  language: 'Ngôn ngữ',
  chartSettings: 'Cài đặt biểu đồ',
  smaPeriod: 'Chu kỳ SMA',
  bollPeriod: 'Chu kỳ Bollinger',
  bollWidth: 'Độ rộng Bollinger (σ)',
  savedHere: 'Lưu trong trình duyệt này. Chu kỳ được giới hạn trong khoảng 2–200 khi tải.',
  volume: 'Khối lượng',
  whatsNew: 'Có gì mới',
  gotIt: 'Đã hiểu',
  notAdvice: 'Không phải lời khuyên đầu tư. Chỉ giao dịch thử nghiệm.',
  edge: 'có lợi thế',
  noEdge: 'không có lợi thế',
  inputsNote: 'Các chỉ số này mô tả quá khứ. Chúng không dự đoán biến động tiếp theo. Không phải lời khuyên đầu tư.',
  rsi: 'RSI (14)',
  volVsAvg: 'Khối lượng so với trung bình 20 nến',
  buyShare: 'Tỷ lệ mua trong khối lượng gần đây',
  estimated: '(ước tính từ giá)',
  reported: '(do sàn báo cáo)',
  newsItems: 'Tin tức: chưa kết nối',
  backtestLine: 'Kiểm thử lại trên cổ phiếu này',
  strategyVsHold: 'chiến lược so với mua và giữ',
  result: 'Kết quả',
  analystReasons: 'Lý do của phân tích AI:',
  notEnoughData: 'chưa đủ dữ liệu',
  learnUpdated: 'Phiên bản ứng dụng',
  learnDataUpdated: 'Dữ liệu cập nhật',
  learnPaper: 'Chỉ là nghiên cứu thử nghiệm, không phải lời khuyên đầu tư.',
  directionModels: 'Mô hình xu hướng (độ chính xác so với luôn tăng)',
  replayTitle: 'Kiểm thử lại bộ học theo năm',
  lessons: 'Những điều đã học được',
  dailyRuns: 'Lần chạy hằng ngày',
  noDailyRuns: 'Chưa có lần chạy hằng ngày nào.',
  horizonDay: 'ngày',
  year: 'Năm',
  learnerTrades: 'Số giao dịch của bộ học',
  learnerHit: 'Tỷ lệ thắng của bộ học',
  alwaysBuyHit: 'Tỷ lệ thắng nếu luôn mua',
  alwaysUp: 'Luôn tăng',
  logistic: 'Hồi quy logistic',
  symbol: 'Mã',
  of: 'trên',
  horizon: 'Kỳ hạn',
  aiRules: 'Quy tắc AI',
  editAiRules: 'Sửa quy tắc AI',
  aiRulesIntro: 'Thay đổi cách phân tích AI ra quyết định, tính khối lượng và kiểm tra lệnh. Lưu trong trình duyệt này. Chỉ giao dịch thử nghiệm; không phải lời khuyên đầu tư.',
  rulesCall: 'Khuyến nghị',
  rulesSizing: 'Khối lượng vị thế (% tài khoản)',
  rulesGates: 'Cổng rủi ro',
  rulesCosts: 'Chi phí giao dịch (khớp lệnh thử nghiệm)',
  rulesModules: 'Mô-đun',
  rulesJarvis: 'Jarvis, Bộ não Arc',
  resetDefaults: 'Khôi phục mặc định',
  save: 'Lưu',
  cancel: 'Hủy',
  appVersion: 'Phiên bản ứng dụng',
  stopAndScale: 'Cắt lỗ và chia lệnh của AI',
  stopLoss: 'Cắt lỗ',
  scaleNote: '% là tỷ lệ của vị thế dự kiến. Mở phiếu lệnh sẽ điền sẵn cắt lỗ và chốt lời 2R; các lệnh mua thêm và chốt từng phần bạn tự đặt. Không phải lời khuyên đầu tư.',
}

const DICT: Record<Lang, Record<Key, string>> = { en, vi }
const EVENT = 'bluechip:lang'

// Kept in memory too, so the choice still applies for this visit when storage is blocked
let memLang: Lang = 'en'

export function getLang(): Lang {
  try {
    const v = localStorage.getItem('bluechip.lang')
    if (v === 'en' || v === 'vi') return v
  } catch {
    /* storage blocked: fall back to the in-memory choice */
  }
  return memLang
}

export function setLang(l: Lang) {
  memLang = l
  try {
    localStorage.setItem('bluechip.lang', l)
  } catch {
    /* storage blocked: the in-memory choice still applies */
  }
  window.dispatchEvent(new Event(EVENT))
}

/** Current language; every component using it re-renders when it changes. */
export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENT, cb)
      return () => window.removeEventListener(EVENT, cb)
    },
    getLang,
  )
}

/** Translator for the current language, falling back to English. */
export function useT() {
  const lang = useLang()
  return (k: Key) => DICT[lang][k] ?? en[k]
}
