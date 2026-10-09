/**
 * Version and "What's new". Bump APP_VERSION and add an entry to the top of RELEASES
 * with each update. The banner shows once per version, then stays dismissed.
 */
export const APP_VERSION = '1.0.0'

export interface Release {
  version: string
  date: string
  changes: string[]
  /** Vietnamese version of the same list, shown when the app language is Tiếng Việt. */
  changesVi?: string[]
}

export const RELEASES: Release[] = [
  {
    version: '1.0.0',
    date: '2026-10-09',
    changes: [
      'New Trade Score (0-100) on the AI Analyst tab: technical, sentiment, risk and thesis parts with a grade from A+ to F. Tap it for the breakdown. Fundamentals and news are marked n/a until the app has that data.',
      'Risk gates on every paper order: kill switch, daily loss, account drawdown (20%), one stock over 25% of the account, 50 orders a day, extreme volatility and a weak Trade Score. A failed gate stops the buy; selling is never blocked.',
      'New kill switch on the Trade tab stops all new buys, yours and the robot\'s.',
      'AI stop loss and scaling plan: a stop under the recent swing low (or 1.5 ATR), buy half now and half on a dip, sell a third at 1R and 2R, and trail the rest. Each step says why. "Open order ticket" fills in the stop, take-profit and size.',
      'Position size now also follows the risk score and is halved when price swings are much bigger than usual.',
      'Robot backtest adds profit factor, average per trade, longest losing streak, and warnings when results look too good to be true.',
      'New AI rules in Settings (or "Edit AI rules" on the AI Analyst tab): change the BUY/SELL threshold, risk per trade, size limits, risk gates, and turn each module on or off. Reset to defaults any time.',
      'Ideas adapted from open-source projects (MIT): AI Trading Analyst for Claude Code, CBT Framework, CloddsBot and MetaHarness. Nothing from them trades live.',
      'Not financial advice. Paper trading only.',
    ],
    changesVi: [
      'Điểm Giao dịch mới (0-100) trong tab Phân tích AI: phần kỹ thuật, tâm lý, rủi ro và luận điểm, xếp hạng từ A+ đến F. Bấm vào để xem chi tiết. Phần cơ bản và tin tức ghi n/a cho đến khi ứng dụng có dữ liệu đó.',
      'Cổng kiểm soát rủi ro cho mọi lệnh thử nghiệm: công tắc dừng khẩn cấp, lỗ trong ngày, mức sụt giảm tài khoản (20%), một mã vượt 25% tài khoản, 50 lệnh mỗi ngày, biến động cực mạnh và Điểm Giao dịch yếu. Cổng không đạt sẽ chặn lệnh mua; lệnh bán không bao giờ bị chặn.',
      'Công tắc dừng khẩn cấp mới trong tab Giao dịch chặn mọi lệnh mua mới, của bạn và của robot.',
      'Kế hoạch cắt lỗ và chia lệnh của AI: cắt lỗ dưới đáy gần nhất (hoặc 1.5 ATR), mua một nửa bây giờ và nửa còn lại khi giá giảm, bán 1/3 tại 1R và 2R, và để phần còn lại chạy theo giá. Mỗi bước đều có giải thích. "Mở phiếu lệnh" điền sẵn cắt lỗ, chốt lời và khối lượng.',
      'Khối lượng vị thế giờ cũng theo điểm rủi ro và giảm một nửa khi giá dao động mạnh hơn nhiều so với bình thường.',
      'Kiểm thử robot thêm hệ số lợi nhuận, lãi trung bình mỗi giao dịch, chuỗi thua dài nhất, và cảnh báo khi kết quả tốt đến mức khó tin.',
      'Quy tắc AI mới trong Cài đặt (hoặc "Sửa quy tắc AI" trong tab Phân tích AI): đổi ngưỡng MUA/BÁN, rủi ro mỗi giao dịch, giới hạn khối lượng, cổng rủi ro, và bật/tắt từng mô-đun. Có thể khôi phục mặc định bất cứ lúc nào.',
      'Ý tưởng lấy từ các dự án mã nguồn mở (MIT): AI Trading Analyst for Claude Code, CBT Framework, CloddsBot và MetaHarness. Không có phần nào giao dịch thật.',
      'Không phải lời khuyên đầu tư. Chỉ giao dịch thử nghiệm.',
    ],
  },
  {
    version: '0.9.0',
    date: '2026-10-09',
    changes: [
      'Bluechip is now Arc Analyst: new arc-reactor logo, app icon and navy and gold colors.',
      'Research, not promises. Paper trading only.',
    ],
    changesVi: [
      'Bluechip nay là Arc Analyst: logo lò phản ứng hồ quang mới, biểu tượng ứng dụng và màu xanh navy với vàng.',
      'Nghiên cứu, không hứa hẹn. Chỉ giao dịch thử nghiệm.',
    ],
  },
  {
    version: '0.8.0',
    date: '2026-10-09',
    changes: [
      'AI analyst plans now say how much of the account to use: 1% at risk per idea, capped at 10% (5% until the model has 30 trades).',
      'If buy-and-hold beat the model on a chart, the analyst says there is no edge and sizes nothing.',
      'The analyst card shows the not-financial-advice note.',
      'Not financial advice. Paper trading only.',
    ],
    changesVi: [
      'Kế hoạch của phân tích AI giờ cho biết nên dùng bao nhiêu tài khoản: rủi ro tối đa 1% cho mỗi ý tưởng, giới hạn 10% (5% cho đến khi mô hình có 30 giao dịch).',
      'Nếu mua và giữ đã làm tốt hơn mô hình trên một biểu đồ, phân tích AI sẽ nói không có lợi thế và không đề xuất khối lượng.',
      'Thẻ phân tích AI hiển thị lưu ý không phải lời khuyên đầu tư.',
      'Không phải lời khuyên đầu tư. Chỉ giao dịch thử nghiệm.',
    ],
  },
  {
    version: '0.7.0',
    date: '2026-10-09',
    changes: [
      'Chart options: toggle SMA, Bollinger Bands and Volume on the price chart, and set their periods in the settings panel. Saved in this browser.',
      'English and Tiếng Việt language switch in Settings.',
      'Glass-style theme with blurred panels.',
      'Fixed: an empty chart setting no longer saves 0 or breaks the chart.',
      'Not financial advice. Paper trading only.',
    ],
    changesVi: [
      'Tùy chọn biểu đồ: bật/tắt SMA, dải Bollinger và Khối lượng trên biểu đồ giá, và chỉnh chu kỳ trong bảng cài đặt. Được lưu trong trình duyệt này.',
      'Chuyển đổi ngôn ngữ English và Tiếng Việt trong Cài đặt.',
      'Giao diện kính mờ với các bảng có hiệu ứng làm mờ.',
      'Đã sửa: ô cài đặt biểu đồ để trống không còn lưu 0 hoặc làm hỏng biểu đồ.',
      'Không phải lời khuyên đầu tư. Chỉ giao dịch thử nghiệm.',
    ],
  },
  {
    version: '0.6.0',
    date: '2026-10-09',
    changes: [
      'New AI Picks tab: ranks your watchlist by the analyst call, BUY first, with confidence and the reason.',
      'Open any pick to see its inputs: RSI, volume against average, buying share, the analyst reasons, and whether it beat buy-and-hold.',
      'New "Top AI signal success" sort in the watchlist and in AI Picks, with a small-sample warning under 30 trades.',
      'New Learning tab: walk-forward test results and a year-by-year replay of the trade-journal learner.',
      'Not financial advice. Paper trading only.',
    ],
    changesVi: [
      'Tab Gợi ý AI mới: xếp danh sách theo dõi theo khuyến nghị của phân tích AI, mua trước, kèm độ tin cậy và lý do.',
      'Bấm vào từng mã để xem dữ liệu đầu vào: RSI, khối lượng so với trung bình, tỷ lệ mua, lý do của phân tích AI, và có vượt mua và giữ hay không.',
      'Sắp xếp mới "Tín hiệu AI thành công nhất" trong danh sách theo dõi và trong Gợi ý AI, có cảnh báo khi mẫu dưới 30 giao dịch.',
      'Tab Học tập mới: kết quả kiểm thử và kiểm thử lại theo năm của bộ học nhật ký giao dịch.',
      'Không phải lời khuyên đầu tư. Chỉ giao dịch thử nghiệm.',
    ],
  },
]
