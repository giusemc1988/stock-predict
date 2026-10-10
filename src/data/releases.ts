/**
 * Version and "What's new". Bump APP_VERSION and add an entry to the top of RELEASES
 * with each update. The banner shows once per version, then stays dismissed.
 */
export const APP_VERSION = '1.5.2'

export interface Release {
  version: string
  date: string
  changes: string[]
  /** Vietnamese version of the same list, shown when the app language is Tiếng Việt. */
  changesVi?: string[]
}

export const RELEASES: Release[] = [
  {
    version: '1.5.2',
    date: '2026-10-10',
    changes: [
      'Practice trades now tell their whole story. Tap any 🎯 Practice row in Positions, Open orders or History (▸ details) to see: when it bought and at what price, why (the AI call, Trade Score, why the picker chose it, and the checks it passed), the data it used, when it will sell (target, stop, and the market-close or long-term hold deadline), and once closed, when and why it sold, the profit or loss, costs and the process review.',
      'Each practice row shows a clear status: Open, Closed or Blocked. History also lists today\'s blocked buys and the rule that stopped each one (up to 20).',
      'The details fit a phone screen and follow the same "In Positions & History" switch.',
    ],
    changesVi: [
      'Lệnh luyện tập giờ kể đầy đủ câu chuyện. Chạm vào dòng 🎯 Practice trong Vị thế, Lệnh chờ hoặc Lịch sử (▸ details) để xem: mua lúc nào, giá bao nhiêu, vì sao (nhận định AI, Điểm GD, lý do bộ chọn mã chọn nó và các bước kiểm tra đã đạt), dữ liệu đã dùng, khi nào sẽ bán (chốt lời, cắt lỗ, và hạn đóng cửa hoặc hạn giữ dài hạn), và khi đã đóng thì bán lúc nào, vì sao, lãi/lỗ, chi phí và đánh giá quy trình.',
      'Mỗi dòng luyện tập hiện rõ trạng thái: Đang mở, Đã đóng hoặc Bị chặn. Lịch sử cũng liệt kê các lệnh mua bị chặn hôm nay và quy tắc đã chặn (tối đa 20).',
      'Phần chi tiết hiển thị gọn trên điện thoại và theo cùng công tắc "Trong Vị thế & Lịch sử".',
    ],
  },
  {
    version: '1.5.1',
    date: '2026-10-10',
    changes: [
      "Fix: the AI's practice trades now show in the bottom panel. Positions lists its open trades, Open orders lists each trade's take-profit and stop-loss, and History lists every buy and sell, each tagged 🎯 Practice. Before, these tabs only showed your own paper account, so they looked empty while the AI was trading.",
      'Turn it off in the Practice tab ("In Positions & History") or Settings > AI rules. Practice rows have no Close or Cancel button; the AI manages them.',
    ],
    changesVi: [
      'Sửa lỗi: lệnh luyện tập của AI giờ hiện ở bảng dưới. Vị thế liệt kê các lệnh đang mở, Lệnh chờ liệt kê chốt lời và cắt lỗ của từng lệnh, và Lịch sử liệt kê mọi lệnh mua bán, đều gắn nhãn 🎯 Practice. Trước đây các tab này chỉ hiện tài khoản thử nghiệm của bạn nên trông trống trơn dù AI đang giao dịch.',
      'Tắt trong tab Luyện tập ("Trong Vị thế & Lịch sử") hoặc Cài đặt > Quy tắc AI. Dòng luyện tập không có nút Đóng hay Hủy; AI tự quản lý.',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-10-10',
    changes: [
      'Safety upgrade for the AI, based on the Master Prompt v3.0 spec. Every new part has its own switch in Settings > AI rules, all on by default.',
      'Data check: every price is labeled Real-time, Delayed, Historical or Mock (shown next to the feed at the top). The AI no longer buys on simulated prices or on a bar older than 30 minutes (or one bar). Exits always work.',
      'Hard risk limits the AI cannot change: at most 8 open positions, at most 60% of the account in open trades, and buys halt after a 20% drop from the peak. They hold even with the other risk gates off. Robot orders get a fixed order id, so a retry can never buy twice.',
      'Realistic fills: fees (1 bps), half the bid-ask spread (4 bps) and slippage (2 bps) on market and stop fills, in practice and in the paper simulator. Targets fill at their price. Trades show what costs took.',
      'Decision log (Practice > Decision log): every AI buy and sell, accepted or rejected, with the data source, how old the bar was, the checks it passed and what stopped it. Includes the robot on your paper account.',
      'Trade review: each closed trade is graded on process (reward at least 1.5x risk, Trade Score 40+, fresh real data, learner not saying HOLD) separately from the result, so you can see wins that were just luck.',
      'Daily report (Practice > Daily report): trades, wins, net P&L, costs, buys taken and rejected, and lessons for each day. The 24/7 server saves the last 30 days.',
      "Skill registry (Settings > AI rules > Skills): the AI's 7 skills with version, source, permissions and a self-test. Set each to Approved, Quarantine or Revoked; only approved skills feed signals, and a skill that fails its self-test is quarantined. No code is downloaded from GitHub or written by an AI.",
      'Not financial advice. Paper trading only; nothing here places a real order.',
    ],
    changesVi: [
      'Nâng cấp an toàn cho AI theo bản đặc tả Master Prompt v3.0. Mỗi phần mới có công tắc riêng trong Cài đặt > Quy tắc AI, mặc định đều bật.',
      'Kiểm tra dữ liệu: mọi giá được gắn nhãn Thời gian thực, Trễ, Lịch sử hoặc Giả lập (hiện cạnh nguồn dữ liệu ở trên cùng). AI không còn mua trên giá giả lập hoặc trên nến cũ hơn 30 phút (hoặc một nến). Lệnh thoát luôn hoạt động.',
      'Giới hạn rủi ro cứng mà AI không thể thay đổi: tối đa 8 vị thế mở, tối đa 60% tài khoản trong các lệnh mở, và dừng mua khi giảm 20% từ đỉnh. Vẫn áp dụng kể cả khi tắt các cổng rủi ro khác. Lệnh robot có mã lệnh cố định nên thử lại không bao giờ mua hai lần.',
      'Khớp lệnh thực tế: phí (1 bps), nửa chênh lệch mua-bán (4 bps) và trượt giá (2 bps) khi khớp lệnh thị trường và cắt lỗ, trong luyện tập và trình mô phỏng. Chốt lời khớp đúng giá. Mỗi lệnh hiện chi phí đã trả.',
      'Nhật ký quyết định (Luyện tập > Nhật ký quyết định): mọi lệnh mua bán của AI, được chấp nhận hay bị từ chối, kèm nguồn dữ liệu, độ cũ của nến, các bước kiểm tra đã đạt và lý do bị chặn. Gồm cả robot trên tài khoản thử nghiệm của bạn.',
      'Đánh giá lệnh: mỗi lệnh đã đóng được chấm theo quy trình (lợi nhuận ít nhất 1,5 lần rủi ro, Điểm GD từ 40, dữ liệu thật và mới, bộ học không nói GIỮ) tách khỏi kết quả, để thấy lệnh nào thắng chỉ nhờ may mắn.',
      'Báo cáo ngày (Luyện tập > Báo cáo ngày): số lệnh, lệnh thắng, lãi/lỗ ròng, chi phí, lệnh mua đã vào và bị từ chối, cùng bài học mỗi ngày. Máy chủ 24/7 lưu 30 ngày gần nhất.',
      'Danh sách kỹ năng (Cài đặt > Quy tắc AI > Kỹ năng): 7 kỹ năng của AI kèm phiên bản, nguồn, quyền và tự kiểm thử. Đặt mỗi kỹ năng là Đã duyệt, Cách ly hoặc Thu hồi; chỉ kỹ năng được duyệt mới tạo tín hiệu, và kỹ năng không đạt kiểm thử sẽ bị cách ly. Không tải mã từ GitHub hay chạy mã do AI viết.',
      'Không phải lời khuyên đầu tư. Chỉ giao dịch thử nghiệm; không có lệnh thật nào được đặt.',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-10-09',
    changes: [
      'Practice now trades 24/7 on the server, so you can close the app. Every 15 minutes during US market hours on weekdays it scans the watchlist and today\'s top gainers and most-traded stocks, then makes its day trades and long-term trade. No Alpaca key needed.',
      'When you come back, its trades are on the chart and in the Practice tab (activity feed, report, wins and fails), and a pop-up says how many buys and sells it made while you were away.',
      'New "AI active" list at the top of the watchlist: the stocks practice is trading (with live P&L), closed today, or watching as its best picks, so you never have to look for them. Tap one to open its chart with the practice arrows. Optional: let the chart follow each new practice trade (off by default). Both switches are in Settings > AI rules.',
      'Day trades are closed by the 4 pm ET market close. Stops and targets reached between runs are filled at the stop or target price.',
      'Switch: "Practice 24/7 on the server" in Settings > AI rules (on). Turned off, practice trades in your browser while the app is open, as before. The server uses the default rules (4 day trades and 1 long-term trade a day, 2% per trade).',
      'Not financial advice. Paper trading only; nothing here places a real order.',
    ],
    changesVi: [
      'Luyện tập giờ giao dịch 24/7 trên máy chủ, nên bạn có thể đóng ứng dụng. Mỗi 15 phút trong giờ thị trường Mỹ vào ngày thường, AI quét danh sách theo dõi cùng các mã tăng mạnh và giao dịch nhiều nhất hôm nay, rồi làm các lệnh trong ngày và lệnh dài hạn. Không cần khoá Alpaca.',
      'Khi bạn quay lại, các lệnh hiện trên biểu đồ và trong tab Luyện tập (nhật ký hoạt động, báo cáo, thắng và thua), và một thông báo cho biết AI đã mua bán bao nhiêu lệnh khi bạn vắng mặt.',
      'Danh sách "AI đang hoạt động" mới ở đầu danh sách theo dõi: các mã luyện tập đang giữ (kèm lãi/lỗ trực tiếp), đã đóng hôm nay, hoặc đang theo dõi là mã tốt nhất, nên bạn không phải tự tìm. Bấm vào một mã để mở biểu đồ cùng mũi tên luyện tập. Tuỳ chọn: biểu đồ tự chuyển theo mỗi lệnh luyện tập mới (mặc định tắt). Cả hai công tắc ở Cài đặt > Quy tắc AI.',
      'Lệnh trong ngày đóng trước giờ đóng cửa 4 giờ chiều (giờ New York). Cắt lỗ và chốt lời chạm giữa các lần chạy được khớp đúng ở giá cắt lỗ hoặc chốt lời.',
      'Công tắc: "Luyện tập 24/7 trên máy chủ" trong Cài đặt > Quy tắc AI (bật). Khi tắt, luyện tập chạy trong trình duyệt khi ứng dụng đang mở như trước. Máy chủ dùng quy tắc mặc định (4 lệnh trong ngày và 1 lệnh dài hạn mỗi ngày, 2% mỗi lệnh).',
      'Không phải lời khuyên đầu tư. Chỉ giao dịch thử nghiệm; không có lệnh thật nào được đặt.',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-10-09',
    changes: [
      "Practice mode now picks its own markets. Every 5 minutes it scans your watchlist and today's top gainers and most-traded US stocks on 15-minute bars, ranks the AI's BUY calls by Trade Score, volume and today's gain, and trades the best: the top pick becomes the day's long-term trade, the next ones the day trades. You no longer need to have the chart open.",
      "The Practice tab shows Today's picks (rank, AI call, today's gain, volume and Trade Score), with a Scan now button. Every practice trade records why it was picked, and the report compares results by how the stock was found.",
      "Practice orders pop up on the chart whatever market you are viewing; open a picked market's chart from the list to see its arrows and lines.",
      "Stocks and today's movers need an Alpaca paper key (Portfolio page); without one it scans crypto only. Switches in Settings > AI rules: Picks its own stocks, and Today's movers.",
      'Not financial advice. Paper trading only; nothing here places a real order.',
    ],
    changesVi: [
      'Chế độ luyện tập giờ tự chọn mã. Mỗi 5 phút AI quét danh sách theo dõi cùng các cổ phiếu Mỹ tăng mạnh và giao dịch nhiều nhất hôm nay trên nến 15 phút, xếp hạng lệnh MUA của AI theo Điểm GD, khối lượng và mức tăng hôm nay, rồi giao dịch các mã tốt nhất: mã đứng đầu thành lệnh dài hạn trong ngày, các mã tiếp theo thành lệnh trong ngày. Không cần mở biểu đồ nữa.',
      'Tab Luyện tập hiện Mã được chọn hôm nay (hạng, lệnh của AI, mức tăng hôm nay, khối lượng và Điểm GD) cùng nút Quét ngay. Mỗi lệnh luyện tập ghi lại lý do được chọn, và báo cáo so sánh kết quả theo nguồn chọn mã.',
      'Lệnh luyện tập hiện lên trên biểu đồ dù bạn đang xem mã nào; mở biểu đồ của mã được chọn từ danh sách để xem mũi tên và đường giá.',
      'Cổ phiếu và mã biến động hôm nay cần khoá Alpaca thử nghiệm (trang Danh mục); nếu không có, AI chỉ quét tiền điện tử. Công tắc trong Cài đặt > Quy tắc AI: Tự chọn mã, và Mã biến động hôm nay.',
      'Không phải lời khuyên đầu tư. Chỉ giao dịch thử nghiệm; không có lệnh thật nào được đặt.',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-10-09',
    changes: [
      'New Practice mode, switched on so it starts trading right away. The AI paper-trades small sizes on live data while the app is open, in its own $10,000 practice account, even though no method has beaten buying every bar yet. All risk gates stay on. Turn it off any time in the new Practice tab or in Settings > AI rules.',
      'Watch it trade: practice buys and sells appear on the chart as gold arrows, open trades show entry, stop and target lines, and each new order pops up on the chart and as a notification. Each of these has its own switch.',
      'Practice report: an activity feed, win rate and P&L over time, what it learned (by Trade Score grade, exit type, volatility, learner opinion and market), and lists of successful and failed trades with why each was opened and closed.',
      'Each day it makes up to 4 quick day trades, all closed before market close, plus 1 long-term trade held up to 5 days with a wider stop and target. Both counts and the holding time can be changed in Settings > AI rules, and each kind has its own switch. It only trades when the AI says BUY, so some days have fewer.',
      'The report splits day trades and long-term trades, so you can compare them.',
      'Trade size is 2% of the practice account by default (Settings > AI rules), halved in high volatility.',
      'Not financial advice. Paper trading only; nothing here places a real order.',
    ],
    changesVi: [
      'Chế độ Luyện tập mới, đã bật sẵn để bắt đầu giao dịch ngay. AI giao dịch thử khối lượng nhỏ trên dữ liệu thật khi ứng dụng đang mở, trong tài khoản luyện tập $10,000 riêng, dù chưa có phương pháp nào thắng việc mua mọi nến. Mọi cổng rủi ro vẫn bật. Có thể tắt bất cứ lúc nào trong tab Luyện tập mới hoặc trong Cài đặt > Quy tắc AI.',
      'Xem AI giao dịch: lệnh mua và bán luyện tập hiện trên biểu đồ bằng mũi tên vàng, lệnh đang mở có đường giá vào, cắt lỗ và chốt lời, mỗi lệnh mới hiện lên trên biểu đồ và thành thông báo. Mỗi phần có công tắc riêng.',
      'Báo cáo luyện tập: nhật ký hoạt động, tỷ lệ thắng và lãi/lỗ theo thời gian, AI đã học gì (theo hạng Điểm Giao dịch, cách thoát, biến động, ý kiến bộ học và mã), cùng danh sách lệnh thành công và thất bại kèm lý do vào và ra.',
      'Mỗi ngày AI làm tối đa 4 lệnh trong ngày nhanh, tất cả đóng trước giờ đóng cửa, cùng 1 lệnh dài hạn giữ tối đa 5 ngày với cắt lỗ và chốt lời rộng hơn. Có thể đổi số lệnh và thời gian giữ trong Cài đặt > Quy tắc AI, mỗi loại có công tắc riêng. AI chỉ giao dịch khi nói MUA, nên có ngày ít lệnh hơn.',
      'Báo cáo tách riêng lệnh trong ngày và lệnh dài hạn để bạn so sánh.',
      'Khối lượng mặc định là 2% tài khoản luyện tập (Cài đặt > Quy tắc AI), giảm một nửa khi biến động cao.',
      'Không phải lời khuyên đầu tư. Chỉ giao dịch thử nghiệm; không có lệnh thật nào được đặt.',
    ],
  },
  {
    version: '1.1.1',
    date: '2026-10-09',
    changes: [
      'Auto learning on the server now runs every hour during US market hours on weekdays and once a day on weekends, about 210 short runs a month, so it stays free. Crypto bars that close overnight are still scored on the next run.',
      'Auto learning uses no AI tokens: it is plain code, not Claude.',
      'Not financial advice. Paper trading only.',
    ],
    changesVi: [
      'Tự học trên máy chủ giờ chạy mỗi giờ trong giờ thị trường Mỹ vào ngày thường và mỗi ngày một lần vào cuối tuần, khoảng 210 lần ngắn mỗi tháng, nên vẫn miễn phí. Nến tiền điện tử đóng ban đêm vẫn được chấm ở lần chạy sau.',
      'Tự học không tốn token AI: đây là mã thường, không phải Claude.',
      'Không phải lời khuyên đầu tư. Chỉ giao dịch thử nghiệm.',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-10-09',
    changes: [
      'New 24/7 auto learning (off by default). Turn it on in the Learning tab or in Settings > AI rules. Each hourly cycle replays old bars and scores every new bar with the whole analyst (trading-analyst rules, Trade Score, volatility rule, sizing), then grades the result 5 bars later.',
      'It keeps learning while the app is closed: an hourly server cycle saves its results, and the app picks them up when you open it.',
      'The Learning tab now has 24/7 learning (counters, last and next cycle, "Run learning cycle now"), What it learned (self-scorecard, the learner, a Teach box and a dated learning log), PAPER arena (simulated $10,000 trading new bars only) and a Success report for every signal (win rate, average gain, tracked, trend). The old research tables are under Research.',
      'Fairer learner: a score bucket now has to beat simply buying every time by 3 points (changeable in AI rules) before the learner says BUY, so a rising market no longer looks like skill.',
      'Not financial advice. Paper trading only; nothing here places a real order.',
    ],
    changesVi: [
      'Tự học 24/7 mới (mặc định tắt). Bật trong tab Học tập hoặc Cài đặt > Quy tắc AI. Mỗi chu kỳ một giờ chạy lại nến cũ và chấm mọi nến mới bằng toàn bộ bộ phân tích (quy tắc trading-analyst, Điểm Giao dịch, quy tắc biến động, khối lượng), rồi chấm kết quả sau 5 nến.',
      'Vẫn học khi đóng ứng dụng: chu kỳ máy chủ mỗi giờ lưu kết quả, và ứng dụng tải về khi bạn mở.',
      'Tab Học tập giờ có Tự học 24/7 (bộ đếm, chu kỳ trước và kế tiếp, "Chạy chu kỳ học ngay"), AI đã học gì (tự chấm điểm, bộ học, ô Dạy AI và nhật ký học theo ngày), Đấu trường THỬ (10.000$ giả lập chỉ giao dịch nến mới) và Báo cáo hiệu quả cho từng tín hiệu (tỷ lệ thắng, lãi trung bình, số lần, xu hướng). Bảng nghiên cứu cũ nằm ở mục Nghiên cứu.',
      'Bộ học công bằng hơn: một nhóm điểm phải hơn việc luôn mua 3 điểm (đổi được trong Quy tắc AI) thì bộ học mới nói MUA, nên thị trường đi lên không còn trông như kỹ năng.',
      'Không phải lời khuyên đầu tư. Chỉ giao dịch thử nghiệm; không có lệnh thật nào được đặt.',
    ],
  },
  {
    version: '1.0.1',
    date: '2026-10-09',
    changes: [
      'The version you are running now shows next to the Arc Analyst name at the top, and at the bottom of Settings.',
      'Not financial advice. Paper trading only.',
    ],
    changesVi: [
      'Phiên bản bạn đang chạy giờ hiển thị cạnh tên Arc Analyst ở trên cùng, và ở cuối phần Cài đặt.',
      'Không phải lời khuyên đầu tư. Chỉ giao dịch thử nghiệm.',
    ],
  },
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
