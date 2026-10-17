/**
 * The AI analyst's rules, editable in Settings > AI rules. Saved in this browser
 * only; every value is clamped on load so a bad saved value cannot break the app.
 */
import { useSyncExternalStore } from 'react'

export interface AiRules {
  verdictThreshold: number // % of the -100..100 analyst score needed for BUY or SELL
  noEdgeRule: boolean // size nothing when buy-and-hold beat the robot
  riskPerTradePct: number
  positionCapPct: number
  thinRecordCapPct: number
  minSample: number
  tradeScoreOn: boolean
  riskScoreSizing: boolean
  volatilityOn: boolean
  gatesOn: boolean
  maxDrawdownPct: number
  maxPositionPct: number
  maxTradesPerDay: number
  minScoreWarn: number
  autoLearn: boolean // 24/7 auto learning: replay old bars and test new ones as simulated paper trades
  watchlistScan: boolean // AI scan button in the watchlist; each row shows the AI's BUY/HOLD/SELL call
  aiPicksTab: boolean // the old separate AI Picks tab on the right (the watchlist scan replaces it)
  learnFromScanner: boolean // auto learning also studies the markets the practice scanner found (movers, penny, mid caps)
  learnEdgeMarginPct: number // learner needs this many points over always-buy before it says BUY
  practiceMode: boolean // AI paper-trades small on live data in its own practice account
  practiceSizePct: number // % of the practice account per trade
  practiceOnChart: boolean // show practice orders on the chart, with animation
  practiceFeed: boolean // pop-up notices for practice orders
  practiceDayOn: boolean // quick day trades, all closed before market close
  practiceDayTrades: number // day trades per day
  practiceLongOn: boolean // a longer-term trade held for days
  practiceLongTrades: number // long-term trades opened per day
  practiceHoldDays: number // longest a long-term trade is held
  practiceAutoPick: boolean // practice picks its own markets instead of trading the open chart
  practiceMovers: boolean // the picker also scans today's top gainers and most-traded stocks
  practiceServer: boolean // show the 24/7 server practice account (trades while the app is closed)
  practiceWatchlist: boolean // pin the markets practice is watching or trading at the top of the watchlist
  practiceFollow: boolean // the chart jumps to each new practice trade
  practiceUnlimited: boolean // practice trades every BUY the rules allow, with no per-day trade cap
  practiceDayLossOn: boolean // stop new practice buys for the day after a daily loss
  practiceDayLossPct: number // daily loss limit, % of the practice account
  practiceMaxOpen: number // open practice trades at most when unlimited (replaces the 8-position cap for practice)
  practicePenny: boolean // practice may trade stocks from $1 to $5 (liquid ones only; smaller size, higher costs)
  practiceInPanels: boolean // list practice positions and orders in the Positions, Open orders and History tabs
  dataGuardOn: boolean // block new AI entries on simulated or stale data
  maxDataAgeMin: number // oldest bar close allowed for a new entry (at least one bar)
  hardLimitsOn: boolean // hard limits for AI orders: drawdown halt, open positions, total exposure
  maxOpenPositions: number
  maxExposurePct: number // % of the account in open positions, all together
  costsOn: boolean // fees, spread and slippage on paper fills
  feeBps: number
  spreadBps: number
  slippageBps: number
  auditOn: boolean // decision log of every accepted and rejected AI decision
  reviewOn: boolean // grade closed trades on process vs. luck
  dailyReportOn: boolean // end-of-day practice report
  skillRegistryOn: boolean // only approved skills feed signals
  jarvisOn: boolean // Jarvis, the Arc Brain: the Brain tab and every Jarvis surface
  jarvisBriefing: boolean // morning briefing in the Brain tab
  jarvisLessons: boolean // lessons after each reviewed trade, and playbook evidence
  jarvisAsk: boolean // Ask Jarvis: fixed questions answered from the app's own data
  jarvisVoice: boolean // Jarvis's plain-words line under the AI Analyst call
  jarvisStory: boolean // playbook checks in each practice trade's story
  scoreboardBaseline: boolean // scoreboard shows open P&L and the account against buy-and-hold SPY
  scoreboardSignalMetrics: boolean // scoreboard shows expectancy and max drawdown for signal quality
  scoreboardPerformanceTimer: boolean // monitor signal-to-order latency and app load times
  jarvisGate: boolean // practice buys must pass every playbook rule proven on paper trades
  jarvisMotion: boolean // animated Jarvis avatar
  jarvisSpeech: boolean // Jarvis reads briefings and answers aloud (browser's built-in speech)
  jarvisShowMe: boolean // Show me: Jarvis opens the stock and points at what it explains on the chart
  jarvisReplay: boolean // Replay the day: Jarvis narrates each practice trade on the chart
  jarvisAlerts: boolean // Jarvis pops up when a practice trade opens or closes, with Show me
  jarvisListen: boolean // ask Jarvis by voice (microphone, browser speech recognition)
  jarvisGreeting: boolean // a human greeting with your name at the top of the Brain tab
  jarvisLinks: boolean // "What I'm linked to": memory, skills, playbook, decision log, reviews, learner
  jarvisActions: boolean // Jarvis may propose setting changes (practice, kill switch, watchlist, AI rules); each needs your tap
  jarvisAnyStock: boolean // ask about any stock ("why AAPL?"): Jarvis opens it and explains on the chart
  jarvisFab: boolean // floating brain button: talk or type to Jarvis from any screen, with the conversation written out
  jarvisFabTalk: boolean // the floating brain reads its answers aloud
  aiKeyBoxes: boolean // Settings shows boxes to type the free AI keys (saved on the server, never in the browser)
  jarvisCloudAi: boolean // when Jarvis doesn't understand, ask a free AI helper (keys live on the server)
  briefHome: boolean // Jarvis Brief is the home page; off opens the Trading desk as before
  netTools: boolean // Wi-Fi & Bluetooth page for your own network (needs the home agent for scans)
  hubLayout: boolean // the home page uses the Hub layout: best pick next to the sphere, prediction board, Studio and devices
  briefAi: boolean // a free AI helper writes the Jarvis Brief from the page's real data (once per scan)
  practiceCryptoMovers: boolean // practice also scans today's top crypto gainers and most-traded coins
  adjustableTimeRange: boolean // custom time range input on the Trading desk chart (beyond the preset 1D/1W/1M/1Y/All buttons)
  localModelName: string // local LLM name: llama3.2, gemma4:e2b, qwen3-coder:30b (default: llama3.2)
  localExplain: boolean // explain your trades using llama3.2 (browser only, no API)
  localQA: boolean // answer questions about your trades using llama3.2 (browser only)
  resizePanels: boolean // drag the side lists and bottom bar to resize them
  autoRangeTf: boolean // chart range buttons also pick the bar size, like Webull
  localVoiceNarrator: boolean // read explanations + answers aloud using browser speechSynthesis
  signalValidator: boolean // validate every signal path before showing (alerts, Brief, playbook)
  newsEnabled: boolean // show latest news for watched symbols in Jarvis Brief
  newsAnalysis: boolean // analyze market news sentiment for BUY/SELL bias
  preMarketAlerts: boolean // alerts before market open (pre-market movers and news)
  cryptoMoversThrottleHrs: number // max frequency to scan crypto movers (0 = always, >0 = hours between scans)
  autoRotateKeys: boolean // try multiple API keys in order; skip any that fail or run out of quota
  localAiOn: boolean // use local AI (Ollama on your device) as the first provider, Gemini fallback
  orderFlowEstimate: boolean // show estimated order flow from delayed candles when live data unavailable
  practiceTradeNotifications: boolean // notify before Jarvis places a practice trade
  telegramNotifications: boolean // send trade notifications to Telegram
  telegramToken: string // Telegram bot token (stored on server, never in browser)
  walkForwardValidatorOn: boolean // validate signals on data the ranking was not tuned on; mark as "Proven" only when win rate > 50% out-of-sample
  potentialListOn: boolean // show a "Potential" list of stocks with good BUY signals in the watchlist
}

export const DEFAULT_AI_RULES: AiRules = {
  verdictThreshold: 20,
  noEdgeRule: true,
  riskPerTradePct: 1,
  positionCapPct: 10,
  thinRecordCapPct: 5,
  minSample: 30,
  tradeScoreOn: true,
  riskScoreSizing: true,
  volatilityOn: true,
  gatesOn: true,
  maxDrawdownPct: 20,
  maxPositionPct: 25,
  maxTradesPerDay: 50,
  minScoreWarn: 40,
  autoLearn: true,
  learnFromScanner: true,
  watchlistScan: true,
  aiPicksTab: false,
  learnEdgeMarginPct: 3,
  practiceMode: true,
  practiceSizePct: 2,
  practiceOnChart: true,
  practiceFeed: true,
  practiceDayOn: true,
  practiceDayTrades: 4,
  practiceLongOn: true,
  practiceLongTrades: 1,
  practiceHoldDays: 5,
  practiceAutoPick: true,
  practiceMovers: true,
  practiceServer: true,
  practiceWatchlist: true,
  practiceFollow: true,
  practiceInPanels: true,
  practicePenny: true,
  practiceUnlimited: true,
  practiceDayLossOn: true,
  practiceDayLossPct: 2,
  practiceMaxOpen: 25,
  dataGuardOn: true,
  maxDataAgeMin: 30,
  hardLimitsOn: true,
  maxOpenPositions: 8,
  maxExposurePct: 60,
  costsOn: true,
  feeBps: 1,
  spreadBps: 4,
  slippageBps: 2,
  auditOn: true,
  reviewOn: true,
  dailyReportOn: true,
  skillRegistryOn: true,
  jarvisOn: true,
  jarvisBriefing: true,
  jarvisLessons: true,
  jarvisAsk: true,
  jarvisVoice: true,
  jarvisStory: true,
  scoreboardBaseline: true,
  scoreboardSignalMetrics: true,
  scoreboardPerformanceTimer: true,
  jarvisGate: false,
  jarvisMotion: true,
  jarvisSpeech: true,
  jarvisShowMe: true,
  jarvisReplay: true,
  jarvisAlerts: true,
  jarvisListen: false,
  jarvisGreeting: true,
  jarvisLinks: true,
  jarvisAnyStock: true,
  jarvisActions: true,
  jarvisFab: true,
  jarvisFabTalk: true,
  aiKeyBoxes: true,
  jarvisCloudAi: true,
  briefHome: true,
  hubLayout: true,
  netTools: true,
  briefAi: true,
  practiceCryptoMovers: true,
  adjustableTimeRange: true,
  localModelName: 'llama3.2',
  localExplain: false,
  localQA: false,
  resizePanels: true,
  autoRangeTf: true,
  localVoiceNarrator: true,
  signalValidator: true,
  newsEnabled: false,
  newsAnalysis: false,
  preMarketAlerts: false,
  cryptoMoversThrottleHrs: 1,
  autoRotateKeys: false,
  localAiOn: false,
  orderFlowEstimate: true,
  practiceTradeNotifications: true,
  telegramNotifications: true,
  telegramToken: '',
  walkForwardValidatorOn: true,
  potentialListOn: true,
}

type NumKey = { [K in keyof AiRules]: AiRules[K] extends number ? K : never }[keyof AiRules]
type BoolKey = { [K in keyof AiRules]: AiRules[K] extends boolean ? K : never }[keyof AiRules]

export interface RuleField {
  group: 'call' | 'sizing' | 'gates' | 'costs' | 'modules' | 'jarvis'
  key: keyof AiRules
  en: string
  vi: string
  /** Numbers only: allowed range and step. */
  min?: number
  max?: number
  step?: number
  unit?: string
}

export const RULE_FIELDS: RuleField[] = [
  { group: 'call', key: 'verdictThreshold', en: 'Signal strength needed for BUY / SELL', vi: 'Độ mạnh tín hiệu cần để MUA / BÁN', min: 5, max: 80, step: 1, unit: '%' },
  { group: 'call', key: 'noEdgeRule', en: 'No position when just holding beat the robot', vi: 'Không vào lệnh khi mua và giữ tốt hơn robot' },
  { group: 'call', key: 'learnEdgeMarginPct', en: 'Learner must beat always-buy by', vi: 'Bộ học phải hơn luôn-mua ít nhất', min: 0, max: 20, step: 0.5, unit: '%' },
  { group: 'sizing', key: 'riskPerTradePct', en: 'Risk per trade', vi: 'Rủi ro mỗi giao dịch', min: 0.1, max: 5, step: 0.1, unit: '%' },
  { group: 'sizing', key: 'positionCapPct', en: 'Max position size', vi: 'Khối lượng vị thế tối đa', min: 1, max: 100, step: 1, unit: '%' },
  { group: 'sizing', key: 'thinRecordCapPct', en: 'Max size while the track record is short', vi: 'Khối lượng tối đa khi lịch sử còn ngắn', min: 0.5, max: 100, step: 0.5, unit: '%' },
  { group: 'sizing', key: 'practiceDayTrades', en: 'Practice day trades per day', vi: 'Số lệnh luyện tập trong ngày mỗi ngày', min: 1, max: 20, step: 1 },
  { group: 'sizing', key: 'practiceLongTrades', en: 'Practice long-term trades per day', vi: 'Số lệnh luyện tập dài hạn mỗi ngày', min: 1, max: 5, step: 1 },
  { group: 'sizing', key: 'practiceHoldDays', en: 'Practice long-term trade: hold up to', vi: 'Lệnh luyện tập dài hạn: giữ tối đa', min: 1, max: 60, step: 1, unit: 'days' },
  { group: 'sizing', key: 'practiceDayLossPct', en: 'Practice daily loss limit (stop new buys for the day)', vi: 'Giới hạn lỗ trong ngày khi luyện tập (dừng mua đến hết ngày)', min: 0.5, max: 20, step: 0.5, unit: '%' },
  { group: 'sizing', key: 'practiceMaxOpen', en: 'Practice open trades at most (unlimited mode)', vi: 'Số lệnh luyện tập mở tối đa (chế độ không giới hạn)', min: 1, max: 50, step: 1 },
  { group: 'sizing', key: 'practiceSizePct', en: 'Practice mode trade size (of practice account)', vi: 'Khối lượng mỗi lệnh luyện tập (của tài khoản luyện tập)', min: 0.5, max: 10, step: 0.5, unit: '%' },
  { group: 'sizing', key: 'minSample', en: 'Trades needed for a full track record', vi: 'Số giao dịch cần cho lịch sử đầy đủ', min: 1, max: 500, step: 1 },
  { group: 'gates', key: 'maxDrawdownPct', en: 'Pause buys after account drop of', vi: 'Dừng mua khi tài khoản giảm', min: 1, max: 100, step: 1, unit: '%' },
  { group: 'gates', key: 'maxPositionPct', en: 'Max share of account in one symbol', vi: 'Tỷ trọng tối đa của một mã', min: 1, max: 100, step: 1, unit: '%' },
  { group: 'gates', key: 'maxTradesPerDay', en: 'Max orders per day', vi: 'Số lệnh tối đa mỗi ngày', min: 1, max: 1000, step: 1 },
  { group: 'gates', key: 'maxOpenPositions', en: 'Hard limit: AI open positions at most', vi: 'Giới hạn cứng: số vị thế AI mở tối đa', min: 1, max: 50, step: 1 },
  { group: 'gates', key: 'maxExposurePct', en: 'Hard limit: AI money in open positions at most', vi: 'Giới hạn cứng: tiền AI trong vị thế mở tối đa', min: 5, max: 100, step: 5, unit: '%' },
  { group: 'gates', key: 'maxDataAgeMin', en: 'Block AI buys when price data is older than', vi: 'Chặn AI mua khi dữ liệu giá cũ hơn', min: 5, max: 1440, step: 5, unit: 'min' },
  { group: 'costs', key: 'feeBps', en: 'Fees per fill', vi: 'Phí mỗi lần khớp', min: 0, max: 50, step: 0.5, unit: 'bps' },
  { group: 'costs', key: 'spreadBps', en: 'Bid-ask spread (half paid per market fill)', vi: 'Chênh lệch mua-bán (trả một nửa mỗi lần khớp thị trường)', min: 0, max: 100, step: 0.5, unit: 'bps' },
  { group: 'costs', key: 'slippageBps', en: 'Slippage on market and stop fills', vi: 'Trượt giá khi khớp lệnh thị trường và cắt lỗ', min: 0, max: 100, step: 0.5, unit: 'bps' },
  { group: 'gates', key: 'minScoreWarn', en: 'Warn when Trade Score is below', vi: 'Cảnh báo khi Điểm Giao dịch dưới', min: 0, max: 100, step: 1 },
  { group: 'modules', key: 'tradeScoreOn', en: 'Trade Score (0-100)', vi: 'Điểm Giao dịch (0-100)' },
  { group: 'modules', key: 'riskScoreSizing', en: 'Size by risk score', vi: 'Khối lượng theo điểm rủi ro' },
  { group: 'modules', key: 'volatilityOn', en: 'Volatility rules (halve or stop in wild swings)', vi: 'Quy tắc biến động (giảm nửa hoặc dừng khi dao động mạnh)' },
  { group: 'modules', key: 'autoLearn', en: '24/7 auto learning (tests old and new bars as paper trades)', vi: 'Tự học 24/7 (kiểm thử nến cũ và mới bằng giao dịch thử nghiệm)' },
  { group: 'modules', key: 'watchlistScan', en: 'AI scan button in the watchlist (each row shows BUY / HOLD / SELL)', vi: 'Nút AI quét trong watchlist (mỗi dòng hiện MUA / GIỮ / BÁN)' },
  { group: 'modules', key: 'aiPicksTab', en: 'Show the old AI Picks tab on the right as well', vi: 'Hiện thêm tab AI Picks cũ bên phải' },
  { group: 'modules', key: 'learnFromScanner', en: 'Auto learning also studies the stocks the scanner found today (movers, penny, mid caps), up to 40 a cycle', vi: 'Tự học cũng học các mã máy quét tìm thấy hôm nay (tăng mạnh, penny, mid cap), tối đa 40 mã mỗi vòng' },
  { group: 'modules', key: 'practiceMode', en: 'Practice mode (AI paper-trades small on live data)', vi: 'Chế độ luyện tập (AI giao dịch thử nhỏ trên dữ liệu trực tiếp)' },
  { group: 'modules', key: 'practiceDayOn', en: 'Practice day trades (in and out the same day)', vi: 'Lệnh luyện tập trong ngày (vào và ra cùng ngày)' },
  { group: 'modules', key: 'practiceLongOn', en: 'Practice long-term trade (held for days)', vi: 'Lệnh luyện tập dài hạn (giữ nhiều ngày)' },
  { group: 'modules', key: 'practiceAutoPick', en: 'Practice picks its own stocks (best volume, gain and Trade Score)', vi: 'Luyện tập tự chọn mã (khối lượng, mức tăng và Điểm GD tốt nhất)' },
  { group: 'modules', key: 'practiceMovers', en: "Practice also scans today's top gainers and most-traded stocks", vi: 'Luyện tập quét thêm mã tăng mạnh và giao dịch nhiều nhất hôm nay' },
  { group: 'modules', key: 'practiceCryptoMovers', en: "Practice also scans today's top crypto gainers and most-traded coins", vi: 'Luyện tập quét thêm crypto tăng mạnh và giao dịch nhiều nhất hôm nay' },
  { group: 'modules', key: 'practiceServer', en: 'Practice 24/7 on the server (keeps trading while the app is closed)', vi: 'Luyện tập 24/7 trên máy chủ (vẫn giao dịch khi đóng ứng dụng)' },
  { group: 'modules', key: 'practiceWatchlist', en: 'Show what practice is watching and trading at the top of the watchlist', vi: 'Hiện các mã luyện tập đang theo dõi và giao dịch ở đầu danh sách' },
  { group: 'modules', key: 'practiceFollow', en: 'Chart follows each new practice trade', vi: 'Biểu đồ tự chuyển theo mỗi lệnh luyện tập mới' },
  { group: 'modules', key: 'practiceUnlimited', en: 'Practice unlimited trades (as many as the signals allow; long-term trades keep their daily number)', vi: 'Luyện tập không giới hạn lệnh (nhiều nhất tín hiệu cho phép; lệnh dài hạn giữ số lượng mỗi ngày)' },
  { group: 'modules', key: 'practicePenny', en: 'Practice penny stocks ($1 to $5, only liquid ones; half size, 5x spread and slippage)', vi: 'Luyện tập cổ phiếu penny ($1 đến $5, chỉ mã thanh khoản; nửa khối lượng, chênh lệch và trượt giá gấp 5)' },
  { group: 'modules', key: 'practiceDayLossOn', en: 'Practice daily loss limit', vi: 'Giới hạn lỗ trong ngày khi luyện tập' },
  { group: 'modules', key: 'practiceInPanels', en: 'Show practice trades in Positions, Open orders and History', vi: 'Hiện lệnh luyện tập trong Vị thế, Lệnh chờ và Lịch sử' },
  { group: 'modules', key: 'practiceOnChart', en: 'Show practice orders on the chart (animated)', vi: 'Hiện lệnh luyện tập trên biểu đồ (có hiệu ứng)' },
  { group: 'modules', key: 'practiceFeed', en: 'Pop-up notices for practice orders', vi: 'Thông báo bật lên cho lệnh luyện tập' },
  { group: 'modules', key: 'gatesOn', en: 'Risk gates (kill switch always works)', vi: 'Cổng rủi ro (công tắc dừng khẩn cấp luôn hoạt động)' },
  { group: 'modules', key: 'hardLimitsOn', en: 'Hard risk limits for AI orders (drawdown halt, open positions, total exposure; the AI cannot change them)', vi: 'Giới hạn rủi ro cứng cho lệnh AI (dừng khi sụt giảm, số vị thế, tổng tiền vào lệnh; AI không thể thay đổi)' },
  { group: 'modules', key: 'dataGuardOn', en: 'Block AI buys on simulated or stale price data', vi: 'Chặn AI mua khi dữ liệu giá là giả lập hoặc đã cũ' },
  { group: 'modules', key: 'costsOn', en: 'Realistic fills (fees, spread and slippage)', vi: 'Khớp lệnh thực tế (phí, chênh lệch và trượt giá)' },
  { group: 'modules', key: 'auditOn', en: 'Decision log (every accepted and rejected AI decision, with its data)', vi: 'Nhật ký quyết định (mọi quyết định AI được chấp nhận và bị từ chối, kèm dữ liệu)' },
  { group: 'modules', key: 'resizePanels', en: 'Resizable panels (drag the edges of the side lists and bottom bar; double-click to reset)', vi: 'Kéo đổi kích thước khung (kéo mép danh sách hai bên và thanh dưới; nhấp đúp để đặt lại)' },
  { group: 'modules', key: 'reviewOn', en: 'Trade review: good process vs. luck', vi: 'Đánh giá lệnh: quy trình tốt hay may mắn' },
  { group: 'modules', key: 'dailyReportOn', en: 'Daily practice report', vi: 'Báo cáo luyện tập hằng ngày' },
  { group: 'modules', key: 'skillRegistryOn', en: 'Skill registry (only approved skills feed signals)', vi: 'Danh sách kỹ năng (chỉ kỹ năng được duyệt mới tạo tín hiệu)' },
  { group: 'jarvis', key: 'jarvisOn', en: 'Jarvis, the Arc Brain (Brain tab and everything below)', vi: 'Jarvis, Bộ não Arc (tab Bộ não và mọi mục bên dưới)' },
  { group: 'jarvis', key: 'jarvisBriefing', en: 'Morning briefing', vi: 'Bản tin buổi sáng' },
  { group: 'jarvis', key: 'jarvisLessons', en: 'Lessons and playbook evidence', vi: 'Bài học và bằng chứng sổ tay' },
  { group: 'jarvis', key: 'jarvisAsk', en: 'Ask Jarvis', vi: 'Hỏi Jarvis' },
  { group: 'jarvis', key: 'jarvisVoice', en: "Jarvis's line under the AI Analyst call", vi: 'Lời Jarvis dưới nhận định AI' },
  { group: 'jarvis', key: 'scoreboardBaseline', en: 'Scoreboard: open P&L and Jarvis vs buying and holding SPY', vi: 'Bảng điểm: lãi/lỗ lệnh đang mở và Jarvis so với mua giữ SPY' },
  { group: 'jarvis', key: 'scoreboardSignalMetrics', en: 'Scoreboard: signal quality (expectancy, max drawdown, win vs loss)', vi: 'Bảng điểm: chất lượng tín hiệu (kỳ vọng, rủi ro tối đa, thắng vs thua)' },
  { group: 'jarvis', key: 'scoreboardPerformanceTimer', en: 'Scoreboard: performance monitor (signal latency, app load times)', vi: 'Bảng điểm: kiểm tra hiệu năng (độ trễ tín hiệu, thời gian tải ứng dụng)' },
  { group: 'jarvis', key: 'jarvisStory', en: 'Playbook checks in practice trade stories', vi: 'Kiểm tra sổ tay trong câu chuyện lệnh luyện tập' },
  { group: 'jarvis', key: 'jarvisGate', en: 'Practice buys must pass every playbook rule proven on paper trades', vi: 'Lệnh mua luyện tập phải đạt mọi quy tắc sổ tay đã chứng minh trên lệnh thử' },
  { group: 'jarvis', key: 'jarvisMotion', en: 'Animated Jarvis avatar', vi: 'Hình đại diện Jarvis chuyển động' },
  { group: 'jarvis', key: 'jarvisShowMe', en: 'Show me: Jarvis opens the stock and points at what it is explaining on the chart', vi: 'Chỉ cho tôi: Jarvis mở mã và chỉ vào điều đang giải thích trên biểu đồ' },
  { group: 'jarvis', key: 'jarvisReplay', en: 'Replay the day: Jarvis walks through each practice trade on the chart', vi: 'Xem lại ngày: Jarvis dẫn xem từng lệnh luyện tập trên biểu đồ' },
  { group: 'jarvis', key: 'jarvisAlerts', en: 'Jarvis alerts when a practice trade opens or closes (replaces the plain pop-up)', vi: 'Jarvis báo khi lệnh luyện tập mở hoặc đóng (thay thông báo thường)' },
  { group: 'jarvis', key: 'jarvisGreeting', en: 'Greeting: Jarvis says hello by name and sums up the day', vi: 'Lời chào: Jarvis chào bạn bằng tên và tóm tắt ngày' },
  { group: 'jarvis', key: 'jarvisLinks', en: "What I'm linked to: ask Jarvis about its memory, skills, playbook, decision log, reviews and learner", vi: 'Kết nối của tôi: hỏi Jarvis về bộ nhớ, kỹ năng, sổ tay, nhật ký quyết định, đánh giá và bộ học' },
  { group: 'jarvis', key: 'jarvisAnyStock', en: 'Ask about any stock ("why AAPL?"): Jarvis opens it and explains on the chart', vi: 'Hỏi về bất kỳ mã nào ("vì sao AAPL?"): Jarvis mở mã đó và giải thích trên biểu đồ' },
  { group: 'jarvis', key: 'jarvisActions', en: 'Jarvis can act: it proposes changes (pause practice, kill switch, watchlist, these switches) and does them only after you tap "Do it"; every one is logged', vi: 'Jarvis có thể hành động: đề xuất thay đổi (tạm dừng luyện tập, dừng khẩn cấp, danh sách theo dõi, các công tắc này) và chỉ làm khi bạn bấm "Làm đi"; mọi việc đều được ghi lại' },
  { group: 'jarvis', key: 'jarvisFab', en: 'Floating brain button: talk or type to Jarvis from any screen, with the conversation written out', vi: 'Nút bộ não nổi: nói hoặc gõ với Jarvis ở mọi màn hình, kèm bản ghi cuộc trò chuyện' },
  { group: 'jarvis', key: 'jarvisFabTalk', en: 'The floating brain answers out loud (male voice by default; change it in the Brain tab)', vi: 'Bộ não nổi trả lời thành tiếng (mặc định giọng nam; đổi trong tab Bộ não)' },
  { group: 'jarvis', key: 'jarvisCloudAi', en: "Free AI helper: when Jarvis doesn't understand you, he asks a free AI (Gemini, Groq, Grok or NVIDIA) using his own facts. Only works after a key is added (type it in Settings, or set it as a server secret)", vi: 'Trợ lý AI miễn phí: khi Jarvis không hiểu, Jarvis hỏi một AI miễn phí (Gemini, Groq, Grok hoặc NVIDIA) kèm dữ liệu của mình. Chỉ hoạt động sau khi thêm khóa (nhập trong Cài đặt, hoặc đặt làm secret trên máy chủ)' },
  { group: 'jarvis', key: 'aiKeyBoxes', en: 'Show the free AI key boxes in Settings (Gemini, Groq, NVIDIA)', vi: 'Hiện ô nhập khóa AI miễn phí trong Cài đặt (Gemini, Groq, NVIDIA)' },
  { group: 'jarvis', key: 'netTools', en: 'Wi-Fi & Bluetooth page: devices on your network, Wi-Fi channels, ping, port check, Wake-on-LAN, speed test (your own network only; scans need the home agent)', vi: 'Trang Wi-Fi và Bluetooth: thiết bị trong mạng, kênh Wi-Fi, ping, kiểm tra cổng, đánh thức máy, đo tốc độ (chỉ mạng của anh; quét cần chương trình trên máy nhà)' },
  { group: 'jarvis', key: 'hubLayout', en: 'Hub home page: best pick next to the sphere, prediction board with 6 agent dots, Studio and devices (off: the old Jarvis Brief layout)', vi: 'Trang chủ Hub: mã tốt nhất cạnh quả cầu, bảng dự đoán có 6 chấm agent, Studio và thiết bị (tắt: giao diện Jarvis Brief cũ)' },
  { group: 'jarvis', key: 'briefHome', en: 'Jarvis Brief as the home page (off: open the Trading desk first)', vi: 'Jarvis Brief là trang chủ (tắt: mở Bàn giao dịch trước)' },
  { group: 'jarvis', key: 'briefAi', en: 'Free AI writes the Jarvis Brief from real data (once per scan; plain text if every AI key fails)', vi: 'AI miễn phí viết Jarvis Brief từ dữ liệu thật (mỗi lần quét một lần; nếu mọi key AI lỗi thì dùng văn bản thường)' },
  { group: 'jarvis', key: 'localExplain', en: 'Local AI explains your trades (on your device, no cloud keys)', vi: 'AI cục bộ giải thích lệnh của bạn (trên máy, không cần key đám mây)' },
  { group: 'jarvis', key: 'localQA', en: 'Local AI answers questions about your trades and rules (on your device)', vi: 'AI cục bộ trả lời câu hỏi về lệnh và quy tắc (trên máy)' },
  { group: 'jarvis', key: 'localVoiceNarrator', en: 'Local AI reads explanations and answers aloud (browser voice)', vi: 'AI cục bộ đọc giải thích và câu trả lời to (giọng trình duyệt)' },
  { group: 'jarvis', key: 'jarvisListen', en: 'Ask Jarvis by voice (microphone; Chrome, Edge or Safari)', vi: 'Hỏi Jarvis bằng giọng nói (micro; Chrome, Edge hoặc Safari)' },
  { group: 'jarvis', key: 'jarvisSpeech', en: "Jarvis speaks (reads briefings and answers aloud with your device's voices; pick the voice in the Brain tab)", vi: 'Jarvis nói (đọc to bản tin và câu trả lời bằng giọng có sẵn trên thiết bị; chọn giọng trong tab Bộ não)' },
  { group: 'modules', key: 'autoRangeTf', en: 'Chart ranges pick the bar size (1D = 5-minute bars, 5D = 15m, 1M = 1h, 3M = 4h, 1Y and All = daily)', vi: 'Khoảng biểu đồ tự chọn cỡ nến (1D = nến 5 phút, 5D = 15p, 1M = 1 giờ, 3M = 4 giờ, 1Y và All = ngày)' },
  { group: 'modules', key: 'adjustableTimeRange', en: 'Adjustable time range on Trading desk (custom days input beyond preset buttons)', vi: 'Khoảng thời gian điều chỉnh được trên Bàn giao dịch (nhập ngày tùy chỉnh ngoài các nút sẵn)' },
  { group: 'modules', key: 'signalValidator', en: 'Validate every signal path before showing (alerts, Brief, playbook)', vi: 'Kiểm tra mọi đường dẫn tín hiệu trước khi hiển thị (cảnh báo, Bản tin, Sổ tay)' },
  { group: 'modules', key: 'walkForwardValidatorOn', en: 'Walk-forward validator (mark signals "Proven" only after 50%+ win rate on unseen data)', vi: 'Bộ xác thực quay lại (đánh dấu tín hiệu "Đã chứng minh" chỉ sau 50%+ tỉ lệ thắng trên dữ liệu chưa biết)' },
  { group: 'jarvis', key: 'newsEnabled', en: 'Show latest news for watched symbols in Jarvis Brief', vi: 'Hiện tin tức mới nhất cho các mã theo dõi trong Jarvis Brief' },
  { group: 'modules', key: 'newsAnalysis', en: 'Analyze market news sentiment for BUY/SELL bias', vi: 'Phân tích độ dốc tin tức thị trường cho thiên vị MUA/BÁN' },
  { group: 'modules', key: 'preMarketAlerts', en: 'Alerts before market open (pre-market movers and news)', vi: 'Cảnh báo trước khi mở cửa thị trường (mã tăng trước giờ và tin tức)' },
  { group: 'modules', key: 'cryptoMoversThrottleHrs', en: 'Crypto movers scan frequency (0 = always, >0 = max hours between scans)', vi: 'Tần suất quét crypto tăng (0 = luôn luôn, >0 = giờ tối đa giữa các lần quét)', min: 0, max: 24, step: 1, unit: 'hours' },
  { group: 'jarvis', key: 'autoRotateKeys', en: 'Auto-rotate API keys: try multiple keys in order, skip any that run out of quota', vi: 'Xoay khóa API tự động: thử nhiều khóa theo thứ tự, bỏ qua khóa nào hết hạn' },
  { group: 'jarvis', key: 'localAiOn', en: 'Use local AI: Ollama on your computer writes the Brief with a model you have installed (works only when this app runs on that computer; falls back to Gemini if Brief AI is on)', vi: 'Dùng AI cục bộ: Ollama trên máy bạn viết bản tin bằng mô hình đã cài (chỉ hoạt động khi ứng dụng chạy trên máy đó; dự phòng Gemini nếu AI viết bản tin đang bật)' },
  { group: 'modules', key: 'orderFlowEstimate', en: 'Show estimated order flow when live data unavailable', vi: 'Hiện dòng lệnh ước tính khi không có dữ liệu trực tiếp' },
  { group: 'modules', key: 'practiceTradeNotifications', en: 'Notify before placing a practice trade (symbol, side, entry, stop, target, reason)', vi: 'Báo trước khi đặt lệnh luyện tập (mã, mua/bán, vào, cắt lỗ, chốt lời, lý do)' },
  { group: 'jarvis', key: 'telegramNotifications', en: 'Send practice trades to Telegram bot (instant notifications, requires token)', vi: 'Gửi giao dịch luyện tập vào Telegram (thông báo ngay lập tức, cần token)' },
  { group: 'modules', key: 'potentialListOn', en: 'Show "Potential" list (stocks with good BUY signals from the scanner)', vi: 'Hiện danh sách "Tiềm năng" (cổ phiếu có tín hiệu MUA tốt từ máy quét)' },
]

const KEY = 'arc.aiRules.v1'
const ONBOARD_KEY = 'arc.aiRules.onboard.v2'
/** Switched on once for browsers that saved rules before these were on by default; the user can still turn them off after. */
const TURN_ON_ONCE: BoolKey[] = ['autoLearn', 'learnFromScanner', 'watchlistScan', 'practiceMode', 'practiceAutoPick', 'practiceMovers', 'practiceServer', 'practicePenny', 'practiceCryptoMovers', 'signalValidator', 'jarvisOn', 'briefAi', 'newsEnabled']
const EVENT = 'arc:aiRules'

export function sanitize(raw: unknown): AiRules {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out = { ...DEFAULT_AI_RULES }
  for (const f of RULE_FIELDS) {
    const v = r[f.key]
    if (f.min != null && f.max != null) {
      const n = Number(v)
      if (v !== '' && v != null && Number.isFinite(n)) out[f.key as NumKey] = Math.min(f.max, Math.max(f.min, n))
    } else if (typeof v === 'boolean') {
      out[f.key as BoolKey] = v
    }
  }
  return out
}

async function loadFromServer(): Promise<AiRules | null> {
  try {
    const res = await fetch('/api/ai-rules', { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return null
    const data = await res.json()
    return sanitize(data)
  } catch {
    return null
  }
}

function load(): AiRules {
  try {
    // Try localStorage cache first (fast path)
    const cached = localStorage.getItem(KEY)
    if (cached) {
      const r = sanitize(JSON.parse(cached))
      // Also fetch from server in background to keep in sync
      if (typeof window !== 'undefined') {
        loadFromServer().then((serverRules) => {
          if (serverRules) {
            current = serverRules
            localStorage.setItem(KEY, JSON.stringify(serverRules))
            window.dispatchEvent(new Event(EVENT))
          }
        })
      }
      return r
    }

    // If no cache, try server first
    if (typeof window !== 'undefined') {
      // Note: sync fetch is not possible, so we return defaults and let the app update once server responds
      loadFromServer().then((serverRules) => {
        if (serverRules) {
          current = serverRules
          localStorage.setItem(KEY, JSON.stringify(serverRules))
          window.dispatchEvent(new Event(EVENT))
        }
      })
    }

    // For first-time setup, handle TURN_ON_ONCE like before
    const r = { ...DEFAULT_AI_RULES }
    if (!localStorage.getItem(ONBOARD_KEY)) {
      for (const k of TURN_ON_ONCE) r[k] = true
      localStorage.setItem(KEY, JSON.stringify(r))
      localStorage.setItem(ONBOARD_KEY, '1')
    }
    return r
  } catch {
    return DEFAULT_AI_RULES
  }
}

let current: AiRules | null = null

export function getAiRules(): AiRules {
  if (!current) current = load()
  return current
}

export function setAiRules(r: AiRules) {
  current = sanitize(r)
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    /* storage blocked: the rules still apply for this visit */
  }
  window.dispatchEvent(new Event(EVENT))

  // Save to server in background (no await, fire-and-forget)
  if (typeof window !== 'undefined') {
    fetch('/api/ai-rules', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(current)
    }).catch(() => {
      /* server save failed, but local cache is still valid */
    })
  }
}

export function useAiRules(): AiRules {
  return useSyncExternalStore((cb) => {
    window.addEventListener(EVENT, cb)
    return () => window.removeEventListener(EVENT, cb)
  }, getAiRules)
}

/** Trade-count and loss limits for practice entries, from the rules (shared by the browser and the server). */
export function practiceLimits(r: AiRules) {
  return {
    unlimited: r.practiceUnlimited,
    dayLossLimitPct: r.practiceDayLossOn ? r.practiceDayLossPct : 0,
    maxOpenPositions: r.practiceUnlimited ? r.practiceMaxOpen : r.maxOpenPositions,
  }
}
