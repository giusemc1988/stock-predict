/**
 * Version and "What's new". Bump APP_VERSION and add an entry to the top of RELEASES
 * with each update. The banner shows once per version, then stays dismissed.
 */
export const APP_VERSION = '0.8.0'

export interface Release {
  version: string
  date: string
  changes: string[]
  /** Vietnamese version of the same list, shown when the app language is Tiếng Việt. */
  changesVi?: string[]
}

export const RELEASES: Release[] = [
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
