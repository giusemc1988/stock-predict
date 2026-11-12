/**
 * Version and "What's new". Bump APP_VERSION and add an entry to the top of RELEASES
 * with each update. The banner shows once per version, then stays dismissed.
 */
export const APP_VERSION = '2.0.28'

export interface Release {
  version: string
  date: string
  changes: string[]
  /** Vietnamese version of the same list, shown when the app language is Tiếng Việt. */
  changesVi?: string[]
}

export const RELEASES: Release[] = [
  {
    version: '2.0.28',
    date: '2026-11-12',
    changes: ['Atlas practice: setup brake. A setup (day or long + scanner source) whose last 30 closed trades have a profit factor under 0.8 now trades at half size until it recovers, so learning finally changes behaviour (switch practiceSetupBrake). Also new: a daily no-AI ledger on the backups branch showing where trades win or lose, a go-live gate (real money stays off until 200 trades, PF 1.3, bootstrap PF above 1, 90 days), and fixed keep/kill rules for every shadow sleeve (atlas/SLEEVES.md).'],
    changesVi: ['Atlas luyện tập: phanh theo nhóm lệnh. Nhóm lệnh (trong ngày hoặc dài hạn + nguồn quét) có PF dưới 0,8 trong 30 lệnh gần nhất sẽ vào nửa khối lượng đến khi hồi phục, nên việc học cuối cùng đã đổi được hành vi (công tắc practiceSetupBrake). Mới nữa: sổ cái hằng ngày không dùng AI trên nhánh backups cho biết lệnh thắng thua ở đâu, cổng tiền thật (chưa bật cho đến khi đủ 200 lệnh, PF 1,3, PF cận dưới trên 1, 90 ngày), và luật giữ/tắt cố định cho mọi nhánh chạy bóng (atlas/SLEEVES.md).'],
  },
  {
    version: '2.0.28',
    date: '2026-11-12',
    changes: ['Team library: one shared place (docs/library in the repo) that Claude, Muse and the Hermes agents all read and write. It holds the rules from Chanh, step-by-step playbooks with a self-check before saying done, lessons learned (problem, cause, fix) so nobody debugs the same thing twice, and an inbox for questions and feedback from agents. AGENTS.md now tells every agent to read it first.'],
    changesVi: ['Thư viện chung của đội: một chỗ duy nhất (docs/library trong repo) mà Claude, Muse và các Hermes đều đọc và ghi. Có luật của anh Chanh, playbook từng bước kèm bước tự kiểm trước khi báo xong, bài học (vấn đề, nguyên nhân, cách sửa) để không ai sửa lại cùng một lỗi, và hộp thư cho agent hỏi hoặc góp ý. AGENTS.md giờ bắt mọi agent đọc nó trước.'],
  },
  {
    version: '2.0.27',
    date: '2026-11-12',
    changes: ['Atlas practice: two live filters are now on, taken from the forward test of 170 live-tagged trades. Buys need 15m volume at least 1.5x normal and a planned stop at least 2% away. Kept trades: 61, won 48%, profit factor 1.56, +$270. Skipped trades: 109, won 34%, profit factor 0.74, -$231. Two switches in AI rules (practiceVolFloor15, practiceMinStop2) turn each off. Re-grade after 50 trades with the filters on.'],
    changesVi: ['Atlas luyện tập: bật thật hai bộ lọc rút ra từ 170 lệnh chạy bóng. Chỉ mua khi khối lượng 15 phút ít nhất 1,5 lần bình thường và cắt lỗ dự kiến cách giá vào ít nhất 2%. Nhóm giữ: 61 lệnh, thắng 48%, PF 1,56, +$270. Nhóm bỏ: 109 lệnh, thắng 34%, PF 0,74, −$231. Hai công tắc trong AI rules (practiceVolFloor15, practiceMinStop2) tắt từng cái được. Chấm lại sau 50 lệnh có lọc.'],
  },
  {
    version: '2.0.26',
    date: '2026-11-12',
    changes: ['Max voice box: typing no longer lags (live words are shown under the box instead of being pushed into it, spell-check off), and the voice is now recorded and written down by Whisper with a Vietnamese + English word hint, so mixed sentences come out right. The browser recognizer only shows live words and is the backup. Language: Auto (mixed) / Vietnamese / English.'],
    changesVi: ['Ô giọng nói trên Max: gõ không còn bị chậm (chữ đang nghe hiện bên dưới ô, không đẩy vào ô nữa, tắt kiểm tra chính tả), và giọng nói giờ được ghi âm rồi Whisper chép lại kèm gợi ý từ Việt + Anh nên câu trộn hai tiếng ra đúng hơn. Nhận dạng của trình duyệt chỉ hiện chữ tạm và làm dự phòng. Ngôn ngữ: Tự nhận (trộn) / Tiếng Việt / English.'],
  },
  {
    version: '2.0.25',
    date: '2026-11-12',
    changes: ['Max page: new "Tell Claude by voice" box. Press the mic and talk (Vietnamese or English) or type, press Done, check the prompt it writes, then Send: it copies the prompt and opens the Neo Hub project in the Claude app so you paste once. There is also a box to keep the ready prompt Claude gives back, with a Copy button for Muse.'],
    changesVi: ['Trang Max: thêm ô "Nói cho Claude". Bấm mic nói (tiếng Việt hoặc English) hoặc gõ, bấm Xong, xem lại prompt em viết, rồi bấm Gửi: nó copy prompt và mở dự án Neo Hub trong app Claude để anh dán một lần. Có thêm ô giữ prompt sẵn Claude trả về, kèm nút Copy để đưa cho Muse.'],
  },
  {
    version: '2.0.24',
    date: '2026-11-12',
    changes: ['Max page: new "Office" board for the team. See who is in charge (Claude or Milo), whether the Windows and Ubuntu machines are on, the work queue and the log. Give work to Claude or Milo, or a fixed script to a machine; red work waits for your OK; one button hands control to Milo when Claude is out of limit.'],
    changesVi: ['Trang Max: thêm bảng "Văn phòng" cho đội. Xem ai đang chỉ huy (Claude hay Milo), máy Windows và Ubuntu có bật không, hàng việc và nhật ký. Giao việc cho Claude hoặc Milo, hoặc giao script cố định cho máy; việc đỏ chờ anh duyệt; một nút chuyển quyền cho Milo khi Claude hết limit.'],
  },
  {
    version: '2.0.23',
    date: '2026-11-10',
    changes: ['Atlas #271 shadow test: volume filter 1.5x + stop filter 2% (shadow only, no live trading change)'],
    changesVi: ['Atlas #271 thử nghiệm shadow: lọc volume 1.5x + lọc stop 2% (chỉ shadow, không đổi live)'],
  },
  {
    version: '2.0.22',
    date: '2026-11-06',
    changes: ['Atlas practice, three small fixes (paper only, each with its own switch in AI rules): (1) no buys on stocks under $10 (cheap stocks slipped past their stop); (2) the "half size in high volatility" rule is off, because long trades are already half size; (3) when slots are short, stocks from the nightly Leaders top 100 get them first.'],
    changesVi: ['Atlas luyện tập, 3 chỉnh nhỏ (chỉ giấy, mỗi cái có công tắc riêng trong Luật AI): (1) không mua cổ phiếu dưới $10 (mã rẻ hay trượt qua cắt lỗ); (2) tắt luật "biến động cao giảm nửa khối lượng" vì lệnh dài hạn đã giảm nửa; (3) khi thiếu lượt mua, mã trong top 100 "Dẫn đầu" được ưu tiên trước.'],
  },
  {
    version: '2.0.21',
    date: '2026-11-06',
    changes: ['Clearer queue help: tasks you send wait for Claude in the Claude app (project Neo Hub), where you type "làm hàng chờ Atlas"; the Neo chat inside this app only lists them. Typing "làm hàng chờ" in the Neo chat now shows the queue and says where to send it.'],
    changesVi: ['Hướng dẫn hàng chờ rõ hơn: việc anh gửi sẽ chờ Claude trong app Claude (dự án Neo Hub), anh gõ "làm hàng chờ Atlas" ở đó; ô chat Neo trong app này chỉ xem danh sách. Gõ "làm hàng chờ" vào chat Neo giờ hiện hàng chờ và chỉ chỗ để gửi.'],
  },
  {
    version: '2.0.20',
    date: '2026-11-06',
    changes: ['Atlas control panel, Upgrade tab: each idea and each GitHub repo has a tick box. Tick up to 6 and press "Do the picked ones": they go to Claude as ONE task (one read of the code, one PR), which uses fewer tokens than one task each. The single "Do this" buttons still work.'],
    changesVi: ['Bảng điều khiển Atlas, tab Nâng cấp: mỗi gợi ý và mỗi repo GitHub có ô vuông để tích. Tích tối đa 6 mục rồi bấm "Làm các mục đã chọn": tất cả gửi cho Claude thành MỘT việc (đọc code một lần, một PR), đỡ tốn token hơn gửi từng cái. Nút "Làm cái này" từng mục vẫn dùng được.'],
  },
  {
    version: '2.0.19',
    date: '2026-11-06',
    changes: ['Atlas control panel: after a fix ships (2.0.18), the Learning and Profit-factor lights stop showing red for old trades. They turn grey "fixed, waiting 0/30 new trades" and judge again on the 30 trades after the fix. A task already in the queue shows "In the queue #N" instead of a second "Do this" button.'],
    changesVi: ['Bảng điều khiển Atlas: sau khi đã sửa (bản 2.0.18), đèn "Ghi sổ, học" và "Lãi/lỗ (PF)" không còn báo đỏ vì lệnh cũ. Đèn chuyển xám "đã sửa, chờ 0/30 lệnh mới" và chỉ chấm lại trên 30 lệnh sau khi sửa. Việc đã có trong hàng chờ hiện "Đã ở hàng chờ #N" thay vì nút "Làm cái này" thứ hai.'],
  },
  {
    version: '2.0.18',
    date: '2026-11-06',
    changes: ['Atlas practice trades smarter (paper only, each with its own switch in AI rules): (1) no buys on volume under normal (those won 10%) and no day trades picked from the watchlist (won 21-29%); (2) once a trade is up 1R (its stop distance) the stop moves to the entry price, and a trade in profit is no longer closed after 12 bars, so winners can run; (3) long-term trades open at half size because overnight gaps can jump past the stop. Re-graded after 30 trades.'],
    changesVi: ['Atlas luyện tập khôn hơn (chỉ giấy, mỗi cái có công tắc riêng trong Luật AI): (1) không mua khi khối lượng dưới bình thường (nhóm này chỉ thắng 10%) và không mở lệnh trong ngày từ danh sách theo dõi (thắng 21-29%); (2) lệnh lãi bằng 1R (bằng khoảng cắt lỗ) thì dời cắt lỗ về giá vào, lệnh đang lãi không còn bị đóng sau 12 nến, để lệnh thắng chạy tiếp; (3) lệnh dài hạn vào nửa khối lượng vì giá có thể nhảy qua cắt lỗ qua đêm. Chấm lại sau 30 lệnh.'],
  },
  {
    version: '2.0.17',
    date: '2026-11-06',
    changes: ['Atlas page is shorter: the control panel showed twice by mistake, now once. Under it only today\'s signals stay open; every other card (where Atlas is, what it learns, idea factory, Leaders, why it trades, Neo picks, movers, learner, recent activity) is folded into "More detail", one tap to open. Nothing removed; the Hub card buttons open the fold for you.'],
    changesVi: ['Trang Atlas ngắn lại: bảng điều khiển bị hiện 2 lần do lỗi, giờ chỉ còn 1. Bên dưới chỉ để mở thẻ Tín hiệu hôm nay; các thẻ khác (Atlas đang ở đâu, đang học gì, xưởng ý tưởng, Dẫn đầu, vì sao vào lệnh, tín hiệu Neo, biến động, tự học, hoạt động gần đây) gom vào "Xem chi tiết", bấm một lần là mở. Không xóa gì; nút trên thẻ Hub tự mở mục này.'],
  },
  {
    version: '2.0.16',
    date: '2026-11-06',
    changes: ['Atlas control panel tidied: the problems list, the upgrade ideas and a new queue are now one "Work list" card with three tabs (Fix / Upgrade / Queue), and the leaderboard shows the top 5 with "All learners". The queue lists every task you sent with "Do this" and where it stands (waiting, PR ready, done). If the GitHub key is missing it shows the 4 steps with a prefilled link to make one.'],
    changesVi: ['Bảng điều khiển Atlas gọn hơn: danh sách lỗi, gợi ý nâng cấp và hàng chờ mới gộp thành một thẻ "Việc cần làm" có 3 tab (Cần sửa / Nâng cấp / Hàng chờ), bảng xếp hạng hiện 5 dòng đầu kèm nút "Xem tất cả". Hàng chờ hiện mọi việc anh đã bấm "Làm cái này" và trạng thái (đang chờ, có PR, xong). Nếu thiếu key GitHub thì hiện 4 bước kèm link tạo key đã điền sẵn.'],
  },
  {
    version: '2.0.15',
    date: '2026-11-06',
    changes: [
      'New control panel at the top of the Atlas page. One big "Check the system" button lights up every part (nightly scan, 5-minute cycle, learning, profit factor, idea factory, grading, shadow tests, promotion) green, yellow or red, with a one-line verdict. Below: key numbers with goals, a "To do" list in plain words, upgrade ideas and suggested free tools, the new Leaders paper slot included, (plus "Find new on GitHub"), the 6-step map with a "?" explanation, and a leaderboard of every learner against the same pass bar. Every to-do and idea has a ready-written prompt: "Do this" puts it in Claude\'s queue, and Claude works the queue when you say "làm hàng chờ Atlas". Nothing trades differently.',
    ],
    changesVi: [
      'Bảng điều khiển mới ở đầu trang Atlas. Một nút lớn "Kiểm tra hệ thống" bật đèn xanh/vàng/đỏ cho từng bộ phận (quét tối, vòng 5 phút, học, PF, xưởng ý tưởng, chấm điểm, chạy bóng, lên chức) kèm một câu kết luận. Bên dưới: chỉ số chính có mục tiêu, "Cần xử lý" bằng lời dễ hiểu, gợi ý nâng cấp và công cụ miễn phí (có nút "Tìm mới trên GitHub"), bản đồ 6 bước có nút "?" giải thích, và bảng xếp hạng mọi học viên theo cùng một vạch đậu. Mỗi việc và mỗi gợi ý có prompt viết sẵn: bấm "Làm cái này" là vào hàng chờ cho Claude, và Claude làm khi anh nhắn "làm hàng chờ Atlas". Cách giao dịch không đổi.',
    ],
  },
  {
    version: '2.0.14',
    date: '2026-11-06',
    changes: [
      'Leaders now trade on paper: each night Atlas looks at the ~100 leaders for a tight base (narrow range, higher lows, quiet volume), buys when the price breaks through the top of the base on big volume, stops under the base (never more than about one daily range) and holds for days until the trend breaks. It has its own scoreboard on the Leaders card; after 20 finished trades it is marked working or failing, like the idea-factory slots. The main account and the end-of-day closes are not touched. Setups are rare, so expect the first results in a few weeks.',
    ],
    changesVi: [
      'Danh sách Dẫn đầu giờ chạy giấy: mỗi đêm Atlas xem ~100 mã dẫn đầu để tìm vùng đi ngang chặt (biên độ hẹp, đáy sau cao hơn, volume yếu), mua khi giá phá lên đỉnh vùng đó với volume lớn, cắt lỗ dưới vùng đi ngang (không quá khoảng một biên độ ngày) và giữ nhiều ngày đến khi xu hướng gãy. Có bảng điểm riêng trên thẻ Dẫn đầu; sau 20 lệnh đóng sẽ gắn "đáng tin" hoặc "loại" như các ô của xưởng ý tưởng. Tài khoản chính và việc đóng lệnh cuối ngày không bị đụng. Điểm vào hiếm, nên vài tuần mới có kết quả đầu tiên.',
    ],
  },
  {
    version: '2.0.13',
    date: '2026-11-05',
    changes: [
      'New "Leaders" card on the Atlas page: every night after the US close Atlas ranks about 1,800 liquid US stocks (not only its usual 270) and keeps the ~100 with the strongest trend (price above its 50/150/200-day averages, near its yearly high, top 10% strength, or a big 1-3-6 month move), with the strongest sectors. Step 1 of the Leaders funnel: nothing trades yet, it is the shortlist for the next step.',
    ],
    changesVi: [
      'Thẻ "Dẫn đầu" mới trên trang Atlas: mỗi đêm sau phiên Mỹ, Atlas xếp hạng khoảng 1,800 mã Mỹ thanh khoản cao (không chỉ 270 mã quen thuộc) và giữ ~100 mã có xu hướng mạnh nhất (giá trên các đường trung bình 50/150/200 ngày, gần đỉnh năm, sức mạnh top 10%, hoặc tăng mạnh 1-3-6 tháng), kèm các ngành mạnh nhất. Bước 1 của phễu Dẫn đầu: chưa giao dịch gì, đây là danh sách rút gọn cho bước sau.',
    ],
  },
  {
    version: '2.0.12',
    date: '2026-11-04',
    changes: [
      'Idea factory nightly signals now look at about 270 liquid US names instead of 97, so the strategy slots get about 3x more live paper signals a night and are graded sooner. The rules and their thresholds stay fixed from the original 97 names; the new names are unseen data for them.',
    ],
    changesVi: [
      'Tín hiệu hằng đêm của xưởng ý tưởng giờ quét khoảng 270 mã Mỹ thanh khoản cao thay vì 97, nên các ô chiến lược có nhiều tín hiệu giấy hơn (khoảng 3 lần mỗi đêm) và được chấm sớm hơn. Luật và ngưỡng vẫn giữ nguyên từ 97 mã gốc; các mã mới là dữ liệu chúng chưa từng thấy.',
    ],
  },
  {
    version: '2.0.11',
    date: '2026-11-04',
    changes: [
      'Atlas practice account now starts at $100,000 (it was $10,000), matching the Alpaca paper account. Risk per trade is still a percent of the account, so trades are 10x bigger ($50 at the stop instead of $5).',
      'Idea factory: 10 strategy slots run live on paper side by side (was 3), including rules the old tests rejected. Each slot has its own scoreboard; after 20 graded signals it is marked working (wins 55%+, average above 0) or failing. Live paper results decide.',
    ],
    changesVi: [
      'Tài khoản tập của Atlas giờ bắt đầu từ $100,000 (trước là $10,000), khớp với tài khoản paper Alpaca. Rủi ro mỗi lệnh vẫn là % tài khoản nên lệnh to gấp 10 lần ($50 tại điểm cắt lỗ thay vì $5).',
      'Xưởng ý tưởng: 10 ô chiến lược chạy giấy song song (trước là 3), gồm cả luật mà bài kiểm tra cũ đã loại. Mỗi ô có bảng điểm riêng; sau 20 tín hiệu được chấm sẽ gắn "đáng tin" (thắng từ 55%, lãi TB dương) hoặc "loại". Kết quả chạy thật quyết định.',
    ],
  },
  {
    version: '2.0.10',
    date: '2026-11-03',
    changes: [
      'Atlas now asks TradingView\'s screener directly on every scan instead of waiting for a GitHub job (on 2 Nov GitHub skipped almost every scheduled run, so Atlas used Yahoo most of the session). The saved list and then Yahoo remain as fallbacks. Same filters as before.',
    ],
    changesVi: [
      'Atlas giờ hỏi thẳng bộ lọc TradingView mỗi lần quét, không chờ job GitHub nữa (hôm 2/11 GitHub bỏ gần hết các lượt chạy nên Atlas dùng Yahoo gần cả phiên). Danh sách đã lưu rồi Yahoo vẫn là phương án dự phòng. Bộ lọc giữ nguyên.',
    ],
  },
  {
    version: '2.0.9',
    date: '2026-11-02',
    changes: [
      'Atlas scanner now starts from TradingView\'s free screener: every 15 minutes in market hours a GitHub job lists real, liquid movers (price $5+, market cap $300M+, relative volume 1.5x+, NASDAQ/NYSE/AMEX only, up 1%+ today) and Atlas scans those instead of Yahoo\'s gainers list. If the list is missing or older than 45 minutes it falls back to the old scanner. The 2.0.8 quality gate and risk-based size still apply to every buy. Costs no tokens.',
    ],
    changesVi: [
      'Scanner Atlas giờ bắt đầu từ bộ lọc miễn phí của TradingView: mỗi 15 phút trong giờ thị trường, một job GitHub liệt kê các mã chạy thật và thanh khoản (giá từ $5, vốn hóa từ $300M, volume tương đối từ 1.5x, chỉ NASDAQ/NYSE/AMEX, tăng từ 1% hôm nay) và Atlas quét danh sách đó thay vì danh sách tăng mạnh của Yahoo. Nếu danh sách thiếu hoặc cũ hơn 45 phút thì quay về scanner cũ. Bộ lọc chất lượng và cỡ lệnh theo rủi ro của 2.0.8 vẫn áp dụng cho mọi lệnh mua. Không tốn token.',
    ],
  },
  {
    version: '2.0.8',
    date: '2026-11-02',
    changes: [
      'Atlas now sizes each trade by risk: every trade loses about the same (0.05% of the account, about $5) if its stop is hit, so a $760 fund and a $10 stock no longer lose $0.94 against $3.66. Tight stops buy more (capped at 5% of the account), wide stops buy less.',
      'Atlas only buys stocks that pass a quality gate: price at least $5, market cap at least $300M when known, about $26M a day traded, volume at least 1x normal, and a chart that actually moves (0.3% per 15-minute bar). Stops closer than 0.4% are refused. Each refusal is written to the decision log with its reason. This turns the shadow "volume 1x" rule on for real, so the 16/11 review compares trades before and after this change.',
      'Telegram: "SL" meant quantity, not stop loss. Messages now say "Số lượng … cổ" and show the most you can lose and win on the trade. The "price did not move" exit explains it is the 3-hour limit.',
      'Notifications: "Show me" now also appears on the server pre-trade card, opens that stock and walks you through the trade (or the chart when there is no trade yet). The Neo pop-up stays 12 seconds instead of 7.',
    ],
    changesVi: [
      'Atlas giờ chia vốn theo rủi ro: mỗi lệnh nếu chạm cắt lỗ chỉ mất cỡ nhau (0.05% tài khoản, khoảng $5), nên quỹ $760 và cổ phiếu $10 không còn lỗ $0.94 so với $3.66. Cắt lỗ gần thì mua nhiều hơn (tối đa 5% tài khoản), cắt lỗ xa thì mua ít hơn.',
      'Atlas chỉ mua cổ phiếu qua bộ lọc chất lượng: giá từ $5, vốn hóa từ $300M (khi biết), giao dịch khoảng $26M/ngày, volume từ 1x bình thường và biểu đồ thật sự chạy (0.3% mỗi nến 15 phút). Cắt lỗ gần hơn 0.4% bị từ chối. Mỗi lần từ chối đều ghi lý do vào nhật ký quyết định. Luật chạy bóng "volume 1x" nay được bật thật, nên bài kiểm tra 16/11 sẽ so lệnh trước và sau thay đổi này.',
      'Telegram: "SL" là số lượng chứ không phải cắt lỗ. Tin nhắn giờ ghi "Số lượng … cổ" và cho biết tối đa lỗ và lãi bao nhiêu. Lý do thoát "giá không chạy" giờ nói rõ là hết 3 giờ.',
      'Thông báo: nút "Chỉ cho tôi" giờ có cả trên thẻ báo trước lệnh của máy chủ, mở đúng cổ phiếu và giải thích lệnh (hoặc biểu đồ nếu chưa có lệnh). Cửa sổ Neo ở lại 12 giây thay vì 7.',
    ],
  },
  {
    version: '2.0.7',
    date: '2026-11-02',
    changes: [
      'Atlas trade size: the Kelly multiplier is now never below half size. After a lucky run in the last 100 trades it had shrunk to x0.05, so each trade was only about $5 to $10 and proved nothing. Stops, targets and signals are unchanged.',
    ],
    changesVi: [
      'Cỡ lệnh Atlas: hệ số Kelly giờ không bao giờ thấp hơn một nửa cỡ. Sau chuỗi may mắn trong 100 lệnh gần nhất nó bị co còn x0.05 nên mỗi lệnh chỉ khoảng $5 đến $10, không chứng minh được gì. Cắt lỗ, chốt lời và tín hiệu giữ nguyên.',
    ],
  },
  {
    version: '2.0.6',
    date: '2026-11-02',
    changes: [
      'Idea factory: Opus\'s live signals now come only from rules that hold 5 days or less, so the first grades for "Opus self-made" arrive in about a week instead of after 20 trading days. Rules with longer holds stay in the research table.',
    ],
    changesVi: [
      'Xưởng ý tưởng: tín hiệu của Opus giờ chỉ lấy từ các luật giữ tối đa 5 ngày, nên "Opus tự nghĩ" có điểm đầu tiên sau khoảng một tuần thay vì phải chờ 20 phiên. Các luật giữ lâu hơn vẫn nằm trong bảng nghiên cứu.',
    ],
  },
  {
    version: '2.0.5',
    date: '2026-11-02',
    changes: [
      'Hub Atlas card redesigned on one grid (Chanh: too many uneven gaps). A head band (Atlas, status, Paper trading only, the thought), four equal tiles (days left to the 16/11 verdict, learner right, BUY calls, open trades), then two equal boxes with the same row shape: Kronos (6 biggest forecast moves as bars) and the six shadow tests with progress bars. Below, one box for the win rate of book vs Opus with each side\'s picks, then the council and the tools spread evenly. The account sits in the thought bubble at the top right. Nothing was removed.',
    ],
    changesVi: [
      'Thẻ Atlas trên Hub được thiết kế lại trên một lưới thống nhất (anh Chanh: nhiều khoảng trống không đều). Dải đầu (Atlas, trạng thái, Chỉ giao dịch tiền ảo, suy nghĩ), bốn ô bằng nhau (số ngày còn lại tới ngày chấm 16/11, tỉ lệ đúng, lệnh MUA, lệnh đang giữ), rồi hai ô bằng nhau cùng kiểu dòng: Kronos (6 mã dự báo biến động mạnh nhất, dạng thanh) và sáu bài kiểm tra chạy bóng có thanh tiến độ. Bên dưới là một ô tỉ lệ thắng Sách vở vs Opus kèm mã mỗi bên chọn, rồi hội đồng và các nút công cụ chia đều. Tài khoản nằm ở bong bóng suy nghĩ góc trên bên phải. Không bỏ phần nào.',
    ],
  },
  {
    version: '2.0.4',
    date: '2026-11-02',
    changes: [
      'Atlas lab audit (Atlas 1.2.4, lab only): the lab itself had a flaw. Its Deflated Sharpe (the "not just luck" check) measured luck with the spread between the few ideas of the same round, a different unit from the idea itself and random from round to round, and it counted ideas that never saw the same data (the 340 rules of the 15-minute lab, the factory rules that only saw the old years). Tested with a planted edge: before, a rule that makes +1% more per 5-day trade than random FAILED, and SPY itself scored 0.00. Now luck is measured the textbook way (a zero-edge Sharpe over the same number of days) and only ideas judged on the same recent years are counted (66 lab ideas + the rules that reached the vault). The planted +1% edge now passes 5/5 and pure noise 0/5. Re-scored: still nothing passes, but now for real reasons. Overnight winners DSR 0.39 to 0.89 (still lives on the 14 high-volatility names), ETF momentum 0.94 to 0.68 (it was too lenient before), insider 0.03 to 0.28 (p 0.07, too few trades), the factory finalists lose to random entry in the vault. New `npm run lab:audit`, public/lab-audit.json. Live trading unchanged.',
    ],
    changesVi: [
      'Kiểm tra lại phòng lab của Atlas (Atlas 1.2.4, chỉ nghiên cứu): chính phòng lab có lỗi. Phép thử Deflated Sharpe (kiểm tra "không phải ăn may") đo độ may rủi bằng độ chênh giữa vài ý tưởng trong cùng vòng, khác đơn vị với ý tưởng và thay đổi ngẫu nhiên giữa các vòng, lại còn đếm cả những ý tưởng không hề thi trên cùng dữ liệu (340 luật của lab 15 phút, các luật xưởng chỉ thấy dữ liệu cũ). Thử bằng lợi thế cài sẵn: trước đây một luật lời hơn ngẫu nhiên +1% mỗi lệnh 5 ngày vẫn TRƯỢT, và chính SPY bị chấm 0,00. Nay đo may rủi đúng sách (Sharpe của chuỗi không có lợi thế, cùng số ngày) và chỉ đếm các ý tưởng đã thi trên cùng những năm gần đây (66 ý tưởng lab + các luật vào két). Lợi thế +1% cài sẵn nay đạt 5/5, nhiễu thuần đạt 0/5. Chấm lại: vẫn chưa ý tưởng nào đạt, nhưng giờ là trượt thật. Qua đêm DSR 0,39 lên 0,89 (vẫn chỉ sống nhờ 14 mã biến động mạnh), momentum ETF 0,94 xuống 0,68 (trước đây chấm quá dễ), insider 0,03 lên 0,28 (p 0,07, quá ít lệnh), các luật chung kết của xưởng thua mua ngẫu nhiên trong két. Lệnh mới `npm run lab:audit`, public/lab-audit.json. Giao dịch thật không đổi.',
    ],
  },
  {
    version: '2.0.3',
    date: '2026-11-02',
    changes: [
      'Hub Atlas card, from Chanh\'s test on the Fold: the card now grows to fit everything (no more cut bottom, the page scrolls normally). Kronos takes one line of chips (the 5 biggest forecast moves; "See all" still opens the full bar list), and the freed space shows what Atlas is learning: the six shadow tests (L1-L4, volume, Kronos) with new trades collected of the 50 each needs, under the learning ring. Tap it to open the signal board.',
    ],
    changesVi: [
      'Thẻ Atlas trên Hub, theo lần anh Chanh thử trên Fold: thẻ giờ tự cao theo nội dung (hết bị cắt đáy, trang cuộn bình thường). Kronos thu còn một dòng nhãn (5 mã dự báo biến động mạnh nhất; "Xem tất cả" vẫn mở đủ danh sách thanh), chỗ trống dành cho phần Atlas đang học: sáu bài kiểm tra chạy bóng (L1-L4, khối lượng, Kronos) với số lệnh mới đã gom trên 50 lệnh mỗi bài cần, nằm dưới vòng tròn học. Bấm vào để mở bảng tín hiệu.',
    ],
  },
  {
    version: '2.0.2',
    date: '2026-11-02',
    changes: [
      'Atlas card on the Hub, tidier (Atlas 1.2.2): on a wide screen it is split in two. Kronos forecast bars sit on the left, with the 5 biggest moves (See all still shows every one). The right side shows the learning ring and 📚 Book vs 🧠 Opus self-made, with the stocks each side picks right now: Atlas\'s BUY calls (gain and Trade Score on hover) and the idea factory\'s picks. The agents row and the tool buttons stay on one line and scroll sideways, so the card is no longer cut off at the bottom. On a phone the same parts stack in one column.',
    ],
    changesVi: [
      'Thẻ Atlas trên Hub gọn hơn (Atlas 1.2.2): trên màn hình rộng, thẻ chia đôi. Bên trái là thanh dự báo Kronos, hiện 5 mã biến động mạnh nhất ("Xem tất cả" vẫn hiện đủ). Bên phải là vòng học và ô 📚 Sách vở vs 🧠 Opus tự nghĩ, kèm các mã mỗi bên đang chọn: lệnh MUA của Atlas (rê chuột để xem % tăng và Trade Score) và mã của xưởng ý tưởng. Hàng agent và các nút công cụ nằm trên một dòng, kéo ngang được, nên thẻ không còn bị cắt mất phần dưới. Trên điện thoại, các phần xếp thành một cột.',
    ],
  },
  {
    version: '2.0.1',
    date: '2026-11-02',
    changes: [
      'Atlas pre-open fix: the idea factory\'s nightly job was written with a broken line and GitHub refused to run it, so it never started. Fixed. The nightly Kronos and idea factory jobs now also start a site deploy after saving, because a save made by a job does not deploy by itself, so the new forecasts and signals reach the app and Atlas the same night.',
    ],
    changesVi: [
      'Sửa lỗi Atlas trước giờ mở cửa: việc chạy hằng đêm của xưởng ý tưởng bị viết sai một dòng nên GitHub không chạy nó, nó chưa từng chạy. Đã sửa. Hai việc chạy đêm (Kronos và xưởng ý tưởng) giờ còn tự cho đăng bản mới lên web sau khi lưu, vì lưu do việc tự động không tự đăng được; nhờ vậy dự báo và tín hiệu mới tới app và Atlas ngay trong đêm.',
    ],
  },
  {
    version: '2.0.0',
    date: '2026-11-02',
    changes: [
      'Atlas idea factory (Atlas 1.2): Atlas now invents its own trading rules instead of only textbook ones. Claude Opus wrote 30 seed ideas, each with a plain reason (exhausted sellers, quiet accumulation, strength while the market falls…). A genetic search then mixes and mutates them into hundreds of rules. Each rule learns on 2008-2017, must hold up on 2018-2022, and then faces a locked vault from 2023 that it never saw: it has to beat 200 random-entry draws at 1x and 2x costs, still work without the 14 wildest names, and pass a Deflated Sharpe that counts every idea ever tried (the trial counter is shown). The best rules are remembered for the next run. The factory\'s rules give their own signals from each close (buy at next open, sell after N days, stop). These signals are graded with real prices later, so the signal board and the Atlas card on the Hub show 📚 Book vs 🧠 Opus self-made win rates side by side. A signals-only update runs by itself after each US close and invents nothing new. "Run the factory" looks for new rules. Free (GitHub Actions + Yahoo), no Claude tokens, paper only, never trades. Off switch in Settings > AI rules.',
    ],
    changesVi: [
      'Xưởng ý tưởng của Atlas (Atlas 1.2): Atlas giờ tự nghĩ luật giao dịch thay vì chỉ học sách. Claude Opus viết 30 ý tưởng gốc, mỗi ý có lý do dễ hiểu (người bán đã cạn, gom âm thầm, mạnh khi thị trường rơi…). Máy lai tạo và đột biến chúng thành hàng trăm luật. Mỗi luật học trên 2008-2017, phải vẫn đứng trên 2018-2022, rồi vào thi trong "két khóa" từ 2023 mà nó chưa từng thấy. Ở đó nó phải thắng 200 lần mua ngẫu nhiên ở phí 1x và 2x, vẫn ổn khi bỏ 14 mã biến động mạnh nhất, và qua Deflated Sharpe tính mọi ý tưởng từng thử (có hiện bộ đếm lượt thử). Các luật tốt nhất được nhớ cho lần chạy sau. Luật của xưởng tự ra tín hiệu từ mỗi phiên đóng cửa (mua giá mở cửa sau, bán sau N ngày, cắt lỗ). Tín hiệu được chấm bằng giá thật sau đó, nên bảng tín hiệu và thẻ Atlas trên Hub hiện % thắng 📚 Sách vở và 🧠 Opus tự nghĩ cạnh nhau. Bản cập nhật tín hiệu tự chạy sau mỗi phiên Mỹ đóng cửa và không nghĩ luật mới. Nút "Chạy xưởng" thì tìm luật mới. Miễn phí (GitHub Actions + Yahoo), không tốn token Claude, chỉ giấy, không bao giờ trade. Nút tắt ở Cài đặt > Quy tắc AI.',
    ],
  },
  {
    version: '1.99.1',
    date: '2026-11-02',
    changes: [
      'Atlas short lab (round 6, lab only): can Atlas profit by selling short? Four ideas on 94 liquid stocks since 2007: fade a +7% spike on 2x volume, break-down to a 20-day low while SPY is below its 200-day average, the 10 worst 12-1 month names each month, and an overnight short of -3% days. Every idea has a hard stop and pays a borrow fee (1% a year, 8% for the 14 high-volatility names, doubled at 2x costs). Each is compared with 200 random shorts of the same names and years, and a Deflated Sharpe counts all 406 trials. Nothing passed: every idea lost money in the 2020-2026 exam, and 33-40% of the stops were hit. Kronos "forecast down" cannot be replayed (no forecast history). Manual workflow, public/replay-short.json. It never touches live trading.',
    ],
    changesVi: [
      'Phòng lab bán khống của Atlas (vòng 6, chỉ nghiên cứu): Atlas có kiếm được tiền khi bán khống không? Bốn ý tưởng trên 94 cổ phiếu thanh khoản cao từ 2007: bán khống cú tăng vọt 7% với volume gấp 2, phá đáy 20 ngày khi SPY dưới trung bình 200 ngày, 10 mã yếu nhất theo lợi nhuận 12-1 tháng mỗi tháng, và bán khống qua đêm các ngày giảm 3%. Mọi ý tưởng đều có cắt lỗ cứng và trả phí mượn cổ phiếu (1% một năm, 8% cho 14 mã biến động mạnh, gấp đôi ở phí 2x). Mỗi ý tưởng so với 200 lần bán khống ngẫu nhiên cùng mã cùng năm, và Deflated Sharpe tính cả 406 lần thử. Không ý tưởng nào đạt: cả bốn đều lỗ trong bài thi 2020-2026, và 33-40% lệnh bị cắt lỗ. Dự báo giảm của Kronos không thử lại được (không có lịch sử dự báo). Chạy tay, public/replay-short.json. Không bao giờ đụng giao dịch thật.',
    ],
  },
  {
    version: '1.99.0',
    date: '2026-11-02',
    changes: [
      'Atlas signal board, at the top of Atlas\'s page: one honest verdict ("Learning. No edge yet." with the real record), one big Refresh button that only reloads the numbers and deletes nothing, a learning ring and six progress bars toward the 16/11 review (L1-L4, the volume filter, Kronos: new trades collected of the 50 each needs), each signal Atlas really took with entry, target (TP), stop (SL) and the real win rate of that kind of signal in its own record (warned when under 30 trades), and why it traded or not on its last session. The Atlas card on the Hub shows the same verdict and ring; tap it to open the board. Display only: it never places, changes or blocks a trade. Off switch in Settings > AI rules.',
      'Hub Atlas card: the Kronos 5-day forecast is now a compact list of the 6 biggest moves with clear left/right bars ("See all" opens the full list), instead of a 20-symbol grid of tiny bars that overflowed the card.',
    ],
    changesVi: [
      'Bảng tín hiệu Atlas, ở đầu trang Atlas: một kết luận thật ("Đang học. Chưa có lợi thế." kèm số liệu thật), một nút lớn Làm mới chỉ tải số mới và không xóa gì, vòng tròn học và sáu thanh tiến độ tới lần chấm điểm 16/11 (L1-L4, lọc khối lượng, Kronos: đã gom bao nhiêu lệnh mới trên 50 lệnh mỗi bài cần), mỗi tín hiệu Atlas thật sự vào có giá vào, chốt lời (TP), cắt lỗ (SL) và % thắng thật của loại tín hiệu đó trong lịch sử của Atlas (cảnh báo khi dưới 30 lệnh), và lý do vào lệnh hay không ở phiên gần nhất. Thẻ Atlas trên Hub hiện cùng kết luận và vòng tròn; bấm vào để mở bảng. Chỉ hiển thị: không bao giờ đặt, đổi hay chặn lệnh. Có công tắc tắt trong Cài đặt > Quy tắc AI.',
      'Thẻ Atlas trên Hub: Kronos dự báo 5 phiên giờ là danh sách gọn 6 mã biến động lớn nhất với thanh trái/phải rõ ràng ("Xem tất cả" mở đủ danh sách), thay cho lưới 20 mã với thanh tí hon bị tràn khỏi thẻ.',
    ],
  },
  {
    version: '1.98.2',
    date: '2026-11-02',
    changes: [
      'Atlas sizing: when the last 100 closed trades show no edge (Kelly fraction at or below 0, at least 30 trades), new trades are sized at half instead of full. Before, a losing run kept full size. Size returns to normal as soon as the last 100 trades show an edge again. The Kelly status in atlas-status and Telegram now shows the real multiplier (size x0.50). Stops, targets, signals and the volatility halving are unchanged.',
    ],
    changesVi: [
      'Atlas chỉnh cỡ lệnh: khi 100 lệnh đã đóng gần nhất không có lợi thế (hệ số Kelly từ 0 trở xuống, tối thiểu 30 lệnh), lệnh mới vào bằng một nửa cỡ thay vì cỡ đầy đủ. Trước đây chuỗi thua vẫn giữ cỡ đầy đủ. Cỡ trở lại bình thường ngay khi 100 lệnh gần nhất có lợi thế. Trạng thái Kelly trong atlas-status và Telegram giờ hiện hệ số thật (size x0.50). Cắt lỗ, chốt lời, tín hiệu và việc giảm nửa khi biến động cao giữ nguyên.',
    ],
  },
  {
    version: '1.98.1',
    date: '2026-11-02',
    changes: [
      'Atlas momentum lab (round 5, lab only): 12-1 month cross-sectional momentum, rebalanced monthly, on 96 liquid stocks and 41 ETFs, with and without a trend filter (SPY above its 200-day average). Each idea is compared with 200 random-pick draws on the same dates and costs (1x and 2x), and a Deflated Sharpe that counts all 402 trials of every round. A stock result only counts when its ETF twin also passes, because the stock list is survivor-biased. Manual workflow, public/replay-momentum.json. It never touches live trading.',
    ],
    changesVi: [
      'Phòng lab động lượng của Atlas (vòng 5, chỉ nghiên cứu): động lượng chéo 12-1 tháng, đổi danh mục mỗi tháng, trên 96 cổ phiếu thanh khoản cao và 41 ETF, có và không có bộ lọc xu hướng (SPY trên trung bình 200 ngày). Mỗi ý tưởng so với 200 lần chọn mã ngẫu nhiên cùng ngày và cùng phí (1x và 2x), cùng Deflated Sharpe tính cả 402 lần thử của mọi vòng. Kết quả trên cổ phiếu chỉ tính khi bản ETF song sinh cũng đạt, vì danh sách cổ phiếu thiên lệch người sống sót. Chạy tay, public/replay-momentum.json. Không bao giờ đụng giao dịch thật.',
    ],
  },
  {
    version: '1.98.0',
    date: '2026-11-02',
    changes: [
      'Atlas shadow lead L4, overnight winners (the strongest lead of the round-4 edge sweep): after each close, every universe name that closed 3%+ up on at least 2x its 20-day average volume gets a $1,000 shadow buy at that close, sold at the next open. One Alpaca daily-bar request a day with the hub\'s Alpaca paper key. The 14 high-volatility names the lab found the edge depends on are reported separately. It shows in the atlas-status shadowLeads field and as a fourth 🧪 line in the daily Telegram summary. Record only: it never places, changes, blocks or closes a real paper trade. Same AI rules switch as the other shadow leads.',
    ],
    changesVi: [
      'Atlas chạy bóng hướng L4, mua cổ phiếu thắng giữ qua đêm (manh mối mạnh nhất của vòng rà rộng lợi thế thứ 4): sau mỗi phiên, mã nào trong danh sách đóng cửa tăng từ 3% với khối lượng từ 2 lần trung bình 20 ngày thì được ghi một lệnh mua bóng $1,000 ở giá đóng cửa, bán ở giá mở cửa hôm sau. Mỗi ngày một yêu cầu nến ngày tới Alpaca bằng khóa Alpaca paper của hub. 14 mã biến động mạnh mà phòng lab thấy lợi thế phụ thuộc vào được báo riêng. Kết quả hiện ở trường shadowLeads của atlas-status và thành dòng 🧪 thứ tư trong tổng kết Telegram hằng ngày. Chỉ ghi lại: không bao giờ đặt, đổi, chặn hay đóng lệnh giả lập thật. Dùng chung công tắc AI rules với các hướng chạy bóng khác.',
    ],
  },
  {
    version: '1.97.0',
    date: '2026-11-02',
    changes: [
      'Atlas: the Kronos 5-day forecast no longer sticks to 8 fixed symbols. Each evening it forecasts Atlas\'s built-in watchlist (now with SOL and BNB) plus the stocks Atlas is trading right now (open positions and the last 5 days of trades), up to 20 symbols, and the Atlas card shows all of them and drops symbols that left the list. Tickers added only in your own browser are not visible to the evening job.',
      'New shadow test "Kronos objects" (record only, never blocks a trade): every buy is tagged with whether Kronos\'s 5-day forecast for that symbol was a drop of 1% or more. The daily Telegram summary compares the buys it objected to with the rest. Off switch: Settings > AI rules.',
    ],
    changesVi: [
      'Atlas: dự báo 5 phiên của Kronos không còn kẹt ở 8 mã cố định. Mỗi tối nó dự báo watchlist có sẵn của Atlas (thêm SOL và BNB) cộng các cổ phiếu Atlas đang giao dịch (lệnh đang mở và 5 ngày gần nhất), tối đa 20 mã. Thẻ Atlas hiện đủ các mã và bỏ mã đã rời danh sách. Mã anh thêm riêng trong trình duyệt thì job buổi tối chưa thấy được.',
      'Chạy bóng mới "Kronos phản đối" (chỉ ghi, không chặn lệnh): mỗi lệnh mua được ghi lại xem dự báo 5 phiên của Kronos cho mã đó có giảm từ 1% trở lên không. Tin Telegram cuối ngày so các lệnh bị phản đối với phần còn lại. Công tắc tắt: Cài đặt > Luật AI.',
    ],
  },
  {
    version: '1.96.2',
    date: '2026-11-02',
    changes: [
      'Atlas edge sweep, round 4: nine published ideas on free data since 2007. FOMC pre-announcement drift, turn of the month, options-expiration week, a VIX/VIX3M term-structure switch, an HYG credit switch, eight sector pairs, SEC insider buying clusters (when an SEC contact is configured), the Cboe PUT and BXM option-selling indexes, and daily overnight winners. Each is compared with a random-entry control (or, for switches, the same signal shifted in time), at per-symbol costs 1x and 2x, with a Deflated Sharpe that counts all 398 variants tried in every round. Risk-parity portfolios of the survivors and of all sleeves are reported too. Manual workflow. Paper only, no change to live trading.',
    ],
    changesVi: [
      'Rà rộng lợi thế của Atlas, vòng 4: chín ý tưởng đã công bố trên dữ liệu miễn phí từ 2007. Giá tăng trước khi Fed công bố, đầu tháng, tuần đáo hạn quyền chọn, công tắc theo cấu trúc kỳ hạn VIX/VIX3M, công tắc theo trái phiếu HYG, tám cặp cổ phiếu cùng ngành, lãnh đạo mua cổ phiếu theo SEC (khi có liên hệ SEC), chỉ số bán quyền chọn PUT và BXM của Cboe, và mua cổ phiếu thắng giữ qua đêm. Mỗi cái được so với nhóm vào lệnh ngẫu nhiên (với công tắc là cùng tín hiệu dịch thời gian), phí theo từng mã ở 1x và 2x, với Deflated Sharpe tính cả 398 biến thể đã thử ở mọi vòng. Có thêm danh mục chia vốn theo rủi ro của các ý tưởng sống sót và của tất cả. Workflow chạy tay. Chỉ giao dịch giả lập, không đổi giao dịch thật.',
    ],
  },
  {
    version: '1.96.1',
    date: '2026-11-02',
    changes: [
      'Atlas news lab, round 4: does "big moves with no news reverse, moves with news continue" (Chan 2003) hold for our leads? D1 short-term reversal (plain and VIX-gated), intraday winners held overnight and all big daily movers (4%+) are each split by whether the stock had a news item in the window, using only Alpaca news timestamps and symbols (never headline text). Each side is compared with 200 random-entry draws from the same symbols and the same news bucket, at per-symbol costs 1x and 2x, with a Deflated Sharpe over all 42 variants tried, and the no-news vs news difference gets a permutation test. Manual workflow (needs the Alpaca repo secrets; without them it does nothing). Paper only, no change to live trading.',
    ],
    changesVi: [
      'Phòng lab tin tức của Atlas, vòng 4: giả thuyết "biến động mạnh không có tin thì đảo chiều, có tin thì tiếp diễn" (Chan 2003) có đúng với các hướng của ta không? D1 đảo chiều ngắn hạn (thường và có cổng VIX), cổ phiếu thắng trong ngày giữ qua đêm và mọi cổ phiếu biến động mạnh trong ngày (từ 4%) đều được chia theo việc mã đó có tin trong khoảng thời gian xét hay không, chỉ dùng thời điểm và mã của tin Alpaca (không dùng nội dung tiêu đề). Mỗi nhóm được so với 200 lần vào lệnh ngẫu nhiên cùng mã và cùng nhóm tin, phí theo từng mã ở 1x và 2x, với Deflated Sharpe trên cả 42 biến thể đã thử, và chênh lệch không tin so với có tin có thêm kiểm định hoán vị. Workflow chạy tay (cần secrets Alpaca của repo; thiếu thì không làm gì). Chỉ giao dịch giả lập, không đổi giao dịch thật.',
    ],
  },
  {
    version: '1.96.0',
    date: '2026-11-02',
    changes: [
      'Atlas shadow leads: the three leads the replay labs found now run record-only inside the existing Worker cron, once per trading day after the close. L1 reversal + VIX gate (bottom 10% by 5-day return when the VIX is at or above its 1-year median, $1,000 per shadow trade, in at the next open, out at the close of day 5). L2 hold winners overnight (Atlas own before-close exits that were up 1%+, re-priced as if sold at the next session open, compared with what Atlas really got). L3 ETF trend core (23 ETFs, 12-month return skipping the last month, rebalanced on the first run of each month, from $10,000, against SPY buy-and-hold). Results show in the atlas-status shadowLeads field and as three short lines under the daily Telegram summary. They never place, change, block or close a real paper trade. New AI rules switch (on by default).',
    ],
    changesVi: [
      'Atlas chạy bóng ba hướng: ba hướng mà phòng lab replay tìm ra giờ chạy chỉ-ghi-lại trong cron Worker hiện có, mỗi ngày giao dịch một lần sau giờ đóng cửa. L1 đảo chiều + cổng VIX (10% giảm mạnh nhất 5 ngày khi VIX từ trung vị 1 năm trở lên, $1,000 mỗi lệnh bóng, vào ở giá mở cửa kế tiếp, ra ở giá đóng cửa ngày thứ 5). L2 giữ cổ phiếu thắng qua đêm (các lệnh Atlas thoát trước giờ đóng cửa đang lãi từ 1% trở lên, tính lại như thể bán ở giá mở cửa phiên sau, so với kết quả thật của Atlas). L3 lõi ETF theo xu hướng (23 ETF, lợi nhuận 12 tháng bỏ qua tháng gần nhất, cân bằng lại ở lần chạy đầu mỗi tháng, từ $10,000, so với giữ SPY). Kết quả hiện ở trường shadowLeads của atlas-status và thành ba dòng ngắn dưới tổng kết Telegram hằng ngày. Không bao giờ đặt, đổi, chặn hay đóng lệnh giả lập thật. Có công tắc mới trong AI rules (mặc định bật).',
    ],
  },
  {
    version: '1.95.2',
    date: '2026-11-01',
    changes: [
      'Atlas lab round 3, day trading: three published ideas tested on free 5-minute and 60-minute bars with per-symbol costs (spread by liquidity tier, 1 bp slippage, no fee) and limit entries. I1 opening-range breakout on stocks in play, I2 first-half-hour to last-half-hour momentum on SPY/QQQ, I3 overnight vs intraday returns and holding strong winners overnight. Each is compared with 200 random-entry draws, at the old flat costs and 2x, with a Deflated Sharpe over all 28 variants tried so far. Manual workflow; uses Alpaca data if its keys are set. Paper only, no change to live trading.',
    ],
    changesVi: [
      'Phòng lab Atlas vòng 3, day trading: ba ý tưởng đã công bố được thử trên nến 5 phút và 60 phút miễn phí với chi phí theo từng mã (spread theo nhóm thanh khoản, trượt giá 1 bp, không phí) và lệnh giới hạn. I1 phá vỡ vùng mở cửa với cổ phiếu nóng, I2 động lượng nửa giờ đầu sang nửa giờ cuối trên SPY/QQQ, I3 lợi nhuận qua đêm so với trong ngày và giữ cổ phiếu thắng qua đêm. Mỗi cái so với 200 lần vào lệnh ngẫu nhiên, ở chi phí phẳng cũ và gấp đôi, với Deflated Sharpe trên cả 28 biến thể đã thử. Workflow chạy tay; dùng dữ liệu Alpaca nếu có khóa. Chỉ giao dịch giả lập, không đổi giao dịch thật.',
    ],
  },
  {
    version: '1.95.1',
    date: '2026-11-01',
    changes: [
      'Atlas daily replay lab, round 2: five follow-ups on the one idea that beat its random-entry control (short-term reversal). E1 trades it only when the VIX is high (above its 1-year median, or 25+). E2 hedges each trade with SPY over the same dates. E3 tests ETF time-series momentum on 23 ETFs against SPY and 60/40. E4 sizes trades by SPY volatility. E5 tests adding to winning or losing positions. All use next-open fills, 1x and 2x costs, the same book/exam split, and a luck check that counts all 14 variants tried. Results in the new round2 section of replay-daily.json.',
    ],
    changesVi: [
      'Phòng lab replay theo ngày của Atlas, vòng 2: năm thử nghiệm tiếp theo cho ý tưởng duy nhất thắng nhóm đối chứng ngẫu nhiên (đảo chiều ngắn hạn). E1 chỉ vào lệnh khi VIX cao (trên trung vị 1 năm, hoặc từ 25). E2 phòng hộ mỗi lệnh bằng SPY trong cùng khoảng ngày. E3 thử động lượng chuỗi thời gian trên 23 ETF so với SPY và 60/40. E4 chỉnh cỡ lệnh theo biến động của SPY. E5 thử mua thêm khi lệnh đang lãi hoặc đang lỗ. Tất cả vào lệnh ở giá mở cửa kế tiếp, phí 1x và 2x, cùng cách chia book/exam, và bài kiểm tra "đúng do may" tính cả 14 biến thể đã thử. Kết quả nằm ở phần round2 của replay-daily.json.',
    ],
  },
  {
    version: '1.95.0',
    date: '2026-11-01',
    changes: [
      'Atlas daily replay lab: the 15-minute lab showed a round trip costs about 0.1%, as much as an average 15-minute move, so this one tests swing strategies (days to weeks) on free Yahoo daily bars since 2010. Four published ideas (short-term reversal, 52-week-high momentum, RSI(2) trend pullback, a gap-and-volume event-drift proxy) enter at the next open, use the same costs, and are judged on the newest third at 1x and 2x costs with the luck check. Each is compared with 200 random-entry runs (same symbols, counts, exits, costs) so raw return in a rising market is not mistaken for edge; SPY buy-and-hold is shown next to them. The name list is today\'s liquid stocks, so results are flattered by survivorship. Run it from GitHub Actions ("Atlas daily replay lab"); results in replay-daily.json.',
    ],
    changesVi: [
      'Phòng lab replay theo ngày cho Atlas: lab 15 phút cho thấy một vòng mua bán tốn khoảng 0,1%, bằng cả một nhịp 15 phút trung bình, nên lab này thử các chiến lược swing (vài ngày đến vài tuần) trên dữ liệu ngày miễn phí của Yahoo từ 2010. Bốn ý tưởng đã công bố (đảo chiều ngắn hạn, động lượng đỉnh 52 tuần, hồi RSI(2) trong xu hướng tăng, ước lượng xu hướng sau tin bằng gap và khối lượng) vào lệnh ở giá mở cửa kế tiếp, cùng mức phí, và được chấm trên 1/3 mới nhất với phí 1x và 2x cùng bài kiểm tra "đúng do may". Mỗi chiến lược còn được so với 200 lần vào lệnh ngẫu nhiên (cùng mã, số lệnh, cách thoát, phí) để không nhầm lợi nhuận thô của thị trường tăng với lợi thế thật. Có thêm SPY mua và giữ để so. Danh sách mã là các mã thanh khoản hôm nay nên kết quả bị tô hồng do thiên lệch người sống sót. Chạy trong GitHub Actions ("Atlas daily replay lab"); kết quả nằm ở replay-daily.json.',
    ],
  },
  {
    version: '1.94.0',
    date: '2026-11-01',
    changes: [
      'Atlas replay lab now also tests whole strategies, not just filters: Atlas held to the close, Atlas with ATR stops, last-half-hour momentum (Gao et al. 2018) and an intraday bounce after a 2%+ drop. Each is judged on the same unseen days and luck check. First run: none beats Atlas on unseen days after costs.',
    ],
    changesVi: [
      'Phòng lab replay của Atlas giờ thi cả chiến lược chứ không chỉ luật lọc. Bốn chiến lược: Atlas giữ lệnh đến cuối phiên, Atlas đặt stop theo ATR, động lượng nửa giờ cuối (Gao et al. 2018), và mua bật lại sau khi giảm 2%+ trong ngày. Mỗi chiến lược được chấm trên cùng những ngày chưa thấy và qua cùng bài kiểm tra "đúng do may". Lần chạy đầu: sau khi trừ phí, chưa chiến lược nào thắng Atlas trên những ngày chưa thấy.',
    ],
  },
  {
    version: '1.93.0',
    date: '2026-11-01',
    changes: [
      'Atlas replay lab: learns from old data instead of waiting for trading days. It replays Atlas bar by bar on the last 60 days of free 15-minute data (107 stocks and crypto, same code and costs as live), searches simple filter rules on the older two thirds, and keeps only rules that also win on the newest third and pass a luck check for how many rules were tried. Run it from GitHub Actions ("Atlas replay lab"); results in replay-lab.json.',
    ],
    changesVi: [
      'Phòng thí nghiệm replay cho Atlas: học trên dữ liệu cũ thay vì chờ ngày giao dịch. Atlas được chạy lại từng cây nến trên 60 ngày dữ liệu 15 phút miễn phí (107 cổ phiếu và crypto, cùng code và phí như bản live). Máy dò luật lọc trên 2/3 thời gian cũ hơn, rồi chỉ giữ luật nào cũng thắng trên 1/3 mới nhất và qua được bài kiểm tra "đúng do may" (tính theo số luật đã thử). Chạy trong GitHub Actions ("Atlas replay lab"); kết quả nằm ở replay-lab.json.',
    ],
  },
  {
    version: '1.92.0',
    date: '2026-11-01',
    changes: [
      'Lumi starts listening around and translating as soon as you open it (a switch turns this off; Stop is always there). Faster captions: a sentence is translated as soon as the words stop changing (about 0.65 s) instead of waiting for the phone to decide the sentence ended, the draft line updates every 2 words, the server is woken up when Lumi opens, and the backup recordings are cut at shorter pauses (max 6 s). Listening pauses on the Two-way tab so the two do not fight over the microphone.',
    ],
    changesVi: [
      'Mở Lumi là tự bật nghe xung quanh và dịch luôn (có nút tắt chế độ này, nút Dừng luôn ở đó). Chữ dịch nhanh hơn: chữ ngừng thay đổi khoảng 0.65 giây là dịch câu đó ngay, không chờ điện thoại tự quyết câu đã hết; dòng dịch nháp cập nhật mỗi 2 từ; máy chủ được đánh thức sẵn khi mở Lumi; đoạn ghi âm dự phòng cắt ở chỗ ngừng ngắn hơn (tối đa 6 giây). Sang tab Hai chiều thì tạm dừng nghe để không giành micro.',
    ],
  },
  {
    version: '1.91.0',
    date: '2026-11-01',
    changes: [
      'Atlas test run ("shadow"): three rules found in the 314-trade check are now recorded on every new trade but do not change any trade yet: buy only when volume is at least normal, no day trades from the watchlist, and what the learner would say. The daily Telegram summary and the status page show whether the trades these rules would skip really lose money, so you can decide to switch them on.',
      'Atlas learner now gets real data: the server learner never had any (nothing saved its journal), so it now reads the journal the 24/7 learning job publishes. It still only labels trades and never blocks one.',
    ],
    changesVi: [
      'Atlas chạy bóng: 3 luật tìm được từ đợt mổ xẻ 314 lệnh giờ được ghi lại trên mỗi lệnh mới, nhưng chưa thay đổi lệnh nào. Ba luật đó là: chỉ mua khi khối lượng giao dịch từ mức bình thường trở lên, không lấy lệnh trong ngày từ danh sách theo dõi, và ghi lại ý kiến của bộ học. Bản tổng kết Telegram hằng ngày và trang trạng thái sẽ cho thấy những lệnh bị các luật này bỏ đi có thật sự lỗ không, để anh quyết định bật.',
      'Bộ học của Atlas giờ có dữ liệu thật: trước đây bộ học trên server chưa từng có dữ liệu (không có chỗ nào lưu nhật ký), nay nó đọc nhật ký mà tác vụ học 24/7 xuất ra. Bộ học vẫn chỉ gắn nhãn cho lệnh, không chặn lệnh nào.',
    ],
  },
  {
    version: '1.90.2',
    date: '2026-11-01',
    changes: [
      'Safety fix for the Atlas data backup: it no longer saves any key, token or uploaded Nova video/image, keeps only the newest backup (older ones are deleted), and keeps it for 7 days.',
    ],
    changesVi: [
      'Sửa an toàn cho bản sao lưu dữ liệu Atlas: không còn lưu bất kỳ key, token hay video/ảnh Nova đã tải lên, chỉ giữ bản mới nhất (bản cũ bị xoá), và giữ trong 7 ngày.',
    ],
  },
  {
    version: '1.90.1',
    date: '2026-11-01',
    changes: [
      'Fixed: the daily Atlas data backup said "success" but saved nothing, because it used an old command. It now really saves Atlas\'s practice account (all trades) every day, fails loudly if it cannot, never saves tokens or keys, and keeps each day\'s copy on its own backups branch.',
    ],
    changesVi: [
      'Sửa lỗi: bản sao lưu dữ liệu Atlas hằng ngày báo "thành công" nhưng không lưu gì, vì dùng lệnh cũ. Giờ nó lưu thật tài khoản tập của Atlas (toàn bộ lệnh) mỗi ngày, báo lỗi rõ nếu không lưu được, không bao giờ lưu token hay key, và giữ bản của từng ngày trên nhánh backups riêng.',
    ],
  },
  {
    version: '1.90.0',
    date: '2026-11-01',
    changes: [
      'Fixed: Chrome said "This app cannot be installed". The app\'s install file sat behind the login gate and Chrome could not read it, so it showed a plain "W" icon. The app is now installable as "Neo Hub" with its own icon (including a round-safe icon for Android). Tap the Chrome menu, then Install app.',
    ],
    changesVi: [
      'Sửa lỗi: Chrome báo "Không thể cài đặt ứng dụng". Tệp cài đặt của app nằm sau cổng đăng nhập nên Chrome không đọc được, nên chỉ hiện biểu tượng chữ "W". Giờ app cài được với tên "Neo Hub" và biểu tượng riêng (có cả biểu tượng bo tròn cho Android). Mở menu Chrome, chọn Cài đặt ứng dụng.',
    ],
  },
  {
    version: '1.89.0',
    date: '2026-11-01',
    changes: [
      'Lumi live translation is now much faster. Words appear on screen while the person is still talking, a draft Vietnamese line follows them, and the final Vietnamese shows about 1 second after each sentence (was 6-10 seconds). Each line shows how long it took. Recording now cuts at the speaker\'s natural pause instead of every 6 seconds, translation uses the previous sentences as context, and a fast free translation model is tried first. New: pick the language they speak (or Auto), a "They are talking about" line, and in Talk mode suggested replies you can tap to have read out. If the browser has no instant captions, Lumi falls back to the previous mode.',
    ],
    changesVi: [
      'Lumi dịch trực tiếp nhanh hơn nhiều. Chữ hiện ngay khi người ta còn đang nói, kèm bản dịch nháp chạy theo, bản tiếng Việt chính thức hiện khoảng 1 giây sau mỗi câu (trước đây 6-10 giây). Mỗi câu hiện thời gian dịch. Ghi âm giờ cắt đúng chỗ người nói ngừng thay vì cứ 6 giây, dịch có dựa vào mấy câu trước cho đúng ý, và dùng model dịch nhanh miễn phí trước. Mới: chọn tiếng họ nói (hoặc Tự nhận), dòng "Đang nói về", và ở chế độ "Nói với em" có gợi ý câu trả lời, chạm là máy đọc lên. Trình duyệt nào không có chữ tức thì thì Lumi tự dùng chế độ cũ.',
    ],
  },
  {
    version: '1.88.0',
    date: '2026-11-01',
    changes: [
      'Nexus pocket scout now does the things it promised, all listening only. One big "Check this room" button listens for about 30 seconds and gives a plain verdict (Nothing obvious / Worth a look / Suspicious) with a "Details" list of possible hidden cameras (camera-style network names and makers) and Bluetooth trackers (AirTag, Tile, SmartTag). A hot / cold finder walks you to a flagged device by signal strength. Fixed: Bluetooth devices always showed 0 because half-finished scans were displayed. New "Switch to Echo" button opens the RuView flashing steps in one tap. Every card (Pocket scout, Volt steps and What\'s new) now has a short "what is here / what to do / what to tap" guide. Re-flash the board from Volt (Nexus Scout) to get the new firmware 1.1.0.',
    ],
    changesVi: [
      'Nexus (thiết bị bỏ túi) giờ làm đúng những gì đã hứa, tất cả chỉ lắng nghe. Một nút to "Kiểm tra phòng này" nghe khoảng 30 giây rồi đưa ra kết luận đơn giản (Chưa thấy gì đáng ngờ / Cần xem lại / Đáng ngờ), kèm danh sách "Chi tiết" về camera ẩn có thể có (tên mạng và hãng kiểu camera) và thiết bị theo dõi Bluetooth (AirTag, Tile, SmartTag). Có thêm dò nóng/lạnh để tìm đúng thiết bị bị báo theo độ mạnh tín hiệu. Sửa lỗi: số thiết bị Bluetooth luôn bằng 0 vì app hiện lần quét chưa xong. Nút "Chuyển sang Echo" mở sẵn các bước nạp RuView chỉ với một chạm. Mọi thẻ (Thiết bị bỏ túi, các bước của Volt và Mới cập nhật) đều có khung hướng dẫn ngắn "có gì / làm gì / bấm gì". Cần nạp lại bo từ Volt (Nexus Scout) để có firmware 1.1.0 mới.',
    ],
  },
  {
    version: '1.87.0',
    date: '2026-11-01',
    changes: [
      'Fixed: Lumi listened but showed nothing. Only the first recording piece was a readable audio file, so speech recognition failed on every piece after it, and errors were hidden. Now each 6-second piece is a complete file, and a "Live translation" list shows every sentence translated into Vietnamese as it is heard, from any language, with the original underneath. Problems (no Groq key, out of free quota, network) are shown on screen.',
    ],
    changesVi: [
      'Sửa lỗi: Lumi đang nghe mà không hiện gì. Chỉ đoạn ghi âm đầu tiên là file đọc được, các đoạn sau nhận giọng nói đều lỗi mà không báo. Giờ mỗi đoạn 6 giây là một file hoàn chỉnh, và khung "Dịch trực tiếp" hiện từng câu dịch sang tiếng Việt ngay khi nghe, từ bất kỳ thứ tiếng nào, kèm câu gốc bên dưới. Lỗi (thiếu key Groq, hết lượt miễn phí, mất mạng) hiện lên màn hình.',
    ],
  },
  {
    version: '1.86.0',
    date: '2026-11-01',
    changes: [
      'Home cards brought up to date: Volt, Nexus, Echo and Lumi now show their own version (v1.3.0, v1.2.0, v1.1.0, v1.2.0). Echo shows Room watch (USB) instead of "Beta" and no longer says it needs the home PC when this browser can use USB. Nexus shows its Pocket scout (USB/BLE). Lumi no longer says "Media Lab: Coming soon" and shows its tabs and languages. Volt shows its own version instead of RuView\'s firmware number.',
    ],
    changesVi: [
      'Các thẻ ngoài trang chủ đã cập nhật: Volt, Nexus, Echo và Lumi hiện version riêng (v1.3.0, v1.2.0, v1.1.0, v1.2.0). Echo hiện Canh phòng (USB) thay cho "Beta" và không còn báo cần máy nhà khi trình duyệt dùng được USB. Nexus hiện Quét bỏ túi (USB/BLE). Lumi hết báo "Media Lab: Sắp có" và hiện số tab, số ngôn ngữ. Volt hiện version của chính nó thay cho số firmware RuView.',
    ],
  },
  {
    version: '1.85.0',
    date: '2026-11-01',
    changes: [
      'Lumi Menu tab: take a photo of a menu or sign; the free AI (Gemini, or Groq as backup) reads it and explains each dish in Vietnamese with a short note and the price in VND. The photo is never stored.',
      'Lumi scam alerts: while listening, a conversation that looks like a common tourist scam or overcharge gets a red warning. The Etiquette tab also lists the usual scams per country.',
      'Lumi Trip notes tab: your saved trips grouped by day, with Copy and Share as plain text.',
    ],
    changesVi: [
      'Lumi tab Chụp menu: chụp ảnh thực đơn hoặc biển báo, AI miễn phí (Gemini, dự phòng Groq) đọc và giải thích từng món bằng tiếng Việt kèm ghi chú ngắn và giá ra VND. Không lưu ảnh.',
      'Lumi cảnh báo lừa đảo: khi đang nghe, cuộc trò chuyện có dấu hiệu chiêu lừa khách du lịch hoặc chặt chém sẽ hiện cảnh báo đỏ. Tab Văn hóa cũng liệt kê các chiêu lừa hay gặp theo từng nước.',
      'Lumi tab Sổ tay: các chuyến đã lưu gom theo ngày, có nút Chép và Chia sẻ dạng chữ.',
    ],
  },
  {
    version: '1.84.0',
    date: '2026-11-01',
    changes: [
      'Volt: new "What\'s new" card. Tap Refresh to look on GitHub (free, nothing runs in the background) for new ESP32 firmware releases; each one shows its chip and a one-tap "Use" button. Attack tools are filtered out. Recently flashed firmware is remembered.',
      'Each agent page now shows its own version next to its name (Volt, Nexus, Echo, Lumi), so you can see which agent changed.',
    ],
    changesVi: [
      'Volt: thêm khung "Mới cập nhật". Bấm Làm mới để tìm trên GitHub (miễn phí, không chạy nền) các bản firmware ESP32 mới; mỗi cái hiện chip và nút "Dùng" một chạm. Đã lọc bỏ công cụ tấn công. Firmware vừa nạp được nhớ lại.',
      'Mỗi trang agent giờ hiện phiên bản riêng cạnh tên (Volt, Nexus, Echo, Lumi), để thấy agent nào vừa đổi.',
    ],
  },
  {
    version: '1.83.0',
    date: '2026-11-01',
    changes: [
      'Lumi has a new look for its travel-translator job: earbud, phone and A/文 speech bubbles instead of the old camera and beret, and a speech-bubble logo.',
      'Lumi travel tools, in tabs beside Listen: Two-way (each side taps and speaks one sentence; the phone shows the translation big and reads it aloud), Phrases (16 common travel sentences in 7 languages, works offline, tap to show big and speak), Money (amount to VND with free daily rates kept on the phone; prices heard in conversations get a VND chip), Words (keep any translation and quiz yourself), Etiquette (tipping and manners tips per country). Off switch in Settings > AI rules.',
    ],
    changesVi: [
      'Lumi có diện mạo mới hợp với việc phiên dịch du lịch: tai nghe, điện thoại và bong bóng thoại A/文 thay cho máy ảnh và mũ beret, logo là hai bong bóng thoại.',
      'Công cụ du lịch của Lumi, nằm ở các tab cạnh Nghe: Hai chiều (mỗi bên bấm và nói một câu, máy hiện bản dịch thật to và đọc lên), Câu nói sẵn (16 câu hay dùng khi du lịch, 7 thứ tiếng, dùng được khi mất mạng), Đổi tiền (ra VND theo tỷ giá miễn phí lưu sẵn trên máy, giá nghe được trong cuộc trò chuyện cũng hiện ra VND), Từ vựng (lưu câu đã dịch và ôn tập), Văn hóa (mẹo tip và phép lịch sự từng nước). Có nút tắt trong Cài đặt > Luật AI.',
    ],
  },
  {
    version: '1.82.2',
    date: '2026-11-01',
    changes: ['Fixed: Volt thought a correct ESP32-S3 firmware was for a plain ESP32 and locked the Flash button. It now reads the chip type from the right place in the file.'],
    changesVi: ['Sửa lỗi: Volt tưởng firmware ESP32-S3 đúng là của ESP32 thường nên khóa nút Flash. Giờ đọc loại chip đúng chỗ trong file.'],
  },
  {
    version: '1.82.1',
    date: '2026-11-01',
    changes: ['Fixed: Volt\'s "Find firmware in this repo" failed with GitHub error 403. It now falls back to the public release page.'],
    changesVi: ['Sửa lỗi: nút "Tìm firmware trong repo" của Volt báo lỗi GitHub 403. Giờ tự chuyển sang trang release công khai.'],
  },
  {
    version: '1.82.0',
    date: '2026-11-01',
    changes: ['Volt: a "Nexus Scout" quick-pick button fills the repo and release for you. The nexus-scout release now ships one merged ESP32-S3 image plus a manifest, so Volt flashes it in one step.'],
    changesVi: ['Volt: nút chọn nhanh "Nexus Scout" tự điền repo và release. Bản release nexus-scout giờ có một ảnh ESP32-S3 gộp sẵn kèm manifest, Volt nạp một bước.'],
  },
  {
    version: '1.81.0',
    date: '2026-11-01',
    changes: ['Nexus: the Pocket scout card can connect over USB (Web Serial) as well as Bluetooth, and shows which firmware the shared ESP32-S3 board is running with a switch to Echo.'],
    changesVi: ['Nexus: khung Thiết bị bỏ túi nối được qua USB (Web Serial) ngoài Bluetooth, và hiện board ESP32-S3 dùng chung đang chạy firmware nào kèm nút chuyển sang Echo.'],
  },
  {
    version: '1.80.0',
    date: '2026-11-01',
    changes: [
      'Echo: new "Room watch (USB)". Plug an ESP32-S3 flashed with RuView firmware into your phone or PC, tap Connect, and the page shows whether someone is in the room, whether they move, and breathing, read straight from the board over USB. No home PC needed, nothing leaves the device. Experimental and not medical; use only in your own places. Not yet tested on a real board.',
    ],
    changesVi: [
      'Echo: thêm "Canh phòng (USB)". Cắm board ESP32-S3 đã flash firmware RuView vào điện thoại hoặc máy tính, bấm Nối, trang sẽ cho biết phòng có người không, có cử động không và nhịp thở, đọc thẳng từ board qua USB. Không cần máy nhà, dữ liệu không rời thiết bị. Đang thử nghiệm, không phải y tế, chỉ dùng ở nơi của anh. Chưa thử trên board thật.',
    ],
  },
  {
    version: '1.79.1',
    date: '2026-11-01',
    changes: [
      'Fixed: the Nexus page\'s "Pocket scout" card floated off to the side, disconnected from the rest of the page, when the home agent is not set up yet (the state most phones see first). Fixes a layout bug reported from a real phone.',
    ],
    changesVi: [
      'Sửa lỗi: khung "Thiết bị bỏ túi" ở trang Nexus bị trôi lệch sang một bên, tách khỏi các khung khác, khi chưa cài chương trình trên máy nhà (trạng thái đa số điện thoại thấy đầu tiên). Sửa lỗi giao diện anh báo từ điện thoại thật.',
    ],
  },
  {
    version: '1.79.0',
    date: '2026-11-01',
    changes: [
      'Nexus: new "Pocket scout" panel. Power a nexus-scout ESP32 from a battery pack, connect to it over Bluetooth from the Nexus page, and see a radar of the Wi-Fi and BLE around it — watch only, it never sends deauth or any attack frame. Flags crowded channels, open/WEP/WPS networks, a possible evil-twin copy of your own Wi-Fi name, and a Bluetooth device that keeps following you.',
      'Nexus "Devices on your network" now shows a rough device type (router, phone, printer, camera, …) next to the maker name.',
      'New open-source firmware/nexus-scout/, built in CI for ESP32-S3 and plain ESP32, flashable straight from this repo with Volt.',
    ],
    changesVi: [
      'Nexus: thêm khung "Thiết bị bỏ túi". Cấp nguồn cho ESP32 chạy nexus-scout bằng pin dự phòng, kết nối Bluetooth từ trang Nexus, xem radar Wi-Fi và BLE xung quanh — chỉ quan sát, không bao giờ gửi deauth hay khung tấn công nào. Báo kênh đông, mạng open/WEP/WPS, khả năng có mạng giả mạo tên Wi-Fi của anh, và thiết bị Bluetooth cứ bám theo.',
      'Mục "Thiết bị trong mạng" của Nexus giờ hiện thêm loại thiết bị ước lượng (router, điện thoại, máy in, camera, …) bên cạnh tên hãng.',
      'Firmware mã nguồn mở mới firmware/nexus-scout/, build tự động trên CI cho ESP32-S3 và ESP32 thường, nạp thẳng từ repo này bằng Volt.',
    ],
  },
  {
    version: '1.78.0',
    date: '2026-11-01',
    changes: [
      'Volt: paste any GitHub repo or release link, connect an ESP32-S3/C6/C3/S2/original board over USB, and Volt checks the firmware against the connected chip (chip match, flash size, offsets, no overlap) before it ever flashes, so it cannot burn a mismatched image.',
      'New: Lumi, an ambient travel translator. Turn it on in a café abroad; it listens, auto-detects language, groups what it hears into separate conversations, and gives a rolling Vietnamese summary. Audio is never stored. Two modes: "Nói với em" (one person, safer) and "Nghe xung quanh" (everyone nearby, your call on local recording laws). Off switches for both in Settings > AI rules.',
    ],
    changesVi: [
      'Volt: dán link repo hay bản phát hành GitHub bất kỳ, cắm board ESP32-S3/C6/C3/S2/gốc qua USB, Volt sẽ so firmware với chip đang cắm (đúng chip, đủ dung lượng, đúng offset, không chồng lấn) trước khi flash, nên không thể làm hỏng board vì nạp nhầm file.',
      'Mới: Lumi, tai phiên dịch du lịch xung quanh. Mở lên khi ngồi quán cà phê ở nước ngoài; Lumi nghe, tự nhận ngôn ngữ, gom thành từng cuộc nói chuyện riêng, và tóm tắt tiếng Việt gần như theo thời gian thực. Không lưu âm thanh. Hai chế độ: "Nói với em" (một người, an toàn hơn) và "Nghe xung quanh" (nghe cả xung quanh, tự chịu trách nhiệm theo luật ghi âm nơi bạn đến). Có nút tắt riêng cho cả hai trong Cài đặt > Luật AI.',
    ],
  },
  {
    version: '1.77.9',
    date: '2026-10-31',
    changes: ['Nova captions: short (hook, one question, hashtags) instead of the script, and hashtags no longer include filler words like #some #people #only.'],
    changesVi: ['Caption Nova: ngắn gọn (hook, một câu hỏi, hashtag) thay vì dán kịch bản, hashtag không còn chữ thừa như #some #people #only.'],
  },
  {
    version: '1.77.8',
    date: '2026-10-31',
    changes: ['Nova: one Viraltech button per video. "Send to Viraltech" sends and opens Viraltech; once sent it becomes "Open Viraltech". Taking a video back is on the Viraltech page.'],
    changesVi: ['Nova: mỗi video chỉ còn một nút Viraltech. "Gửi sang Viraltech" gửi và mở Viraltech; khi đã gửi nó thành "Mở Viraltech". Lấy video lại thì làm ở trang Viraltech.'],
  },
  {
    version: '1.77.7',
    date: '2026-10-31',
    changes: ['Nova: "Send to Viraltech" now opens Viraltech right after sending, instead of staying on the same page.'],
    changesVi: ['Nova: nút "Gửi sang Viraltech" giờ tự mở Viraltech ngay sau khi gửi, không đứng yên ở trang cũ nữa.'],
  },
  {
    version: '1.77.6',
    date: '2026-10-31',
    changes: ['Nova share: the video is loaded before you tap Share so the phone share sheet opens in one tap (no manual download), the caption and hashtags are shown under each finished video with a Copy button and are put on the clipboard when you share.'],
    changesVi: ['Nova chia sẻ: video được tải sẵn trước khi bấm Chia sẻ nên khay chia sẻ của điện thoại mở ngay một lần bấm (không phải tải tay), caption và hashtag hiện sẵn dưới mỗi video xong kèm nút Copy và tự copy khi chia sẻ.'],
  },
  {
    version: '1.77.5',
    date: '2026-10-31',
    changes: ['Nova videos can no longer sit forever: a video not started in 20 minutes (or rendering over 65) shows a clear error with a "Try again" button, waiting videos show how long they have waited with "Start now", and the render farm restarts itself while videos are still waiting.'],
    changesVi: ['Video Nova không còn kẹt mãi: video chưa chạy sau 20 phút (hoặc render quá 65 phút) sẽ báo lỗi rõ kèm nút "Thử lại", video đang chờ hiện đã chờ bao lâu và có nút "Chạy ngay", farm tự chạy lại khi vẫn còn video chờ.'],
  },
  {
    version: '1.77.4',
    date: '2026-10-31',
    changes: ['Nova shows which AI and model is writing (and the backup) on the progress bar, and which model actually wrote it when done.'],
    changesVi: ['Nova hiện AI và model nào đang viết (cùng model dự phòng) ngay trên thanh tiến trình, và khi xong ghi rõ model nào đã viết thật.'],
  },
  {
    version: '1.77.3',
    date: '2026-10-31',
    changes: ['AI auto-rotate everywhere (Neo, Nova, Settings test): Gemini, Groq, Grok and NVIDIA now ask the provider which models it serves today, try the newest free one first and move to the next when a model is gone (404) or out of quota (429). Nova scripts are written as one small story, with no invented statistics or "share your story" endings.'],
    changesVi: ['AI tự xoay ở mọi nơi (Neo, Nova, nút thử trong Cài đặt): Gemini, Groq, Grok và NVIDIA giờ hỏi nhà cung cấp hôm nay đang có model nào, thử model miễn phí mới nhất trước và chuyển sang model kế khi model cũ bị bỏ (404) hoặc hết hạn mức (429). Kịch bản Nova viết như một câu chuyện nhỏ, không bịa số liệu, không kết bằng "chia sẻ câu chuyện của bạn".'],
  },
  {
    version: '1.77.2',
    date: '2026-10-31',
    changes: ['Nova: the EN and VI script boxes are no longer resizable (they could overlap each other); they are fixed-size and scroll.'],
    changesVi: ['Nova: hai khung kịch bản EN và VI không còn kéo giãn được nữa (trước đây đè lên nhau), cố định kích thước và cuộn được.'],
  },
  {
    version: '1.77.1',
    date: '2026-10-31',
    changes: ['Nova: the Muse clip link and clip upload are back in plain sight in step 3 (they had been tucked into Advanced).'],
    changesVi: ['Nova: ô dán link video Muse và tải clip lên đã hiện lại rõ ràng ở bước 3 (trước đó lỡ nằm trong mục Nâng cao).'],
  },
  {
    version: '1.77.0',
    date: '2026-10-31',
    changes: ['Iris: new "Nearest cam" button. It finds the closest public traffic camera to you, says how far it is, and flies there (the free camera lists only cover some regions, none in Italy or Vietnam yet).'],
    changesVi: ['Iris: nút mới "Camera gần". Tìm camera giao thông công khai gần anh nhất, báo cách bao nhiêu km và bay tới đó (danh sách camera miễn phí chỉ có ở một số vùng, chưa có ở Ý hay Việt Nam).'],
  },
  {
    version: '1.76.1',
    date: '2026-10-31',
    changes: ['Iris on phones: removed the "turn off all layers" button from the top-right column (too easy to tap by mistake; every layer has its own switch in the Layers tab).'],
    changesVi: ['Iris trên điện thoại: bỏ nút "tắt hết lớp" ở cột nút góc trên phải (dễ bấm nhầm, mỗi lớp đã có công tắc riêng ở tab Lớp).'],
  },
  {
    version: '1.76.0',
    date: '2026-10-31',
    changes: ['Iris on phones: the bottom tab bar (Layers, Cameras, Context, Search, More) now really opens its panels, with our quick layers on top of Layers. The duplicate Layers/Panels buttons at the top are gone, and the language globe no longer overlaps the camera buttons.'],
    changesVi: ['Iris trên điện thoại: thanh tab dưới (Lớp, Camera, Ngữ cảnh, Tìm, Thêm) giờ mở đúng bảng, có "Lớp nhanh" trên đầu tab Lớp. Bỏ hai nút trùng "Lớp dữ liệu/Bảng" ở trên, và quả cầu ngôn ngữ không còn đè lên nút camera.'],
  },
  {
    version: '1.75.1',
    date: '2026-10-31',
    changes: ['Nova has one clear path: tap a topic idea (it is highlighted and fills your topic), then press "Write the script" in step 2. The "Pick one for me and write" button is now just "Random idea" and only picks a topic. Hooks: default 4, max 5. Clearer names.'],
    changesVi: ['Nova có một đường đi rõ ràng: chạm 1 ý tưởng (được tô sáng và điền vào chủ đề), rồi bấm "Viết kịch bản" ở bước 2. Nút "Chọn giúp rồi viết" giờ chỉ là "Chọn ngẫu nhiên" và chỉ chọn chủ đề. Hook: mặc định 4, tối đa 5. Tên nút dễ hiểu hơn.'],
  },
  {
    version: '1.75.0',
    date: '2026-10-31',
    changes: ['Iris: one language picker (the globe at the top right, includes Tiếng Việt) instead of two, liquid-glass buttons and tab bar that stay smooth on phones (no live blur there), and the phone tab icons are back (they had turned into words).'],
    changesVi: ['Iris: chỉ còn một chỗ chọn ngôn ngữ (quả cầu ở góc trên phải, có Tiếng Việt), nút và thanh tab kiểu kính lỏng mượt trên điện thoại (không làm mờ trực tiếp), và icon ở thanh tab đã trở lại (trước đó bị biến thành chữ).'],
  },
  {
    version: '1.74.0',
    date: '2026-10-31',
    changes: ['Nova is simpler: 4 steps (Topic, Script, Make video, Post). Removed the Faceless/Philosophy/My Trip tabs, presets bar and library picker. Picking a new topic clears the old script and hooks. AI waits now end after about 12 seconds per helper with a clear message instead of hanging at 90%.'],
    changesVi: ['Nova gọn hơn: 4 bước (Chủ đề, Kịch bản, Làm video, Đăng bài). Bỏ 3 tab Faceless/Triết lý/Chuyến đi, thanh Presets và ô chọn thư viện. Chọn chủ đề mới thì kịch bản và hook cũ bị xoá. Chờ AI tối đa khoảng 12 giây mỗi nhà cung cấp rồi báo lỗi rõ ràng, không còn treo ở 90%.'],
  },
  {
    version: '1.73.0',
    date: '2026-10-31',
    changes: ['Iris now runs on God\'s Eye View v0.3.0: new phone tab bar (Layers, Cameras, Context, Search, More), short share links, "Environmental" first view, and many fixes. Our Vietnamese UI and Iris buttons are kept.'],
    changesVi: ['Iris nâng lên God\'s Eye View v0.3.0: có thanh tab mới ở điện thoại (Lớp, Camera, Ngữ cảnh, Tìm, Thêm), link chia sẻ ngắn, màn đầu "Môi trường" và nhiều sửa lỗi. Giữ nguyên tiếng Việt và các nút Iris.'],
  },
  {
    version: '1.72.1',
    date: '2026-10-30',
    changes: ['Buy/sell pop-ups now close by themselves after a few seconds, and you can swipe them left or right to dismiss.'],
    changesVi: ['Thông báo mua/bán giờ tự đóng sau vài giây, và có thể vuốt trái hoặc phải để đóng.'],
  },
  {
    version: '1.72.0',
    date: '2026-10-30',
    changes: ['Nova hook themes: hooks and starting ideas now come only from the channel\'s 4 themes (dark psychology to recognise and defend, sad truths, everyday moments, flying nature). Each theme has tap-to-use ideas and an AI button for fresh ones; hooks are one short concrete sentence under 15 words. Tech and news ideas are kept, folded under "Saved for later". Switch: Settings, Nova hook themes.'],
    changesVi: ['Nova nhóm hook: hook và ý tưởng mở đầu giờ chỉ lấy từ 4 nhóm của kênh (tâm lý đen tối để nhận diện và tự vệ, sự thật buồn, khoảnh khắc đời thường, thiên nhiên bay). Mỗi nhóm có ý tưởng chạm là dùng và nút nhờ AI gợi ý mới; hook là 1 câu ngắn, cụ thể, dưới 15 chữ. Ý tưởng tech và tin tức vẫn giữ, xếp trong mục "Để dành sau". Công tắc: Cài đặt, Nova nhóm hook.'],
  },
  {
    version: '1.71.0',
    date: '2026-10-30',
    changes: ['Nova and Viraltech now flow into each other: after "Send to Viraltech" a button opens Viraltech, Viraltech has "Open Nova", and each waiting video has the same Share / post button (copies the caption, opens the phone share sheet). Nothing posts by itself.'],
    changesVi: ['Nova và Viraltech nối thành một dòng chảy: sau "Gửi sang Viraltech" có nút mở Viraltech, Viraltech có nút "Mở Nova", và mỗi video chờ có nút Chia sẻ / đăng (copy caption, mở khay chia sẻ điện thoại). Không có gì tự đăng.'],
  },
  {
    version: '1.70.0',
    date: '2026-10-30',
    changes: ['Nova quick-post: a Share / post button on every finished video copies the caption and hashtags and opens the phone share sheet with the MP4 (falls back to a download). You post it yourself; the app never posts. Switch: Settings, Nova quick-post.'],
    changesVi: ['Nova đăng nhanh: nút Chia sẻ / đăng trên mỗi video xong sẽ copy caption + hashtag và mở khay chia sẻ của điện thoại kèm file MP4 (không có thì tải về). Anh tự đăng, app không bao giờ tự đăng. Công tắc: Cài đặt, Nova đăng nhanh.'],
  },
  {
    version: '1.69.0',
    date: '2026-10-30',
    changes: ['Nova Footage: "Make MP4 with this text" burns the English and Vietnamese lines onto your clip on the server (GitHub Actions) and keeps the clip\'s motion, size and frame rate (60 fps stays 60 fps); the original file is never touched. The text is now one compact pill near the top edge, English in white and Vietnamese in gold with a hairline between, so the scene stays clear; a slider moves it. The clip tile now shows the clip\'s first frame.'],
    changesVi: ['Nova Footage: "Xuất MP4 kèm chữ này" in dòng tiếng Anh và tiếng Việt lên clip của anh trên máy chủ (GitHub Actions), giữ chuyển động, kích thước và số khung hình của clip (60 fps vẫn là 60 fps); file gốc không bị đụng tới. Chữ giờ là một khung nhỏ gọn sát mép trên, tiếng Anh màu trắng, tiếng Việt màu vàng, có đường kẻ mảnh giữa hai dòng, nên cảnh phía sau vẫn rõ; có thanh trượt để dời lên xuống. Ô clip giờ hiện khung hình đầu tiên.'],
  },
  {
    version: '1.68.0',
    date: '2026-10-30',
    changes: ['Nova Footage: a clip you uploaded or imported now plays in the hub with your English and Vietnamese lines on top, switching slide by slide across the clip. It is a preview: the file is not changed yet. A Settings switch hides it.'],
    changesVi: ['Nova Footage: clip anh đã tải lên hoặc nhập về giờ phát ngay trong hub, kèm các dòng tiếng Anh và tiếng Việt chồng lên, đổi từng slide theo độ dài clip. Đây là bản xem trước, file chưa bị đổi. Có công tắc trong Cài đặt để ẩn.'],
  },
  {
    version: '1.67.0',
    date: '2026-10-30',
    changes: ['Nova Footage: paste a Muse file link (muse.ai only, up to 50 MB) and the server fetches the clip for you, part by part, with a progress bar. A Settings switch turns the link box off.'],
    changesVi: ['Nova Footage: dán link file Muse (chỉ muse.ai, tối đa 50 MB), máy chủ tự tải clip về từng phần, có thanh tiến trình. Có công tắc trong Cài đặt để ẩn ô dán link.'],
  },
  {
    version: '1.66.0',
    date: '2026-10-30',
    changes: ['Nova: new Settings switch "Nova channel script rules" (off by default). On: 3 to 5 slides (4 by default), one complete idea per slide, a human-psychology tone as recognition (no manipulation tips, no diagnosing, no invented statistics), and the preview and MP4 run about 44 seconds. Off: nothing changes.'],
    changesVi: ['Nova: công tắc mới trong Cài đặt "Luật kịch bản kênh Nova" (mặc định tắt). Bật: 3 đến 5 slide (mặc định 4), mỗi slide một ý trọn vẹn, giọng tâm lý con người theo hướng nhận ra bản thân (không dạy thao túng, không chẩn đoán, không bịa số liệu), bản xem trước và MP4 dài khoảng 44 giây. Tắt: không có gì thay đổi.'],
  },
  {
    version: '1.65.4',
    date: '2026-10-30',
    changes: ['Nova uploads: when a photo or clip upload fails, the message now shows the server\'s reason (HTTP code and text) instead of only "failed".'],
    changesVi: ['Nova tải lên: khi tải ảnh hoặc clip thất bại, thông báo giờ hiện lý do từ máy chủ (mã HTTP và nội dung) thay vì chỉ "thất bại".'],
  },
  {
    version: '1.65.3',
    date: '2026-10-30',
    changes: ['Nova: when the AI answers with a JSON list or numbers on one line, the script now keeps every scene instead of collapsing to one.'],
    changesVi: ['Nova: khi AI trả về danh sách JSON hoặc đánh số trên một dòng, kịch bản giữ đủ mọi cảnh thay vì gộp thành một cảnh.'],
  },
  {
    version: '1.65.2',
    date: '2026-10-30',
    changes: ["Settings > Free AI keys no longer says \"Could not reach the server\" when the installed app's offline cache answered a server call with the app page. Server calls (/api) now always go straight to the server."],
    changesVi: ["Settings > Free AI keys không còn báo \"Không kết nối được máy chủ\" khi bộ nhớ offline của ứng dụng trả nhầm trang ứng dụng cho một lệnh gọi máy chủ. Mọi lệnh gọi /api giờ đi thẳng tới máy chủ."],
  },
  {
    version: '1.65.1',
    date: '2026-10-30',
    changes: ["Neo chat no longer says \"I need an API key\" when your free AI keys are already saved. If the helpers are just busy or over their limit, it now says so and points to the Test button."],
    changesVi: ["Neo chat không còn báo \"cần API key\" khi key AI miễn phí đã được lưu. Nếu các AI chỉ đang bận hoặc hết hạn mức thì Neo nói đúng như vậy và chỉ tới nút Test."],
  },
  {
    version: '1.65.0',
    date: '2026-10-29',
    changes: ["Nova: the AI script writer now gets enough room to write every scene (it was cut off after one line per language), and a dropped connection is retried once with a clear message. Own clips: a file the phone can't read no longer hangs at 0%, and clips with an empty or odd type (.mp4 from some pickers) are accepted. Every wait in Nova (writing, trends, post kit, loading files, uploading, sending to the server, rendering) now shows a progress bar."],
    changesVi: ["Nova: AI viết kịch bản giờ có đủ chỗ để viết hết mọi cảnh (trước đây bị cắt còn một dòng mỗi ngôn ngữ), và rớt mạng thì tự thử lại một lần kèm thông báo rõ ràng. Clip của anh: file điện thoại không đọc được không còn treo ở 0%, clip có loại file trống hoặc lạ (.mp4 từ một số bộ chọn file) vẫn được nhận. Mọi bước chờ trong Nova (viết kịch bản, xu hướng, bộ đăng bài, nạp file, tải lên, gửi lên máy chủ, tạo video) giờ đều có thanh tiến trình."],
  },
  {
    version: '1.64.0',
    date: '2026-10-24',
    changes: ["Iris runs the original God's Eye server code inside its own Cloudflare Worker instead of a Hugging Face Space (Hugging Face now charges for that), so it stays free and never sleeps: CCTV cameras, wildfires, storms, launches, transit, radio and place search are back. Overpass (ALPR cameras, outlines) is asked straight from your browser, since its servers refuse Cloudflare. The camera list is refreshed every 2 hours at build time so it opens instantly; wind is still off."],
    changesVi: ["Iris chạy luôn code máy chủ gốc của God's Eye trong Worker Cloudflare của mình thay vì Hugging Face Space (Hugging Face giờ thu phí), nên vẫn miễn phí và không bao giờ ngủ: camera CCTV, cháy rừng, bão, phóng tên lửa, giao thông công cộng, radio và tìm địa điểm đã có lại. Overpass (camera ALPR, viền toà nhà) do trình duyệt của anh hỏi thẳng, vì máy chủ Overpass chặn Cloudflare. Danh sách camera được làm mới mỗi 2 giờ lúc build nên mở ra ngay; lớp gió vẫn tắt."],
  },
  {
    version: '1.63.0',
    date: '2026-10-24',
    changes: ["Iris gets the rest of the original God's Eye back: CCTV cameras, Overpass (ALPR cameras, building outlines, mapped sites), weather, traffic, radio, transit and more now come from the original server running free on a Hugging Face Space. Flights, satellites and ships stay on Cloudflare. After two idle days the Space sleeps and takes about a minute to wake."],
    changesVi: ["Iris có lại phần còn thiếu của God's Eye gốc: camera CCTV, Overpass (camera ALPR, viền toà nhà, địa điểm), thời tiết, giao thông, radio, giao thông công cộng… giờ lấy từ máy chủ gốc chạy miễn phí trên Hugging Face Space. Máy bay, vệ tinh, tàu vẫn chạy trên Cloudflare. Nếu 2 ngày không ai dùng thì Space ngủ, lần mở sau mất khoảng 1 phút."],
  },
  {
    version: '1.62.0',
    date: '2026-10-24',
    changes: [
      "Iris opens in the Hub's glass look like the other agents (wallpaper, theme, Iris's character), and the Layers/Panels bar on the globe takes the theme colour.",
      'Overpass works again through free public servers, so ALPR cameras, building outlines and mapped sites can load; the "Overpass temporarily unavailable" banner only shows when every server really refuses.',
    ],
    changesVi: [
      'Iris mở ra theo kiểu kính của Hub như các agent khác (hình nền, theme, nhân vật Iris), thanh Lớp dữ liệu/Bảng trên quả cầu cũng theo màu theme.',
      'Overpass chạy lại qua các máy chủ công cộng miễn phí, nên camera ALPR, viền toà nhà và địa điểm trên bản đồ tải được; dòng "Overpass temporarily unavailable" chỉ hiện khi mọi máy chủ thật sự từ chối.',
    ],
  },
  {
    version: '1.61.1',
    date: '2026-10-24',
    changes: ['Nova Footage: adding photos or clips on a phone no longer fails with "The image source is not usable". A clip whose picture the phone cannot play (often HDR or 10-bit video) or a HEIC photo now gets a clear note under the picker, and the other files are still added. Added photos show as thumbnails you can remove, so the count matches what you see; big photos are shrunk to save the phone\'s memory.'],
    changesVi: ['Footage của Nova: thêm ảnh hoặc clip trên điện thoại không còn báo lỗi "The image source is not usable". Clip mà máy không phát được hình (thường do quay HDR hoặc 10-bit) hay ảnh HEIC giờ có ghi chú rõ ngay dưới ô chọn, các file khác vẫn được thêm. Ảnh đã thêm hiện thành hình nhỏ có nút xoá, nên con số đếm khớp với những gì anh thấy; ảnh lớn được thu nhỏ để đỡ tốn bộ nhớ máy.'],
  },
  {
    version: '1.61.0',
    date: '2026-10-24',
    changes: ['Atlas Brief, Echo, Nexus, Viraltech and Max now open in the same glass look as the Neo Hub and Nova: the Hub wallpaper and theme, the agent\'s character next to its name, and glass cards. The Trading desk and Portfolio take the Hub theme\'s colours (the chart keeps a dark background so candles stay clear), and the top menu is a glass bar where a highlight glides to the tab under your mouse. Neo\'s brain button, chat box and pop-up notes take the same glass on every page. Max has its own page: app version, the code tasks Claude is working on, the latest updates and a box to ask for a fix or a new feature. Viraltech\'s back button now returns to the Hub. Off switch in Settings > AI rules.'],
    changesVi: ['Brief của Atlas, Echo, Nexus, Viraltech và Max giờ mở ra cùng kiểu kính như Neo Hub và Nova: cùng hình nền và theme của Hub, nhân vật của agent cạnh tên, thẻ kính. Bàn giao dịch và Portfolio đổi sang màu theme của Hub (biểu đồ vẫn nền tối cho nến rõ), menu phía trên thành thanh kính, có vệt sáng lướt theo chuột. Nút bộ não, khung chat và thông báo của Neo cũng theo kiểu kính trên mọi trang. Max có trang riêng: phiên bản app, các việc code Claude đang làm, cập nhật gần đây và ô nhờ sửa lỗi hay thêm tính năng. Nút quay lại của Viraltech giờ về Hub. Tắt được trong Cài đặt > Quy tắc AI.'],
  },
  {
    version: '1.60.0',
    date: '2026-10-24',
    changes: ['A finished Nova video has a "Send to Viraltech" button. The Viraltech page lists the videos waiting for your OK, to watch, download or take back. Nothing is posted by itself: tell Claude which video and channel, and it posts only after you say yes. Off switch in Settings > AI rules.'],
    changesVi: ['Video Nova đã xong có nút "Gửi sang Viraltech". Trang Viraltech có mục video chờ anh duyệt: xem, tải về hoặc lấy lại. Không video nào tự đăng: anh nhắn Claude video nào, kênh nào, Claude chỉ đăng khi anh đồng ý. Tắt được trong Cài đặt > Quy tắc AI.'],
  },
  {
    version: '1.59.0',
    date: '2026-10-24',
    changes: [
      "Iris (God's Eye) is cleaner on phone and tablet: the decorative HUD text is gone, the Data layers and Context boxes open from one small bar as a drawer that scrolls, and the voice box (it needs an OpenAI key) is hidden.",
      'The "Overpass temporarily unavailable" banner no longer shows, and ships now come from the free Digitraffic feed (Baltic Sea) with no key.',
      'The Iris page in the Hub fits the screen with no scrolling, and the layer check is right again: flights, military aircraft and satellites were working all along, only the check said 404.',
    ],
    changesVi: [
      'Iris (God\'s Eye) gọn hơn trên điện thoại và máy tính bảng: bỏ chữ trang trí trên màn hình, hộp Lớp dữ liệu và Bối cảnh mở từ một thanh nhỏ thành ngăn kéo cuộn được, ẩn hộp giọng nói (cần key OpenAI).',
      'Không còn dòng báo "Overpass temporarily unavailable", và tàu biển giờ lấy từ nguồn miễn phí Digitraffic (biển Baltic), không cần key.',
      'Trang Iris trong Hub vừa khít màn hình, không phải cuộn, và phần kiểm tra lớp đã đúng: máy bay, máy bay quân sự và vệ tinh vẫn chạy từ trước, chỉ phần kiểm tra báo 404.',
    ],
  },
  {
    version: '1.58.0',
    date: '2026-10-24',
    changes: ['Nova ideas now follow Viraltech: a topic switch (Tech + Philosophy, New tech, Philosophy, Everything) with new free sources for new tech (Hacker News, Product Hunt, r/technology) and philosophy (r/philosophy, Aeon essays, Stanford Encyclopedia of Philosophy). Google News (never answered) and YouTube (needed a key) are gone; the YouTube Trending link stays under Filters.'],
    changesVi: ['Ý tưởng của Nova giờ theo đúng Viraltech: có nút chọn chủ đề (Công nghệ + Triết học, Công nghệ mới, Triết học, Tất cả) với nguồn miễn phí mới cho công nghệ mới (Hacker News, Product Hunt, r/technology) và triết học (r/philosophy, bài luận Aeon, Bách khoa Triết học Stanford). Đã bỏ Google News (không bao giờ trả lời) và YouTube (cần key); link YouTube Trending vẫn còn trong Bộ lọc.'],
  },
  {
    version: '1.57.0',
    date: '2026-10-24',
    changes: ['Nova can make a video with Lemo-Opuscar on your PC: the whole film drawn in code, a different style each time. Nova shows whether the PC is on; when it is off, Lemo is greyed out, nothing is sent to it and videos are made with MoneyPrinterTurbo as before. A Lemo video still waiting after 30 minutes with the PC off is marked failed and tells you why. Off switch in Settings > AI rules.'],
    changesVi: ['Nova có thể dựng video bằng Lemo-Opuscar trên máy PC: cả phim vẽ bằng code, mỗi lần một style khác. Nova hiện máy PC đang bật hay tắt; khi tắt, Lemo bị mờ, không gửi gì cho nó và video dựng bằng MoneyPrinterTurbo như trước. Video Lemo chờ quá 30 phút mà máy PC tắt sẽ báo lỗi và ghi rõ lý do. Tắt được trong Cài đặt > Quy tắc AI.'],
  },
  {
    version: '1.56.3',
    date: '2026-10-24',
    changes: ['Atlas practice exits are more honest: when a price opens below the stop (a gap), the trade now closes at that opening price like a real stop order, not at the stop.'],
    changesVi: ['Atlas ghi lệnh thoát sát thực tế hơn: khi giá mở cửa nhảy xuống dưới mức cắt lỗ, lệnh giờ đóng ở giá mở cửa như lệnh cắt lỗ thật, không phải ở giá cắt lỗ.'],
  },
  {
    version: '1.56.2',
    date: '2026-10-24',
    changes: ['The Atlas Brief shows only trading now: the Studio (video tools) and Devices cards moved out; those live in their own projects in the Hub (Nova, Lumi, Nexus, Echo).'],
    changesVi: ['Trang Bản tin của Atlas giờ chỉ còn phần giao dịch: bỏ thẻ Studio (công cụ video) và Thiết bị; các phần đó nằm ở dự án riêng trong Hub (Nova, Lumi, Nexus, Echo).'],
  },
  {
    version: '1.56.1',
    date: '2026-10-24',
    changes: ['Neo\'s expressions simplified: one smooth sequence of gentle smile with subtle tilt and nod. The extra expressions (grin, energetic nod, playful look) have been removed for a more natural appearance.'],
    changesVi: ['Biểu cảm của Neo được đơn giản hóa: chỉ một chuỗi mịn mà cười mỉm nhẹ, giật đầu và gật đầu. Đã bỏ các biểu cảm thêm (nhe răng, gật đầu hào hứng, ánh mắt tinh nghịch) để tạo vẻ tự nhiên hơn.'],
  },
  {
    version: '1.56.0',
    date: '2026-10-23',
    changes: ['Neo\'s face has more moods: besides the soft smile there is now a big toothy grin, an energetic smiling nod and a playful bright-eyed look. Neo plays them in turn with a short rest between, so it no longer repeats the same smile. Still light: one small clip at a time, only while Neo is on screen, and the Arc ring around the face now turns as one layer, which is cheaper on phones.'],
    changesVi: ['Khuôn mặt Neo có thêm nhiều biểu cảm: ngoài cười mỉm còn có cười nhe răng, cười gật đầu hào hứng và ánh mắt tinh nghịch tươi vui. Neo thay phiên từng biểu cảm, nghỉ ngắn giữa mỗi lần, nên không còn lặp mãi một kiểu cười. Vẫn nhẹ: mỗi lần chỉ một clip nhỏ, chỉ chạy khi Neo hiện trên màn hình, và vòng Arc quanh mặt giờ xoay như một lớp nên nhẹ hơn trên điện thoại.'],
  },
  {
    version: '1.55.2',
    date: '2026-10-23',
    changes: ['The hanging project tags swing again on phones and tablets, a little softer, and hold still while you scroll.'],
    changesVi: ['Các thẻ dự án treo lại đu đưa trên điện thoại và tablet, nhẹ hơn một chút, và đứng yên khi anh đang cuộn.'],
  },
  {
    version: '1.55.1',
    date: '2026-10-23',
    changes: [
      'Hub scrolls much lighter on phones and tablets: the little people and logos stop moving their parts there (that made the screen redraw the whole layout every frame) and gently bob as a whole instead, every animation holds still while you scroll, the hanging tags hang still, and the back of a card is only drawn when it turns over. This also fixes tags and cards that sometimes drew blank.',
    ],
    changesVi: [
      'Hub cuộn nhẹ hơn nhiều trên điện thoại và tablet: các nhân vật và logo không còn cử động từng bộ phận nữa (việc đó bắt máy vẽ lại toàn bộ bố cục mỗi khung hình), thay vào đó cả hình nhún nhẹ. Mọi hoạt ảnh đứng yên khi anh đang cuộn, các thẻ treo không đu đưa nữa, và mặt sau của thẻ chỉ được vẽ khi lật. Sửa luôn lỗi thẻ và tên dự án đôi khi hiện trống.',
    ],
  },
  {
    version: '1.55.0',
    date: '2026-10-23',
    changes: ['Neo now has your face: a 3D portrait made from your Pixar-style photo, with a short loop where you smile, tilt and nod. It shows on the Hub and everywhere Neo talks (chat, Brain, alerts), inside the Arc ring that still glows for thinking and warnings. The clip is about 35 KB, loads only when Neo is on screen and pauses when you scroll away; small icons and reduced motion use the still picture. Off switch: Settings > AI rules > Neo has your 3D face.'],
    changesVi: ['Neo giờ mang khuôn mặt của anh: chân dung 3D làm từ ảnh Pixar của anh, với đoạn lặp ngắn anh cười, nghiêng đầu và gật đầu. Hiện ở Hub và mọi chỗ Neo nói chuyện (khung chat, Brain, thông báo), nằm trong vòng Arc vẫn sáng khi đang nghĩ hoặc cảnh báo. Clip chỉ khoảng 35 KB, chỉ tải khi Neo hiện trên màn hình và tự dừng khi cuộn đi; biểu tượng nhỏ và chế độ giảm chuyển động dùng ảnh tĩnh. Tắt trong Cài đặt > Luật AI > Neo mang khuôn mặt 3D của anh.'],
  },
  {
    version: '1.54.0',
    date: '2026-10-23',
    changes: ['Nova presets: save the mode, size, post kit settings and video settings under a name (for example "TikTok facts VI"), then load them again in one tap from the list at the top of Nova. Presets are kept on the server, so they show up on every device. Off switch: Settings > AI rules > Nova presets.'],
    changesVi: ['Preset cho Nova: lưu chế độ, khung hình, cài đặt bộ đăng bài và chỉnh video thành một tên (ví dụ "TikTok sự thật VI"), rồi chạm một lần ở danh sách đầu trang Nova là dùng lại. Preset lưu trên máy chủ nên máy nào cũng thấy. Tắt trong Cài đặt > Luật AI > Preset cho Nova.'],
  },
  {
    version: '1.53.0',
    date: '2026-10-23',
    changes: ['Nova step 3 can now take your own photos and clips for the voiced server video: up to 10 files, 50 MB each, clips up to 60 seconds. They upload in small parts (a dropped connection retries), you can put them in any order, and the video uses them in that order instead of stock photos. Uploads delete themselves after 3 days. Off switch: Settings > AI rules > Nova uses your own photos and clips.'],
    changesVi: ['Bước 3 của Nova giờ nhận ảnh và clip của anh cho video máy chủ có giọng: tối đa 10 file, mỗi file 50 MB, clip tối đa 60 giây. File được tải lên từng phần nhỏ (rớt mạng thì tự thử lại), anh xếp thứ tự tuỳ ý, và video dùng đúng thứ tự đó thay cho ảnh có sẵn. File tự xoá sau 3 ngày. Tắt trong Cài đặt > Luật AI > Nova dùng ảnh và clip của anh.'],
  },
  {
    version: '1.52.1',
    date: '2026-10-23',
    changes: [
      'Fixed the "Still in CONNECTING state" error that sometimes broke a panel when you picked a stock or moved between pages: the live price feed now waits until it is connected before sending.',
      'Hub cards: the tool buttons at the bottom now wrap onto a second line, so nothing is cut off on a phone or tablet.',
      'Smoother scrolling on phones and tablets: cards skip the live glass blur there, the background no longer re-blurs on every frame, and animations pause while a card is off screen.',
    ],
    changesVi: [
      'Sửa lỗi "Still in CONNECTING state" thỉnh thoảng làm hỏng một khung khi chọn mã hoặc chuyển trang: luồng giá trực tiếp giờ đợi kết nối xong rồi mới gửi.',
      'Thẻ Hub: các nút công cụ ở dưới giờ xuống dòng, không còn bị cắt trên điện thoại hay máy tính bảng.',
      'Cuộn mượt hơn trên điện thoại và máy tính bảng: thẻ bỏ hiệu ứng làm mờ kính trực tiếp, nền không còn làm mờ lại mỗi khung hình, và hoạt ảnh tạm dừng khi thẻ nằm ngoài màn hình.',
    ],
  },
  {
    version: '1.52.0',
    date: '2026-10-23',
    changes: ['Nova\'s server video can now be tuned in step 4: voice speed and volume, background music on or off and its volume, seconds per footage clip, a transition, and subtitle size, colour, outline and height, with word-by-word subtitles, a pop-in effect or a dark box behind the text. Videos can be square (1:1), and AI can write 3 to 12 scenes. In the post kit, tap ★ on a hook to open the video with it (spoken and shown first). Off switch: Settings > AI rules > Nova video settings.'],
    changesVi: ['Video máy chủ của Nova giờ chỉnh được ở bước 4: tốc độ và âm lượng giọng, bật tắt nhạc nền và âm lượng nhạc, số giây mỗi cảnh hình, kiểu chuyển cảnh, cỡ, màu, viền và vị trí phụ đề, phụ đề từng chữ, hiệu ứng nảy chữ hoặc nền tối sau chữ. Có thêm khung vuông 1:1, và AI viết được từ 3 đến 12 cảnh. Trong Bộ đăng bài, bấm ★ ở một hook để video mở đầu bằng câu đó (đọc và hiện chữ trước tiên). Tắt trong Cài đặt > Luật AI > Chỉnh video Nova.'],
  },
  {
    version: '1.51.0',
    date: '2026-10-23',
    changes: ['Nova\'s post kit is now fully adjustable: 1 to 10 hooks and 1 to 10 titles, a caption for each of TikTok, Instagram, YouTube and Facebook, 0 to 15 hashtags, a tone (curious, friendly, bold, calm, funny, expert), short, medium or long captions, emoji and call to action on or off, and English, Vietnamese or both. It is filled from your script at once with no AI; "Write the post kit with AI" writes better ones. Edit any line, tap ↻ to rewrite just that one, and copy each caption with its hashtags. Off switch: Settings > AI rules > Nova post kit.'],
    changesVi: ['Bộ đăng bài của Nova giờ tùy chỉnh hết được: 1 đến 10 hook và 1 đến 10 tiêu đề, caption riêng cho TikTok, Instagram, YouTube và Facebook, 0 đến 15 hashtag, giọng văn (tò mò, thân thiện, mạnh mẽ, nhẹ nhàng, hài hước, chuyên gia), caption ngắn, vừa hoặc dài, bật tắt emoji và câu kêu gọi, tiếng Việt, tiếng Anh hoặc cả hai. Có sẵn ngay từ kịch bản, không cần AI; bấm "AI viết bộ đăng bài" để có bản hay hơn. Sửa được từng dòng, bấm ↻ để viết lại riêng dòng đó, và copy caption kèm hashtag. Tắt trong Cài đặt > Luật AI > Bộ đăng bài Nova.'],
  },
  {
    version: '1.50.0',
    date: '2026-10-23',
    changes: [
      'Atlas card on the Hub: tap a symbol in the Kronos 5-day list and, right in the same box, the 7 agents light up one by one, then the forecast line draws after the last 30 real closes, with a shaded band for the usual range. Tap All to go back. Watch only, never traded.',
      'Turn the Atlas card over (the arrows button) to see the council: 7 agents in glass cards round a living brain that breathes, leans toward whoever is speaking and lights up inside while it thinks. Each card shows that agent\'s real vote on today\'s top BUY call, and the verdict sits below. Off switch: Settings > AI rules.',
    ],
    changesVi: [
      'Thẻ Atlas trên Hub: bấm một mã trong danh sách Kronos 5 phiên, ngay trong ô đó 7 agent lần lượt sáng lên, rồi vẽ đường dự báo nối sau 30 giá đóng cửa thật gần nhất, có vùng mờ là biên độ thường gặp. Bấm Tất cả để quay lại. Chỉ theo dõi, không vào lệnh.',
      'Lật thẻ Atlas (nút mũi tên) để xem hội đồng: 7 agent trong thẻ kính mờ quanh bộ não biết thở, nghiêng về agent đang nói và lóe sáng bên trong khi suy nghĩ. Mỗi thẻ hiện phiếu thật của agent cho lệnh MUA tốt nhất hôm nay, kết luận nằm bên dưới. Tắt trong Cài đặt > Quy tắc AI.',
    ],
  },
  {
    version: '1.49.0',
    date: '2026-10-23',
    changes: ['Nova step 1 now shows trending ideas from Google Trends, Google News, YouTube Music, Reddit, and YouTube (with a free YouTube key you can paste right there). Pick VN or US, turn sources on or off, hide sensitive news, block your own words, and choose how many to show. Tap a trend to use it, or press "Pick for me and write" to have Nova choose the hottest one and write the script. TikTok and Facebook have no free feed, so there are quick links to open them. Off switch: Settings > AI rules > Nova trending ideas.'],
    changesVi: ['Bước 1 của Nova giờ có ý tưởng đang hot từ Google Trends, Google News, YouTube Music, Reddit và YouTube (dán key YouTube miễn phí ngay tại đó). Chọn VN hoặc US, bật tắt từng nguồn, ẩn tin nhạy cảm, chặn từ riêng của anh và chọn số lượng hiển thị. Chạm một trend để dùng, hoặc bấm "Tự chọn và viết" để Nova chọn chủ đề hot nhất rồi viết kịch bản. TikTok và Facebook không có nguồn miễn phí nên có nút mở nhanh. Tắt trong Cài đặt > Luật AI > Ý tưởng trending cho Nova.'],
  },
  {
    version: '1.48.0',
    date: '2026-10-23',
    changes: ['Nova now has the Hub\'s liquid glass look and follows the Hub theme (amber, plum or moss). The page is 5 clear steps with a bar that stays on top: Idea, Script, Footage, Voice & make, Post kit. Your server videos sit in their own gallery, and the quick browser preview is marked "no voice" so it is not confused with the real video. Off switch: Settings > AI rules > Nova in the glass look.'],
    changesVi: ['Nova giờ có giao diện kính giống Hub và đổi màu theo theme của Hub (hổ phách, mận hoặc rêu). Trang chia thành 5 bước rõ ràng với thanh bước luôn ở trên: Ý tưởng, Kịch bản, Hình, Giọng & dựng, Bộ đăng bài. Video làm trên máy chủ nằm trong thư viện riêng, còn bản xem thử nhanh trên máy được ghi "không giọng" để khỏi nhầm với video thật. Tắt trong Cài đặt > Luật AI > Nova kiểu kính.'],
  },
  {
    version: '1.47.2',
    date: '2026-10-23',
    changes: ['Hub: the buttons at the bottom of each project card no longer get cut off; swipe the row sideways to see them all. The theme dots are gone from the top bar; change the theme in Settings.'],
    changesVi: ['Hub: hàng nút dưới mỗi thẻ dự án không còn bị cắt chữ; vuốt ngang hàng nút để xem hết. Bỏ 3 chấm theme trên thanh trên cùng; đổi theme trong Cài đặt.'],
  },
  {
    version: '1.47.1',
    date: '2026-10-23',
    changes: ['Fixed: the whole app could show "Cannot read properties of undefined (reading \'en\')" when the practice scanner picked a stock from today\'s top movers. Top losers are now labelled as such, and an unknown pick source shows "the scanner" instead of breaking the page.'],
    changesVi: ['Sửa lỗi: cả app có thể hiện "Cannot read properties of undefined (reading \'en\')" khi máy quét luyện tập chọn một mã trong nhóm biến động mạnh hôm nay. Mã giảm mạnh giờ có nhãn riêng, và nguồn lạ chỉ ghi "máy quét" thay vì làm hỏng trang.'],
  },
  {
    version: '1.47.0',
    date: '2026-10-23',
    changes: [
      'The Hub has a new liquid glass look, like a macOS dashboard: frosted glass panels over a slowly drifting colour wallpaper, a menu bar on top and a dock at the bottom.',
      'Every agent is now a character of their own, each from a different background, holding the tool of their project. They blink, glance around and tilt their head while they think, and each card shows what its agent is thinking, taken from the project\'s real numbers.',
      'Your projects hang on a rail under Neo, each with a moving logo. Tap one to open it. Now and then a card turns over to show its agent at work; turn this off with the dock switch or in Settings > AI rules.',
      'Atlas\'s card shows the real Kronos 5-day forecasts (watch only, never traded) and how each agent votes on today\'s top BUY call.',
      'Three themes: Amber, Plum and Moss. Pick one in Settings or with the dots in the menu bar; the app remembers it. The classic Hub is still there: Settings > AI rules > Liquid glass Hub.',
    ],
    changesVi: [
      'Hub có giao diện kính mờ mới giống dashboard macOS: các tấm kính mờ trên nền màu trôi chậm, thanh menu ở trên và dock ở dưới.',
      'Mỗi agent giờ là một nhân vật riêng, mỗi người một quốc tịch, cầm đồ nghề của dự án mình. Họ chớp mắt, liếc quanh và nghiêng đầu khi suy nghĩ; mỗi thẻ hiện agent đang nghĩ gì, lấy từ số liệu thật của dự án.',
      'Các dự án treo trên một thanh dưới Neo, mỗi cái có logo động. Bấm vào để mở. Thỉnh thoảng một thẻ tự lật để xem agent đang làm việc; tắt bằng nút trên dock hoặc trong Cài đặt > Quy tắc AI.',
      'Thẻ Atlas hiện dự báo 5 phiên thật của Kronos (chỉ theo dõi, không vào lệnh) và cách từng agent bỏ phiếu cho lệnh MUA tốt nhất hôm nay.',
      'Ba theme: Hổ phách, Mận và Rêu. Chọn trong Cài đặt hoặc bấm các chấm trên thanh menu; app nhớ lựa chọn của anh. Hub kiểu cũ vẫn còn: Cài đặt > Quy tắc AI > Hub kính mờ.',
    ],
  },
  {
    version: '1.46.1',
    date: '2026-10-23',
    changes: ['When a part of the app breaks, its error box now also says where it broke, so a screenshot is enough to find and fix it. #iris opens Iris (God\'s Eye).'],
    changesVi: ['Khi một phần của app bị lỗi, khung báo lỗi giờ ghi thêm chỗ bị lỗi, nên chỉ cần chụp màn hình là tìm và sửa được. #iris mở Iris (God\'s Eye).'],
  },
  {
    version: '1.46.0',
    date: '2026-10-23',
    changes: [
      'Ask Neo for code changes. Say "fix the ... button", "add a feature that ..." or "make an app that ...", tap Do it, and Neo files it on GitHub for Claude. About once an hour Claude picks it up and opens a pull request for you to check; nothing in the app changes until you merge. Ask "how are the code tasks?" to hear where each one stands. Uses the same GitHub key saved in Nova. Off switch: Settings > AI rules.',
    ],
    changesVi: [
      'Nhờ Neo sửa code. Nói "sửa lỗi nút ...", "thêm tính năng ..." hay "tạo app ...", bấm Làm đi là Neo ghi việc lên GitHub cho Claude. Khoảng mỗi giờ Claude nhận việc và mở PR để anh duyệt; chưa merge thì app chưa đổi gì. Hỏi "việc code thế nào?" để nghe từng việc tới đâu. Dùng chung key GitHub đã lưu ở Nova. Tắt trong Cài đặt > Luật AI.',
    ],
  },
  {
    version: '1.45.0',
    date: '2026-10-23',
    changes: [
      'Neo can now run hub jobs for you. Say or type "render the Nova videos", "refresh the Iris snapshot", "build the Android app", "run the Kronos test" or "back up the data", tap Do it, and Neo starts it on GitHub with the GitHub key you saved in Nova (step 5). Ask "how did the last runs go?" to hear how each one finished. Only a short safe list can run; nothing deploys or touches money. Off switch: Settings > AI rules.',
    ],
    changesVi: [
      'Neo giờ chạy được việc trong hub cho anh. Nói hoặc gõ "dựng video Nova", "làm mới snapshot Iris", "build app Android", "chạy thử Kronos" hay "sao lưu dữ liệu", bấm Làm đi là Neo chạy trên GitHub bằng key GitHub anh đã lưu ở Nova (bước 5). Hỏi "lần chạy gần nhất thế nào?" để nghe từng việc xong ra sao. Chỉ một danh sách ngắn, an toàn được chạy; không deploy, không đụng tiền. Tắt trong Cài đặt > Luật AI.',
    ],
  },
  {
    version: '1.44.1',
    date: '2026-10-23',
    changes: ['Short links straight into a project: add #nova, #atlas, #echo, #nexus, #argus or #viraltech to the app address. Swiping back still lands on the Hub.'],
    changesVi: ['Link ngắn mở thẳng vào dự án: thêm #nova, #atlas, #echo, #nexus, #argus hoặc #viraltech vào cuối địa chỉ app. Vuốt quay lại vẫn về Hub.'],
  },
  {
    version: '1.44.0',
    date: '2026-10-23',
    changes: [
      'Jarvis is now called Neo, and Neo runs the whole hub. Every project page has its own agent in the floating chat, named after the project: Atlas, Iris (was Argus), Echo, Volt, Nexus, Nova, Viraltech, Lumi and Max (was Forge). Talk or type from any screen: "how is Nova?", "which projects are running?", or "open Iris" goes straight there. Answers come from the app\'s own data. Off switch: Settings > AI rules > Project agents.',
    ],
    changesVi: [
      'Jarvis giờ tên là Neo, và Neo quản lý cả hub. Mỗi trang dự án có agent riêng trong khung chat nổi, mang tên dự án: Atlas, Iris (trước là Argus), Echo, Volt, Nexus, Nova, Viraltech, Lumi và Max (trước là Forge). Nói hoặc gõ ở màn hình nào cũng được: "Nova thế nào?", "các dự án đang ra sao?", hay "mở Iris" là mở ngay. Câu trả lời lấy từ dữ liệu của app. Tắt trong Cài đặt > Luật AI > Agent từng dự án.',
    ],
  },
  {
    version: '1.43.0',
    date: '2026-10-23',
    changes: [
      'Nova step 5 has a "GitHub key" box. With the key saved, "Make with voice" starts the render farm at once, so the video is ready in about 5 to 10 minutes instead of waiting hours for GitHub\'s timer. The card shows the phone steps to make the key; it only lets Nova start the render, nothing else.',
    ],
    changesVi: [
      'Nova bước 5 có ô "Key GitHub". Lưu key rồi thì bấm "Tạo video có giọng" là máy render chạy ngay, khoảng 5 đến 10 phút có video thay vì chờ đồng hồ GitHub vài giờ. Thẻ có sẵn các bước làm key trên điện thoại; key chỉ cho Nova bật máy render, không làm gì khác.',
    ],
  },
  {
    version: '1.42.0',
    date: '2026-10-23',
    changes: [
      'Nova step 5, "Make with voice": your script becomes a real video on a free render server (MoneyPrinterTurbo on GitHub). It has a natural Vietnamese or English voice, pictures that match the script, background music and subtitles burned in. Pick VI, EN or both, and a female or male voice.',
      'The video shows up in Nova 5 to 20 minutes later, ready to play and download; you can close the app meanwhile. Nova keeps the 12 newest videos.',
      'Pictures come from free public-domain photos with a slow zoom. Paste a free Pexels key in the same card to get real video clips instead.',
    ],
    changesVi: [
      'Nova có bước 5 "Tạo video có giọng": kịch bản của anh thành video thật trên máy render miễn phí (MoneyPrinterTurbo trên GitHub). Video có giọng đọc tiếng Việt hoặc tiếng Anh tự nhiên, hình hợp với kịch bản, nhạc nền và phụ đề in sẵn. Chọn VI, EN hoặc cả hai, giọng nữ hoặc nam.',
      'Khoảng 5 đến 20 phút sau video hiện trong Nova, xem và tải về được; trong lúc chờ anh có thể đóng app. Nova giữ 12 video mới nhất.',
      'Hình lấy từ ảnh miễn phí bản quyền mở, có zoom chậm. Dán key Pexels miễn phí vào cùng thẻ đó để có clip video thật.',
    ],
  },
  {
    version: '1.41.1',
    date: '2026-10-23',
    changes: ['On a phone, swiping back from the screen edge (or the Back button) inside a project now returns to the Jarvis Hub instead of closing the app. Switching between Brief, Trading desk and Portfolio does not add extra steps, so one swipe always gets you home.'],
    changesVi: ['Trên điện thoại, vuốt từ mép màn hình để quay lại (hoặc nút Back) trong một dự án giờ về lại Jarvis Hub thay vì thoát app. Chuyển giữa Bản tin, Bàn giao dịch và Danh mục không thêm bước, nên vuốt một lần là về Hub.'],
  },
  {
    version: '1.41.0',
    date: '2026-10-23',
    changes: [
      'Atlas Telegram alerts are shorter and in Vietnamese: buys show size, target and stop with their %, and why the stock was picked; sells lead with WIN or LOSS, the P&L and why it closed.',
      'A daily summary goes to Telegram after the US close: net result, wins and losses, each trade with why it closed, the lessons of the day, and the learner and brake status.',
    ],
    changesVi: [
      'Tin Telegram của Atlas ngắn gọn hơn và bằng tiếng Việt: lệnh mua ghi số lượng, chốt lời, cắt lỗ kèm %, và lý do chọn mã; lệnh bán ghi THẮNG hay THUA, lời lỗ và lý do đóng.',
      'Mỗi ngày sau khi thị trường Mỹ đóng cửa, Telegram nhận một bản tổng kết: kết quả ròng, số lệnh thắng thua, từng lệnh và lý do đóng, bài học trong ngày, trạng thái tự học và phanh.',
    ],
  },
  {
    version: '1.40.0',
    date: '2026-10-23',
    changes: [
      'New main page: the Jarvis Hub. Every project has its own card with its live state (Atlas, Argus, Echo, Volt, Nexus, Nova, Viraltech, Lumi, Forge). Tap a card to open the project, or tap a quick link on it.',
      'A search bar at the top opens any project or tool straight away: type "wifi", "flash" or "Nova" (Vietnamese works too, with or without accents). On a computer, press / to jump to it.',
      'Atlas (the stock predictor: Brief, Trading desk, Portfolio) is now one project in the Hub, with a Hub button to go back. The old Tool Hub graph is gone; its search lives on in the Hub. Settings > AI rules can switch the Hub off to open Atlas first.',
    ],
    changesVi: [
      'Trang chính mới: Jarvis Hub. Mỗi dự án có một thẻ riêng với trạng thái thật (Atlas, Argus, Echo, Volt, Nexus, Nova, Viraltech, Lumi, Forge). Bấm vào thẻ để mở dự án, hoặc bấm link nhanh trên thẻ.',
      'Ô tìm ở trên cùng mở ngay dự án hay công cụ nào: gõ "wifi", "nạp firmware" hay "Nova" (gõ tiếng Việt có dấu hay không dấu đều được). Trên máy tính, bấm / để nhảy vào ô tìm.',
      'Atlas (dự đoán cổ phiếu: Bản tin, Bàn giao dịch, Danh mục) giờ là một dự án trong Hub, có nút Hub để quay lại. Đồ thị Tool Hub cũ đã bỏ; phần tìm kiếm của nó nằm trong Hub. Cài đặt > Quy tắc AI có thể tắt Hub để mở Atlas trước.',
    ],
  },
  {
    version: '1.39.0',
    date: '2026-10-23',
    changes: [
      'Viraltech on the Hub: a new project card shows how many of the 4 Viraltech channels are connected and how many posts are scheduled or posted. Tap it to open the Viraltech page.',
      'The Viraltech page lists Instagram, YouTube, TikTok and Facebook with a link to each, plus every post with its views and interactions. Data comes from Antwork; Claude refreshes it, and the page says when.',
    ],
    changesVi: [
      'Viraltech trên Hub: thẻ dự án mới cho biết bao nhiêu kênh trong 4 kênh Viraltech đã kết nối và bao nhiêu bài đã lên lịch hoặc đã đăng. Bấm vào để mở trang Viraltech.',
      'Trang Viraltech liệt kê Instagram, YouTube, TikTok và Facebook kèm link từng kênh, cùng mọi bài đăng với lượt xem và tương tác. Dữ liệu lấy từ Antwork; Claude cập nhật, và trang ghi rõ lúc cập nhật.',
    ],
  },
  {
    version: '1.38.0',
    date: '2026-10-23',
    changes: ["Argus aircraft now have two backups: live through your home PC when the home agent and tunnel are on, and a snapshot GitHub takes about every 10 minutes when the PC is off (about 6,000 aircraft over 32 busy areas, plus military). Moving to a Mac: agent/README.md has the steps and a script that starts the agent by itself."],
    changesVi: ["Máy bay trên Argus giờ có hai đường dự phòng: thời gian thực qua máy nhà khi chương trình máy nhà và tunnel đang chạy, và ảnh chụp GitHub làm khoảng 10 phút một lần khi máy tắt (khoảng 6.000 máy bay ở 32 vùng đông, cộng máy bay quân sự). Chuyển sang Mac: agent/README.md có các bước và script tự bật chương trình máy nhà."],
  },
  {
    version: '1.37.0',
    date: '2026-10-22',
    changes: ["Argus now runs on your own Cloudflare as the argus Worker, built from the original God's Eye View repo at a pinned commit, with no keys and no debug routes (the old link was someone else's site). Satellites (orbits refreshed every 2 hours) and earthquakes work. Live aircraft come from free feeds (adsb.lol, adsb.fi, OpenSky) that often refuse Cloudflare's servers; when they do, the layer says which feed refused."],
    changesVi: ["Argus giờ chạy trên Cloudflare của anh thành Worker argus, build từ repo God's Eye View gốc ở commit đã ghim, không key, không đường debug (link cũ là trang của người khác). Vệ tinh (quỹ đạo cập nhật mỗi 2 giờ) và động đất chạy được. Máy bay trực tiếp lấy từ nguồn miễn phí (adsb.lol, adsb.fi, OpenSky) hay từ chối máy chủ Cloudflare; khi đó lớp này ghi rõ nguồn nào từ chối."],
  },
  {
    version: '1.36.0',
    date: '2026-10-22',
    changes: [
      'Tabs feel smoother: the highlight slides to the tab you pick (top menu, chart timeframes, the right-panel tabs, Practice sub-tabs, language and other switches) instead of jumping.',
      'Cards on the Hub lift a little with a soft shadow when you hover them, and buttons and tabs press in slightly when you click.',
      'Off with "reduce motion" on your device or Settings > AI rules > Dashboard cards and motion (tabs and cards look exactly as before).',
    ],
    changesVi: [
      'Tab mượt hơn: ô sáng trượt sang tab bạn chọn (menu trên cùng, khung thời gian biểu đồ, tab bảng phải, tab con Luyện tập, ngôn ngữ và các nút gạt khác) thay vì nhảy.',
      'Thẻ trên Hub nhích lên một chút với bóng mờ khi rê chuột, và nút, tab hơi lún xuống khi bấm.',
      'Tắt bằng "giảm chuyển động" trên thiết bị hoặc Cài đặt > Quy tắc AI > Thẻ và hiệu ứng dashboard (tab và thẻ trở lại y như cũ).',
    ],
  },
  {
    version: '1.35.0',
    date: '2026-10-22',
    changes: [
      'New on the Hub: Recent activity. The newest practice trades, logged AI decisions and learner notes in one feed, each with a round icon for its type (buy, sell, skip, accepted, rejected, lesson) and how long ago it happened.',
      'The Practice tab\'s Activity list uses the same feed, and the Decision log gets the same accepted / rejected icons. New items slide in from the top.',
      'Off with Settings > AI rules > Dashboard cards and motion (the old lists come back).',
    ],
    changesVi: [
      'Mới trên Hub: Hoạt động gần đây. Lệnh luyện tập, quyết định AI đã ghi và bài học mới nhất gom vào một dòng, mỗi mục có biểu tượng tròn theo loại (mua, bán, bỏ qua, chấp nhận, từ chối, bài học) và cách đây bao lâu.',
      'Danh sách Hoạt động trong tab Luyện tập dùng cùng kiểu này, và Nhật ký quyết định có biểu tượng chấp nhận / từ chối. Mục mới trượt vào từ trên.',
      'Tắt trong Cài đặt > Quy tắc AI > Thẻ và hiệu ứng dashboard (danh sách cũ quay lại).',
    ],
  },
  {
    version: '1.34.0',
    date: '2026-10-22',
    changes: [
      'Charts draw themselves when they appear: the Portfolio equity curve draws left to right with its fill fading in (again when you switch 1D / 1M / 3M), the Tool Hub graph draws its lines out from Jarvis, and watchlist sparklines and the practice equity curve draw in.',
      'The Portfolio equity curve has a dark bubble that follows your cursor with the value and time. Bars (invested share, Trade Score, confidence) grow from the left.',
      'Argus now has its own card (globe icon) in the Hub\'s project row, and the row stays on one line on wide screens.',
      'Off with "reduce motion" on your device or Settings > AI rules > Dashboard cards and motion.',
    ],
    changesVi: [
      'Biểu đồ tự vẽ khi hiện ra: đường tài sản ở Danh mục vẽ từ trái sang phải và vùng tô hiện dần (vẽ lại khi đổi 1D / 1M / 3M), đồ thị Tool Hub vẽ đường tỏa ra từ Jarvis, sparkline trong danh sách theo dõi và đường tài sản luyện tập cũng tự vẽ.',
      'Đường tài sản ở Danh mục có bong bóng tối đi theo con trỏ, hiện giá trị và thời gian. Các thanh (phần đã đầu tư, Điểm GD, độ tin cậy) mọc từ trái sang.',
      'Argus giờ có thẻ riêng (biểu tượng quả địa cầu) trong hàng thẻ dự án trên Hub, và hàng thẻ nằm gọn một dòng trên màn hình rộng.',
      'Tắt khi máy bật "giảm chuyển động" hoặc trong Cài đặt > Quy tắc AI > Thẻ và hiệu ứng dashboard.',
    ],
  },
  {
    version: '1.33.0',
    date: '2026-10-22',
    changes: [
      "New in the Hub: Argus (God's Eye View). Your live 3D globe opens inside the app, with a status for every data layer checked from the server (flights, military aircraft, satellites, ships, earthquakes), so a dead layer says why instead of staying empty.",
      'New in the Hub: Nova (Video Studio). Bilingual faceless videos made in your browser: Faceless, Philosophy and My Trip modes, EN and VI scripts written separately (AI with your free Gemini or Groq key, or the built-in library), no watermark, voice off by default, generated music at about -24.5 LUFS, smooth 0.7 s transitions, MP4 1080x1920 or 1920x1080 at 30 fps in BT.709 limited range, and a Title Lab to copy titles, hashtags and captions. It never posts by itself.',
      'ESP32-DIV is now in the ESP32 Lab group. Both new pages have their own switch in Settings > AI rules.',
      'Safety: home actions (Wake-on-LAN, port checks, RuView node changes) are refused unless they come from the app itself.',
    ],
    changesVi: [
      "Mới trong Hub: Argus (God's Eye View). Quả địa cầu 3D của anh mở ngay trong app, kèm trạng thái từng lớp dữ liệu kiểm tra từ máy chủ (máy bay, quân sự, vệ tinh, tàu biển, động đất); lớp nào chết sẽ nói rõ lý do.",
      'Mới trong Hub: Nova (Video Studio). Video không lộ mặt song ngữ làm ngay trên trình duyệt: chế độ Faceless, Triết lý và Chuyến đi; kịch bản EN và VI viết riêng (AI bằng key Gemini hoặc Groq miễn phí của anh, hoặc thư viện có sẵn); không watermark; giọng đọc mặc định tắt; nhạc nền tự tạo khoảng -24.5 LUFS; chuyển cảnh mượt 0.7 giây; MP4 1080x1920 hoặc 1920x1080, 30 fps, BT.709 limited range; Title Lab để copy tiêu đề, hashtag, caption. Không bao giờ tự đăng.',
      'ESP32-DIV đã vào nhóm ESP32 Lab. Hai trang mới đều có công tắc riêng trong Cài đặt > Quy tắc AI.',
      'An toàn: lệnh ở nhà (đánh thức máy, kiểm tra cổng, sửa node RuView) bị từ chối nếu không đến từ chính app.',
    ],
  },
  {
    version: '1.32.0',
    date: '2026-10-22',
    changes: [
      'While data loads, you now see grey placeholders in the shape of the real layout instead of empty space: the price chart, the watchlist, Market movers, and the Hub\'s best pick and prediction board during the first scan.',
      'Off with Settings > AI rules > Dashboard cards and motion (the shimmer stops with "reduce motion").',
    ],
    changesVi: [
      'Khi đang tải dữ liệu, giờ có khung xám đúng hình bố cục thật thay vì chỗ trống: biểu đồ giá, danh sách theo dõi, Biến động thị trường, và mã tốt nhất cùng bảng dự đoán trên Hub trong lần quét đầu.',
      'Tắt trong Cài đặt > Quy tắc AI > Thẻ và hiệu ứng dashboard (vệt sáng dừng khi máy bật "giảm chuyển động").',
    ],
  },
  {
    version: '1.31.0',
    date: '2026-10-22',
    changes: [
      'Main numbers count up: the first time a card shows a real number (project cards, Portfolio value, Practice tiles, Jarvis Scoreboard), it runs from 0 up to the value in under a second. After that numbers update live as before.',
      'Off with "reduce motion" on your device or Settings > AI rules > Dashboard cards and motion.',
    ],
    changesVi: [
      'Số chính chạy từ 0 lên: lần đầu một thẻ có số thật (thẻ dự án, Giá trị danh mục, ô Luyện tập, Bảng điểm Jarvis), số chạy từ 0 lên đúng giá trị trong chưa tới 1 giây. Sau đó số cập nhật trực tiếp như cũ.',
      'Tắt khi máy bật "giảm chuyển động" hoặc trong Cài đặt > Quy tắc AI > Thẻ và hiệu ứng dashboard.',
    ],
  },
  {
    version: '1.30.0',
    date: '2026-10-22',
    changes: [
      'Pages open smoothly: on the Hub, Portfolio, Wi-Fi, RuView and the Trading desk tabs, cards fade in and rise one after another, once, when the page or tab opens.',
      'Respects "reduce motion" on your device, and turns off with Settings > AI rules > Dashboard cards and motion.',
    ],
    changesVi: [
      'Các trang mở mượt hơn: trên Hub, Danh mục, Wi-Fi, RuView và các tab Bàn giao dịch, các thẻ hiện dần và trượt lên lần lượt, một lần khi mở trang hoặc tab.',
      'Tôn trọng chế độ "giảm chuyển động" của máy, và tắt được trong Cài đặt > Quy tắc AI > Thẻ và hiệu ứng dashboard.',
    ],
  },
  {
    version: '1.29.0',
    date: '2026-10-22',
    changes: [
      'The Hub now opens with a card for each project: Trading, RuView, ESP32 Lab, Network, Build and Studio. Each shows a real number and a coloured status chip, and opens its page when you tap it.',
      'Number boxes on the Hub, Portfolio and Practice tab are now clearer cards: small label, big number, and a coloured change chip when the app measures one.',
      'Switch it off in Settings > AI rules > Dashboard cards and motion to get the previous look back.',
    ],
    changesVi: [
      'Hub giờ mở đầu bằng một thẻ cho mỗi dự án: Trading, RuView, ESP32 Lab, Mạng, Xây dựng và Studio. Mỗi thẻ có số thật và chip trạng thái màu, bấm vào là mở đúng trang.',
      'Các ô số trên Hub, Danh mục và tab Luyện tập giờ là thẻ rõ hơn: nhãn nhỏ, số lớn, và chip thay đổi có màu khi ứng dụng có đo con số đó.',
      'Tắt trong Cài đặt > Quy tắc AI > Thẻ và hiệu ứng dashboard để về giao diện trước.',
    ],
  },
  {
    version: '1.28.0',
    date: '2026-10-22',
    changes: [
      'Jarvis OS phase 1: the old scoreboard spot is now a Tool Hub. Tools are grouped (Trading, ESP32 Lab, Network, Build, Studio) and open real pages, links or sections. Search, and a graph or list view that remembers your choice.',
      'Today\'s pick now sits beside the Jarvis scoreboard on the home page.',
      'Flash a board is now in the ESP32 Lab group of the Tool Hub.',
    ],
    changesVi: [
      'Jarvis OS giai đoạn 1: chỗ bảng điểm cũ giờ là Tool Hub. Công cụ được nhóm (Trading, ESP32 Lab, Mạng, Xây dựng, Studio) và mở đúng trang, liên kết hoặc mục. Có tìm kiếm, và chế độ đồ thị hoặc danh sách nhớ lựa chọn của anh.',
      'Mã được chọn hôm nay nằm cạnh bảng điểm Jarvis ở trang chính.',
      'Nạp firmware nằm trong nhóm ESP32 Lab của Tool Hub.',
    ],
  },
  {
    version: '1.27.2',
    date: '2026-10-18',
    changes: ['Jarvis Dev now fits the Surface Pro 11 (Windows 11 on ARM): it installs the local AI coder (Aider) in its own Python environment and uses the x64 Python when needed, with the exact command to paste if anything is missing.'],
    changesVi: ['Jarvis Dev giờ hợp với Surface Pro 11 (Windows 11 ARM): cài AI viết code trên máy (Aider) trong môi trường Python riêng, dùng Python bản x64 khi cần, và đưa đúng lệnh để dán nếu thiếu gì.'],
  },
  {
    version: '1.27.1',
    date: '2026-10-18',
    changes: [
      'New: Jarvis Dev, a way to fix and upgrade Jarvis on your own PC with no internet, even when Claude is out of quota. Open jarvis.bat and pick from a simple menu: run the app, fix with the local AI (Aider + Ollama qwen3-coder), check, save. Changes are saved on their own branch, never straight to main. Guide: tools/jarvis-dev/README.md.',
      'New: AGENTS.md, the project rules every AI follows (paper trading only, What\'s new in English and Vietnamese, every feature has an off switch).',
    ],
    changesVi: [
      'Mới: Jarvis Dev, cách sửa và nâng cấp Jarvis ngay trên máy anh, không cần mạng, kể cả khi Claude hết lượt. Mở jarvis.bat rồi chọn trong bảng: mở app, sửa bằng AI trên máy (Aider + Ollama qwen3-coder), kiểm tra, lưu. Thay đổi lưu vào nhánh riêng, không bao giờ vào thẳng main. Hướng dẫn: tools/jarvis-dev/README.md.',
      'Mới: AGENTS.md, bộ luật dự án mà AI nào cũng làm theo (chỉ paper trading, What\'s new tiếng Anh và tiếng Việt, tính năng nào cũng có nút tắt).',
    ],
  },
  {
    version: '1.27.0',
    date: '2026-10-18',
    changes: [
      'New: flash an ESP32 board for RuView straight from the browser. On a computer with Chrome or Edge, open RuView > Add a node, plug the board in by USB and press "Flash from this browser". Jarvis reads the chip (ESP32-S3 or C6), picks the right pinned RuView file, checks it, then writes it. No Python or command needed.',
      'Boards without RuView firmware (the original ESP32, C3) are refused before anything is written. The command is still there under "Or use a command instead". Switch it off in Settings > AI rules (on by default). Not yet tested on your real boards.',
    ],
    changesVi: [
      'Mới: nạp firmware RuView cho board ESP32 ngay trên trình duyệt. Trên máy tính có Chrome hoặc Edge, mở RuView > Thêm node, cắm board bằng USB rồi bấm "Nạp ngay trên trình duyệt này". Jarvis đọc chip (ESP32-S3 hoặc C6), chọn đúng file RuView đã ghim, kiểm tra, rồi ghi. Không cần Python hay gõ lệnh.',
      'Board không có firmware RuView (ESP32 đời cũ, C3) sẽ bị từ chối trước khi ghi. Lệnh cũ vẫn còn ở mục "Hoặc dùng lệnh". Tắt trong Cài đặt > Quy tắc AI (bật sẵn). Chưa thử trên board thật của anh.',
    ],
  },
  {
    version: '1.26.0',
    date: '2026-10-17',
    changes: [
      'New: Jarvis Android app. It opens this same site and adds Wi-Fi scanning on the phone: at any of your shops or houses, join its Wi-Fi and open "Home network" to see devices, Wi-Fi channels, ping, open ports and Wake-on-LAN. Install guide: android/HUONG-DAN.md.',
      'Each Wi-Fi keeps its own device list on the phone (names, trusted, "new device" flags), so every shop and house is tracked separately.',
      'Android limits: most device makers are hidden (Android 10+), and Location must be on to read Wi-Fi names. Your own Wi-Fi only. Switch it off in Settings > AI rules (on by default).',
    ],
    changesVi: [
      'Mới: app Jarvis cho Android. App mở đúng trang này và thêm quét Wi-Fi trên điện thoại: tới tiệm hay nhà nào của anh, vào Wi-Fi đó, mở "Mạng nhà" để xem thiết bị, kênh Wi-Fi, ping, cổng mở và đánh thức máy. Hướng dẫn cài: android/HUONG-DAN.md.',
      'Mỗi Wi-Fi có danh sách thiết bị riêng trên điện thoại (tên, tin cậy, báo thiết bị mới), nên tiệm và nhà nào cũng được theo dõi riêng.',
      'Giới hạn của Android: đa số thiết bị không hiện hãng (Android 10 trở lên), và phải bật Vị trí để đọc tên Wi-Fi. Chỉ Wi-Fi của anh. Tắt trong Cài đặt > Quy tắc AI (bật sẵn).',
    ],
  },
  {
    version: '1.25.1',
    date: '2026-10-17',
    changes: [
      'New: "Try it with sample data" on the Wi-Fi and RuView pages. When the home PC is not connected, you can still see how each page works, on your phone, from anywhere. The page says clearly that the data is made up, and "Leave sample" goes back.',
      'New: the speed test now runs on your phone or computer when the home PC is not connected, so it measures whatever Wi-Fi you are on, at any shop or house.',
    ],
    changesVi: [
      'Mới: nút "Xem thử với dữ liệu mẫu" trên trang Wi-Fi và trang RuView. Khi chưa kết nối máy nhà, anh vẫn xem được trang chạy thế nào, trên điện thoại, ở đâu cũng được. Trang ghi rõ đây là dữ liệu mẫu, bấm "Thoát dữ liệu mẫu" để quay lại.',
      'Mới: khi chưa kết nối máy nhà, đo tốc độ chạy ngay trên điện thoại hoặc máy tính, đo đúng Wi-Fi anh đang dùng, ở tiệm hay nhà nào cũng được.',
    ],
  },
  {
    version: '1.25.0',
    date: '2026-10-17',
    changes: [
      'New: RuView sensing page (tap "RuView sensing" on the Hub). Shows whether someone is in the room from Wi-Fi signals, no camera, using RuView by rUv run unchanged on your home PC.',
      'Try it without any ESP32: "npm run ruview -- sim" starts RuView with practice data. Switch to "esp32" when your boards arrive. Guide in agent/README.md.',
      'Add a node by USB cable in Chrome or Edge: pick the board, install the pinned RuView firmware, then save Wi-Fi and node number to the board. ESP32-S3 and C6 are supported; the external antenna is listed for the Seeed XIAO C6.',
      'Updates stay in your hands: the RuView version is pinned, a daily check opens a pull request when RuView ships a new one, and you merge it.',
      'Honest numbers on the page: presence about 82% right, pose not usable yet, breathing and heart experimental and not medical. Use it only in your own home with everyone there knowing. Switch it off in Settings > AI rules (on by default).',
    ],
    changesVi: [
      'Mới: trang RuView cảm biến (bấm "RuView cảm biến" trên Hub). Cho biết có người trong phòng hay không bằng sóng Wi-Fi, không cần camera, dùng RuView của rUv chạy nguyên bản trên máy nhà.',
      'Thử ngay không cần ESP32: "npm run ruview -- sim" bật RuView với dữ liệu tập. Khi có board thì đổi sang "esp32". Hướng dẫn trong agent/README.md.',
      'Thêm node qua cáp USB trong Chrome hoặc Edge: chọn board, cài firmware RuView đã chọn, rồi lưu Wi-Fi và số node vào board. Hỗ trợ ESP32-S3 và C6; anten ngoài có cho Seeed XIAO C6.',
      'Cập nhật do anh quyết: bản RuView được giữ cố định, mỗi ngày có kiểm tra và mở pull request khi RuView ra bản mới, anh merge thì mới lên.',
      'Số liệu thật trên trang: biết có người đúng khoảng 82%, tư thế chưa dùng được, nhịp thở và tim còn thử nghiệm, không phải y tế. Chỉ dùng trong nhà anh và mọi người trong nhà đều biết. Tắt trong Cài đặt > Quy tắc AI (bật sẵn).',
    ],
  },
  {
    version: '1.24.0',
    date: '2026-10-17',
    changes: [
      'New: Wi-Fi & Bluetooth page (tap "Home network" on the Hub). Devices on your network with new-device flags, names and trust, Wi-Fi channel chart with a "which channel is quieter" tip, ping, open-port check, Wake-on-LAN, speed test and DNS lookup.',
      'Scans run through a small home agent on your PC (npm run agent; guide in agent/README.md). Online it is reached through a private Cloudflare link; when the PC is off the page shows the last scan.',
      'Bluetooth: pick a nearby device in Chrome or Edge. The full nearby list and lost-device finder come with the ESP32 step.',
      'Your own network only: no tools to attack Wi-Fi, crack passwords or watch other people. Switch it off in Settings > AI rules (on by default).',
    ],
    changesVi: [
      'Mới: trang Wi-Fi và Bluetooth (bấm "Mạng nhà" trên Hub). Thiết bị trong mạng có đánh dấu thiết bị mới, đặt tên và tin cậy, biểu đồ kênh Wi-Fi kèm gợi ý kênh nào vắng hơn, ping, kiểm tra cổng mở, đánh thức máy, đo tốc độ và tra DNS.',
      'Việc quét chạy qua một chương trình nhỏ trên máy nhà (npm run agent; hướng dẫn trong agent/README.md). Khi dùng online thì đi qua một link Cloudflare riêng; khi máy nhà tắt, trang hiện lần quét gần nhất.',
      'Bluetooth: chọn một thiết bị gần đây trong Chrome hoặc Edge. Danh sách đầy đủ và tìm đồ bị lạc sẽ có ở bước ESP32.',
      'Chỉ dùng cho mạng của anh: không có công cụ phá Wi-Fi, bẻ mật khẩu hay theo dõi người khác. Tắt trong Cài đặt > Quy tắc AI (bật sẵn).',
    ],
  },
  {
    version: '1.23.0',
    date: '2026-10-17',
    changes: [
      'New: the top bar speaks Vietnamese too (feed status, "AI says", confidence, buyers, chart switches, data label). Every Hub label now lives in one English and Vietnamese list, and a test fails if a translation is missing.',
      'New: on first visit the app picks Vietnamese when your browser is set to Vietnamese. The VI/EN switch on the Hub and Settings > Language still change it any time.',
    ],
    changesVi: [
      'Mới: thanh trên cùng cũng có tiếng Việt (trạng thái dữ liệu, "AI nói", độ tin cậy, người mua, các nút biểu đồ, nhãn dữ liệu). Mọi chữ trên Hub giờ nằm trong một danh sách Anh và Việt, và có test báo lỗi nếu thiếu bản dịch.',
      'Mới: lần đầu mở app, nếu trình duyệt đang dùng tiếng Việt thì app tự chọn tiếng Việt. Nút VI/EN trên Hub và Cài đặt > Ngôn ngữ vẫn đổi được bất cứ lúc nào.',
    ],
  },
  {
    version: '1.22.0',
    date: '2026-10-17',
    changes: [
      'New: Hub home page. Today\'s best pick sits next to the 6-agent sphere, with what each agent thinks of it (agrees, disagrees or no data). The prediction board shows 6 colored dots per pick, one per agent.',
      'New: Studio (Media Lab, image and video editing, coming soon, plus links to the best outside tools) and "Projects, devices & home network" (ESP32, BayReady, home network, Bluetooth, RuView, coming in the next updates).',
      'New: VI/EN switch at the top of the home page, and a bottom tab bar on phones (Predict, Trading, Studio, Devices).',
      'Signals are still not proven (Jarvis has not beaten SPY). Paper trading only. Turn the Hub off in Settings > AI rules to get the old Jarvis Brief layout (on by default).',
    ],
    changesVi: [
      'Mới: Trang chủ Hub. Mã tốt nhất hôm nay nằm cạnh quả cầu 6 agent, kèm ý kiến của từng agent (đồng ý, không đồng ý hoặc chưa có dữ liệu). Bảng dự đoán có 6 chấm màu cho mỗi mã, mỗi chấm là một agent.',
      'Mới: Studio (Media Lab, sửa hình, sửa video sắp có, cùng link tới các tool tốt nhất bên ngoài) và "Dự án, thiết bị và mạng nhà" (ESP32, BayReady, mạng nhà, Bluetooth, RuView, sẽ có ở các bản sau).',
      'Mới: Nút VI/EN ở đầu trang chủ, và thanh dưới trên điện thoại (Dự đoán, Trading, Studio, Thiết bị).',
      'Tín hiệu vẫn chưa được chứng minh (Jarvis chưa thắng SPY). Chỉ giao dịch tiền ảo. Tắt Hub trong Cài đặt > Quy tắc AI để dùng lại giao diện Jarvis Brief cũ (bật sẵn).',
    ],
  },
  {
    version: '1.21.12',
    date: '2026-10-17',
    changes: [
      'Fixed: Settings now validates Alpaca paper keys (PK prefix only) before saving, preventing live keys from being stored.',
    ],
    changesVi: [
      'Sửa: Cài đặt giờ xác thực key Alpaca paper (chỉ prefix PK) trước lưu, ngăn chặn key live bị lưu.',
    ],
  },
  {
    version: '1.21.11',
    date: '2026-10-17',
    changes: [
      'New: "Potential" list shows stocks with good BUY signals from the AI scanner (sorted by signal score). ⚠️ Signals not proven yet — walk-forward test found no stable edge. Toggle in Settings > AI rules (on by default).',
    ],
    changesVi: [
      'Mới: Danh sách "Tiềm năng" hiển thị cổ phiếu có tín hiệu MUA tốt từ máy quét AI (sắp xếp theo điểm tín hiệu). ⚠️ Tín hiệu chưa được chứng minh — kiểm thử ngoài mẫu không tìm lợi thế ổn định. Bật/tắt trong Cài đặt > Quy tắc AI (bật sẵn).',
    ],
  },
  {
    version: '1.21.9',
    date: '2026-10-17',
    changes: [
      'Fixed: "Check all keys" now runs all provider checks in parallel and finishes in under 10 seconds instead of hanging. Timeouts are now shown for any provider that takes too long.',
    ],
    changesVi: [
      'Sửa: "Kiểm tra tất cả key" giờ chạy tất cả provider check song song và kết thúc trong 10 giây thay vì bị treo. Các timeout giờ hiển thị cho provider nào mất quá lâu.',
    ],
  },
  {
    version: '1.21.8',
    date: '2026-10-17',
    changes: [
      'New: Settings for Jarvis and AI rules now save to Cloudflare, so they stay the same after every build and sync across your devices.',
      'New: More features are on by default now: Jarvis speaks your briefing aloud, chart follows your practice trades, Jarvis Brief has free AI help.',
      'New: Voice narration for trade explanations (browser voice, no API key needed).',
      'New: Telegram alerts work when you add your bot token in Settings.',
    ],
    changesVi: [
      'Mới: Cài đặt Jarvis và quy tắc AI giờ lưu vào Cloudflare, nên chúng ở lại sau mỗi build và đồng bộ giữa các thiết bị.',
      'Mới: Nhiều tính năng bật sẵn giờ: Jarvis nói bản tin của bạn to, biểu đồ theo lệnh luyện tập, Jarvis Brief có AI miễn phí.',
      'Mới: Đọc to giải thích lệnh (giọng trình duyệt, không cần key API).',
      'Mới: Cảnh báo Telegram hoạt động khi bạn thêm token bot trong Cài đặt.',
    ],
  },
  {
    version: '1.21.7',
    date: '2026-10-17',
    changes: [
      'Auto-migrate: Alpaca paper, Alpha Vantage, and Finnhub keys stored in your browser are now automatically uploaded to Cloudflare on first load, so you only need to open the app once on each computer.',
    ],
    changesVi: [
      'Tự động di chuyển: key Alpaca paper, Alpha Vantage, và Finnhub lưu trong trình duyệt giờ tự động tải lên Cloudflare lần đầu tiên, nên bạn chỉ cần mở app một lần trên mỗi máy tính.',
    ],
  },
  {
    version: '1.21.6',
    date: '2026-10-17',
    changes: [
      'Changed: Alpaca paper, Alpha Vantage, and Finnhub keys are now saved to Cloudflare so they sync across devices and browsers. No more re-entering on each device.',
    ],
    changesVi: [
      'Đã thay đổi: key Alpaca paper, Alpha Vantage, và Finnhub giờ lưu vào Cloudflare để đồng bộ giữa các thiết bị và trình duyệt. Không cần nhập lại trên mỗi thiết bị.',
    ],
  },
  {
    version: '1.21.5',
    date: '2026-10-17',
    changes: [
      'New: Check all API keys button in Settings. Shows which keys are set and which ones work, so you know which data sources are ready to go.',
    ],
    changesVi: [
      'Mới: nút kiểm tra hết key API trong Cài đặt. Hiện key nào được set và key nào work, để bạn biết nguồn dữ liệu nào đã sẵn sàng.',
    ],
  },
  {
    version: '1.21.4',
    date: '2026-10-17',
    changes: [
      'Fixed: Alpaca news endpoint now uses the correct API version (v1beta1 instead of v1beta3) and shows error details instead of silently returning empty when the upstream call fails, so problems are easier to diagnose.',
    ],
    changesVi: [
      'Đã sửa: endpoint tin Alpaca giờ dùng phiên bản API đúng (v1beta1 thay vì v1beta3) và hiện chi tiết lỗi thay vì câm lặng khi gọi upstream thất bại, để dễ chẩn đoán vấn đề.',
    ],
  },
  {
    version: '1.21.3',
    date: '2026-10-17',
    changes: [
      'Fixed: Alpaca news feed now displays after you add your API key ID and secret as Worker secrets.',
    ],
    changesVi: [
      'Đã sửa: nguồn tin Alpaca giờ hiện sau khi bạn thêm key ID và secret vào Worker secrets.',
    ],
  },
  {
    version: '1.21.2',
    date: '2026-10-16',
    changes: [
      'Settings modal is now scrollable so you can reach the Save button and Jarvis AI Trading toggles, even on phones.',
    ],
    changesVi: [
      'Modal cài đặt giờ có thể cuộn nên bạn tới được nút Lưu và các công tắc Giao dịch Jarvis, ngay cả trên điện thoại.',
    ],
  },
  {
    version: '1.21.1',
    date: '2026-10-16',
    changes: [
      'No more black screen: if one part of the app (chart, watchlist, positions, a right-hand tab) hits an error, only that part shows the error with a "Try again" button; the rest keeps working. Picking another stock retries it on its own.',
      'Fixed an endless refresh loop in the Brief news box that could freeze the page.',
    ],
    changesVi: [
      'Hết màn hình đen: nếu một phần của app (biểu đồ, watchlist, bảng vị thế, tab bên phải) bị lỗi, chỉ phần đó hiện lỗi với nút "Thử lại", phần còn lại vẫn chạy. Chọn mã khác thì nó tự thử lại.',
      'Sửa vòng lặp làm mới vô tận trong ô tin tức của Bản tin, có thể làm treo trang.',
    ],
  },
  {
    version: '1.21.0',
    date: '2026-10-16',
    changes: [
      'Jarvis learns from more stocks: 24/7 learning now also studies the stocks the scanner found today (movers, penny, mid caps), up to 40 extra a cycle, not only your watchlist. Free data only, no AI quota. Toggle: Settings > AI rules > "Auto learning also studies the stocks the scanner found".',
      'The useful features are now on by default, also in browsers that saved older settings: 24/7 learning, practice with auto pick, movers, penny stocks, server practice, signal check, AI-written Brief and news. You can still switch any of them off.',
      'AI scan moved into the watchlist: one "AI scan this list" button checks the rows you see (your list or Top gainers, Most active and so on), and each row shows BUY / HOLD / SELL. The separate AI Picks tab on the right is hidden (Settings > AI rules can bring it back).',
      'The Alpaca paper key can now be entered in Settings too, without leaving the trading screen.',
    ],
    changesVi: [
      'Jarvis học từ nhiều mã hơn: tự học 24/7 giờ học cả các mã máy quét tìm thấy hôm nay (tăng mạnh, penny, mid cap), thêm tối đa 40 mã mỗi vòng, không chỉ watchlist. Chỉ dùng dữ liệu miễn phí, không tốn quota AI. Nút bật/tắt: Cài đặt > Quy tắc AI.',
      'Các tính năng hữu ích giờ được bật sẵn, kể cả trên trình duyệt đã lưu cài đặt cũ: tự học 24/7, luyện tập tự chọn mã, mã tăng mạnh, penny, luyện tập trên máy chủ, kiểm tra tín hiệu, AI viết bản tin và tin tức. Anh vẫn tắt được bất kỳ cái nào.',
      'Nút AI quét chuyển vào watchlist: bấm "AI quét danh sách này" để kiểm tra các dòng đang thấy (danh sách của anh hoặc Top tăng, Giao dịch nhất...), mỗi dòng hiện MUA / GIỮ / BÁN. Tab AI Picks bên phải được ẩn (bật lại trong Cài đặt > Quy tắc AI).',
      'Key Alpaca paper giờ nhập được ngay trong Cài đặt, không cần rời màn hình giao dịch.',
    ],
  },
  {
    version: '1.20.1',
    date: '2026-10-16',
    changes: [
      'AI keys: Test button now shows the working model name (e.g. "Dùng được (gemini-2.5-flash)") and exact error details, never silent. Settings > Jarvis AI Trading explains why the three Phase 2 features are disabled until research validates them.',
    ],
    changesVi: [
      'Khóa AI: nút Thử giờ hiện tên mô hình hoạt động (ví dụ "Dùng được (gemini-2.5-flash)") và chi tiết lỗi chính xác, không bao giờ im lặng. Cài đặt > Giao dịch AI của Jarvis giải thích tại sao ba tính năng Phase 2 bị tắt cho đến khi nghiên cứu xác nhận.',
    ],
  },
  {
    version: '1.20.0',
    date: '2026-10-16',
    changes: [
      'Scoreboard: signal quality metrics. The Jarvis scoreboard now shows expectancy per trade (the mathematical expected value of each trade after win rate, avg win and avg loss) and max drawdown (the worst peak-to-trough decline). Two new toggles in Settings > AI rules let you monitor these daily to assess whether signals have genuine edge or are trading underwater.',
    ],
    changesVi: [
      'Bảng điểm: chỉ số chất lượng tín hiệu. Bảng điểm Jarvis giờ hiện kỳ vọng trên mỗi lệnh (giá trị kỳ vọng toán học sau khi xét tỉ lệ thắng, lãi trung bình và lỗ trung bình) và rủi ro tối đa (mức giảm tệ nhất từ đỉnh xuống). Hai công tắc mới trong Cài đặt > Quy tắc AI giúp theo dõi hàng ngày để đánh giá tín hiệu có cạnh thật hay đang giao dịch dưới nước.',
    ],
  },
  {
    version: '1.19.3',
    date: '2026-10-16',
    changes: [
      'Cleaner Telegram trade messages: a "Jarvis · PAPER TRADE" header, then action, symbol, quantity and price, stop and target, a short reason, and the time in US Eastern and Vietnam time. Short enough to read on a phone.',
    ],
    changesVi: [
      'Tin Telegram gọn và chuyên nghiệp hơn: tiêu đề "Jarvis · PAPER TRADE", rồi lệnh mua/bán, mã, số lượng, giá, cắt lỗ, chốt lời, lý do ngắn, và giờ Mỹ (ET) cùng giờ Việt Nam. Đủ ngắn để đọc trên điện thoại.',
    ],
  },
  {
    version: '1.19.2',
    date: '2026-10-16',
    changes: [
      'Telegram now alerts on every practice trade: each buy and each sell (with profit or loss and the reason). It runs on the server every 5 minutes, so it works even when the app is closed. Messages are plain text so a symbol or reason can never make Telegram drop one.',
    ],
    changesVi: [
      'Telegram giờ báo mọi lệnh thực hành: mỗi lệnh mua và mỗi lệnh bán (kèm lời/lỗ và lý do). Chạy trên server mỗi 5 phút nên vẫn báo khi đóng app. Tin nhắn là chữ thường để Telegram không bao giờ bỏ tin vì ký tự đặc biệt.',
    ],
  },
  {
    version: '1.19.1',
    date: '2026-10-16',
    changes: [
      'Telegram Save now checks your token with Telegram first. A wrong or mistyped token is rejected with a clear message instead of failing later at Send test, and a good token shows your bot name.',
    ],
    changesVi: [
      'Nút Lưu Telegram giờ kiểm tra token với Telegram trước. Token sai hoặc gõ nhầm sẽ báo lỗi rõ ràng ngay, không đợi tới lúc Gửi tin thử; token đúng sẽ hiện tên bot.',
    ],
  },
  {
    version: '1.19.0',
    date: '2026-10-16',
    changes: [
      'Telegram test message: press "Send test" in Settings > AI rules > Telegram Configuration to send a test message. You will see success or Telegram\'s error message (for example "HTTP 401: Invalid token"). This lets you verify your settings before trading alerts start.',
    ],
    changesVi: [
      'Tin Telegram thử: bấm "Gửi tin thử" trong Cài đặt > Quy tắc AI > Cấu hình Telegram để gửi tin test. Bạn sẽ thấy thành công hoặc lỗi của Telegram (ví dụ "HTTP 401: Invalid token"). Cách này kiểm tra cài đặt trước khi cảnh báo giao dịch bắt đầu.',
    ],
  },
  {
    version: '1.18.0',
    date: '2026-10-16',
    changes: [
      'Telegram Bot: receive trade alerts instantly on Telegram (in addition to in-app alerts). Create a bot with BotFather, enter token and Chat ID in Settings > AI rules > Telegram Configuration. Alerts include symbol, side, entry, stop, target, and reason. Free.',
    ],
    changesVi: [
      'Telegram Bot: nhận cảnh báo giao dịch ngay lập tức trên Telegram (thêm vào thông báo trong app). Tạo bot với BotFather, nhập token và Chat ID trong Cài đặt > Quy tắc AI > Cấu hình Telegram. Cảnh báo gồm mã, mua/bán, vào, cắt lỗ, chốt lời, lý do. Miễn phí.',
    ],
  },
  {
    version: '1.17.0',
    date: '2026-10-16',
    changes: [
      'Trade alerts: Jarvis notifies you before placing a practice trade with symbol, side (BUY), entry price, stop loss, take profit, and reason. Each alert appears in the app and can be dismissed. Toggle in Settings > AI rules.',
    ],
    changesVi: [
      'Thông báo trước lệnh: Jarvis báo trước khi đặt lệnh luyện tập, với mã, mua/bán (MUA), giá vào, cắt lỗ, chốt lời, lý do. Mỗi thông báo hiện trong app, bấm X để đóng. Tắt/bật trong Cài đặt > Quy tắc AI.',
    ],
  },
  {
    version: '1.16.0',
    date: '2026-10-16',
    changes: [
      'Estimated order flow: when live trade data is unavailable, the app estimates buyers vs. sellers from delayed candle data. Toggle in Settings > AI rules. Estimates are never used for trading signals.',
      'Jarvis Brief now shows when order flow is estimated, so you know the data is delayed.',
    ],
    changesVi: [
      'Dòng lệnh ước tính: khi không có dữ liệu lệnh trực tiếp, ứng dụng ước tính bên mua so với bên bán từ dữ liệu nến bị trễ. Tắt/bật trong Cài đặt > Quy tắc AI. Ước tính không bao giờ được dùng cho tín hiệu giao dịch.',
      'Bản tin Jarvis giờ hiện khi dòng lệnh là ước tính, để bạn biết dữ liệu bị trễ.',
    ],
  },
  {
    version: '1.15.0',
    date: '2026-10-16',
    changes: [
      "Jarvis's Scoreboard now compares Jarvis with simply buying and holding SPY over the same time (closed plus open trades, after costs), and says whether Jarvis is ahead or behind.",
      'Scoreboard: new Open P&L box for trades still open, using live prices or the server\'s last prices. Before, the board showed only zeros until the first trade closed.',
      'The server practice account now saves after every 5-minute scan, so "Last scan" and open P&L stay fresh. Turn the comparison off in Settings > AI rules.',
    ],
    changesVi: [
      'Bảng điểm Jarvis giờ so Jarvis với việc chỉ mua giữ SPY trong cùng khoảng thời gian (gồm lệnh đã đóng và đang mở, đã trừ phí), và cho biết Jarvis đang hơn hay thua.',
      'Bảng điểm: thêm ô Lãi/lỗ đang mở cho các lệnh còn mở, dùng giá trực tiếp hoặc giá máy chủ thấy lần cuối. Trước đây bảng chỉ toàn số 0 cho tới khi có lệnh đầu tiên đóng.',
      'Tài khoản luyện tập trên máy chủ giờ lưu sau mỗi lần quét 5 phút, nên "Lần quét cuối" và lãi/lỗ đang mở luôn mới. Tắt phần so sánh trong Cài đặt > Quy tắc AI.',
    ],
  },
  {
    version: '1.14.1',
    date: '2026-10-16',
    changes: [
      'Free AI keys: the Test button now shows what the AI service actually said (for example "HTTP 401: Invalid API Key") and what to do next, instead of one general message.',
      'Fixed: NVIDIA keys always failed because NVIDIA retired the model the app used (Llama 3.3 70B, end of life 2026-08-26). Each AI helper now has backup models and moves to the next one when a model is retired.',
    ],
    changesVi: [
      'Khóa AI miễn phí: nút Thử giờ hiện đúng câu trả lời của dịch vụ AI (ví dụ "HTTP 401: Invalid API Key") và việc cần làm tiếp, thay vì một câu báo lỗi chung.',
      'Đã sửa: khóa NVIDIA luôn báo lỗi vì NVIDIA đã ngừng mẫu AI mà app dùng (Llama 3.3 70B, ngừng từ 26/08/2026). Mỗi dịch vụ AI giờ có mẫu dự phòng và tự chuyển sang mẫu kế tiếp khi một mẫu bị ngừng.',
    ],
  },
  {
    version: '1.14.0',
    date: '2026-10-16',
    changes: [
      'Fixed: the 5-minute server practice only ran a few times a day (its schedule said "every 5th hour, days 13-21 of the month"). It now runs every 5 minutes in US market hours.',
      'Chart ranges work like Webull: 1D, 5D, 1M, 3M, 1Y and All each pick the right candle size (1D = 5-minute, 5D = 15-minute, 1M = 1-hour, 3M = 4-hour, 1Y and All = daily) and zoom to that window. Older bars stay loaded, so you can scroll back. Toggle: Settings > AI rules > "Chart ranges pick the bar size".',
      'Resizable panels: drag the edge of the watchlist, the right panel or the bottom bar. Sizes scale with the window and are remembered; double-click an edge to go back to auto. Toggle: Settings > AI rules > "Resizable panels".',
      'Jarvis Brief scoreboard: P&L, win rate, average win and loss, and your recent practice trades with the reason for each.',
      'Scan times older than today now show the date, so an old scan no longer looks like today\'s.',
      'Fixed: some lessons in Brain > Lessons were squashed into a tiny column with overlapping text.',
    ],
    changesVi: [
      'Đã sửa: luyện tập 5 phút trên máy chủ chỉ chạy vài lần mỗi ngày (lịch ghi nhầm "mỗi 5 giờ, ngày 13-21 trong tháng"). Giờ chạy đúng mỗi 5 phút trong giờ thị trường Mỹ.',
      'Khoảng biểu đồ giống Webull: 1D, 5D, 1M, 3M, 1Y và All tự chọn cỡ nến phù hợp (1D = 5 phút, 5D = 15 phút, 1M = 1 giờ, 3M = 4 giờ, 1Y và All = ngày) và phóng to đúng khoảng đó. Nến cũ vẫn còn để kéo xem lại. Bật/tắt: Cài đặt > Quy tắc AI > "Khoảng biểu đồ tự chọn cỡ nến".',
      'Kéo đổi kích thước khung: kéo mép danh sách theo dõi, khung bên phải hoặc thanh dưới. Kích thước tự co giãn theo cửa sổ và được ghi nhớ; nhấp đúp vào mép để về tự động. Bật/tắt: Cài đặt > Quy tắc AI > "Kéo đổi kích thước khung".',
      'Bảng điểm Jarvis ở trang Bản tin: lãi/lỗ, tỉ lệ thắng, lãi và lỗ trung bình, và các lệnh luyện tập gần đây kèm lý do.',
      'Giờ quét cũ hơn hôm nay giờ có kèm ngày, để lần quét cũ không bị nhầm là của hôm nay.',
      'Đã sửa: một số bài học trong Bộ não > Bài học bị ép thành cột nhỏ, chữ chồng lên nhau.',
    ],
  },
  {
    version: '1.13.0',
    date: '2026-10-16',
    changes: [
      'Free AI keys in Settings: paste a free Gemini, Groq or NVIDIA key into a box, press Test, and Jarvis can use it. Keys are saved on the server (never in the browser), never shown again, and you can remove them any time. Toggle: Settings > AI rules > "Show the free AI key boxes".',
    ],
    changesVi: [
      'Nhập khóa AI miễn phí trong Cài đặt: dán khóa Gemini, Groq hoặc NVIDIA vào ô, bấm Thử, Jarvis sẽ dùng được ngay. Khóa lưu trên máy chủ (không lưu trong trình duyệt), không bao giờ hiện lại, và bạn xóa được bất cứ lúc nào. Bật/tắt: Cài đặt > Quy tắc AI > "Hiện ô nhập khóa AI miễn phí".',
    ],
  },
  {
    version: '1.12.0',
    date: '2026-10-16',
    changes: [
      'Live paper trading via Cloudflare Cron: watch Jarvis trade every 5 minutes in real time from anywhere (phone included). Trades run automatically on the server every 5 minutes during US market hours, even when the app is closed. Toggle: Settings > AI rules > "Practice 24/7 on the server".',
    ],
    changesVi: [
      'Giao dịch giả lập trực tiếp qua Cloudflare Cron: theo dõi Jarvis giao dịch mỗi 5 phút theo thời gian thực từ bất kỳ đâu (cả điện thoại). Lệnh chạy tự động trên máy chủ mỗi 5 phút trong giờ thị trường Mỹ, ngay cả khi tắt ứng dụng. Cài đặt > Quy tắc AI > "Luyện tập 24/7 trên máy chủ".',
    ],
  },
  {
    version: '1.11.0',
    date: '2026-10-16',
    changes: [
      'Local AI explain: Jarvis explains your trades using llama3.2 on your device. No cloud keys needed. Toggle: Settings > AI rules > "Local explain".',
    ],
    changesVi: [
      'AI cục bộ giải thích: Jarvis giải thích giao dịch của bạn dùng llama3.2 trên máy. Không cần key. Cài đặt > Quy tắc AI > "Giải thích cục bộ".',
    ],
  },
  {
    version: '1.10.5',
    date: '2026-10-16',
    changes: ['The AI Brief sticks to the facts: it now says the US market is closed before 9:30 am New York time instead of guessing, and says the stock list is missing when no Alpaca key is set.'],
    changesVi: ['Bản tin AI bám sát dữ liệu: trước 9:30 sáng giờ New York, bản tin nói thị trường Mỹ đang đóng cửa thay vì đoán, và nói chưa có danh sách cổ phiếu khi chưa có key Alpaca.'],
  },
  {
    version: '1.10.4',
    date: '2026-10-16',
    changes: ['Local AI Brief is more patient: a slow model on your computer is no longer cut off each time the market data refreshes, so its Brief now gets through. The browser console (F12) shows [Brief AI] lines that say what it is doing.'],
    changesVi: ['Bản tin AI cục bộ kiên nhẫn hơn: mô hình chạy chậm trên máy bạn không còn bị ngắt mỗi khi dữ liệu thị trường cập nhật, nên bản tin giờ viết xong được. Bảng Console (F12) hiện các dòng [Brief AI] cho biết nó đang làm gì.'],
  },
  {
    version: '1.10.3',
    date: '2026-10-16',
    changes: [
      'Local AI on your computer: turn on "Use local AI" in Settings > AI rules and, when the app runs on your own computer with Ollama open, Jarvis writes the Brief with a model already installed there (it picks one by itself, for example llama3.2). The Brief footer names the model. If Ollama is closed, the Brief falls back to Gemini when Brief AI is on, otherwise to the plain facts.',
      'Auto-rotate API keys toggle added to Settings > AI rules (off by default).',
    ],
    changesVi: [
      'AI cục bộ trên máy bạn: bật "Dùng AI cục bộ" trong Cài đặt > Quy tắc AI. Khi ứng dụng chạy trên máy bạn và Ollama đang mở, Jarvis viết bản tin bằng mô hình đã cài sẵn (tự chọn, ví dụ llama3.2). Dòng cuối bản tin ghi tên mô hình. Nếu Ollama tắt, bản tin dùng Gemini khi AI viết bản tin đang bật, nếu không thì dùng dữ liệu thường.',
      'Thêm nút Xoay khóa API tự động trong Cài đặt > Quy tắc AI (mặc định tắt).',
    ],
  },
  {
    version: '1.10.2',
    date: '2026-10-16',
    changes: [
      'Adjustable time range on the Trading desk chart: When enabled in Settings > AI rules > "Adjustable time range on Trading desk", a custom days input appears next to the preset time buttons (1D, 1W, 1M, 1Y, All). Type any number of days (1 to 3650) to zoom to that exact range. The chart remembers your custom range until you switch to a preset.',
    ],
    changesVi: [
      'Khoảng thời gian điều chỉnh trên Bàn giao dịch: Khi bật trong Cài đặt > Quy tắc AI > "Khoảng thời gian điều chỉnh được trên Bàn giao dịch", một trường nhập ngày tùy chỉnh xuất hiện bên cạnh các nút sẵn (1D, 1W, 1M, 1Y, All). Gõ bất kỳ số ngày nào (1 đến 3650) để zoom đến khoảng chính xác đó. Chart nhớ khoảng tùy chỉnh của bạn cho tới khi bạn chuyển sang nút sẵn.',
    ],
  },
  {
    version: '1.10.1',
    date: '2026-10-16',
    changes: [
      'Understand each signal: tap the ℹ button next to a BUY call to see the 6-step decision flow. Each step (Scan, Filter, Score, Confirm, Risk check, Decision) shows what was checked and whether it passed. Helps you see exactly why a signal was picked.',
      'Plain language signal explanations: Each signal now shows why it was ranked where it is—Trade Score, volume relative to average, today\'s gain, and its source (server scan, browser, or your watchlist).',
      'Ready for tomorrow? A new readiness check shows the status of all six helpers (Scanner, Order flow, Signals, Learner, Risk guard, News) with practical tips to prepare: enable the practice scan, add an Alpaca key, check your internet, set a loss limit.',
    ],
    changesVi: [
      'Hiểu rõ từng tín hiệu: bấm nút ℹ bên cạnh một lệnh MUA để xem dòng quy trình quyết định 6 bước. Mỗi bước (Quét, Lọc, Điểm số, Xác nhận, Kiểm tra rủi ro, Quyết định) cho biết điều được kiểm tra và kết quả. Giúp bạn thấy rõ tại sao một tín hiệu được chọn.',
      'Giải thích tín hiệu bằng lời thường: Mỗi tín hiệu giờ hiện lý do nó được xếp hạng ở đó—Điểm GD, khối lượng so với trung bình, lợi hôm nay, và nguồn (quét máy chủ, trình duyệt, hoặc danh sách của bạn).',
      'Sẵn sàng cho ngày mai? Một kiểm tra sẵn sàng mới cho biết trạng thái của cả sáu trợ lý (Máy quét, Dòng lệnh, Tín hiệu, Tự học, Bảo vệ rủi ro, Tin tức) với những mẹo thực tế để chuẩn bị: bật quét luyện tập, thêm key Alpaca, kiểm tra internet, đặt giới hạn lỗ.',
    ],
  },
  {
    version: '1.10.0',
    date: '2026-10-16',
    changes: [
      'New home page: Jarvis Brief. In the middle is Jarvis\'s "second brain", a turning sphere of memories, with six helpers around it: Scanner, Order flow and News feed data in; Signals, Learner and Risk guard carry results out.',
      'Everything on it is real. Each helper shows its live data (for example "buyers 61% on BTC/USDT"), goes grey and says what is missing when there is no data, and opens the screen with the details when tapped. News is not connected yet and says so.',
      'Fresh picks every day from the whole market: the practice scan now also takes today\'s top crypto gainers and most-traded coins (Binance in the app, CoinGecko on the server), on top of the top US stock gainers and most-traded stocks. Your watchlist is only added on top.',
      'AI Picks can scan "The market" (today\'s live movers, stocks and crypto) or "My list".',
      'The brief at the top is written by your free AI helpers from the page\'s real data, once per scan, and saved until the data changes. If every AI key fails, a plain summary of the same data is shown.',
      'Uses less data: the Brief, the watchlist and AI Picks share one market-list download, nothing refreshes while the tab is hidden, and stock lists pause outside US market hours.',
      'The old screen is now the Trading desk tab, unchanged. Switch the home page off in Settings > AI rules > "Jarvis Brief as the home page". The AI-written brief and the crypto movers have their own switches too.',
    ],
    changesVi: [
      'Trang chủ mới: Jarvis Brief. Ở giữa là "bộ não thứ hai" của Jarvis, một quả cầu ký ức xoay chậm, có sáu trợ lý xung quanh: Máy quét, Dòng lệnh và Tin tức đưa dữ liệu vào; Tín hiệu, Tự học và Bảo vệ rủi ro đưa kết quả ra.',
      'Mọi thứ trên trang đều là dữ liệu thật. Mỗi trợ lý hiện dữ liệu trực tiếp (ví dụ "bên mua 61% ở BTC/USDT"), chuyển xám và nói rõ thiếu gì khi chưa có dữ liệu, và bấm vào sẽ mở màn hình chi tiết. Tin tức chưa kết nối và ghi rõ như vậy.',
      'Lựa chọn mới mỗi ngày từ toàn thị trường: quét luyện tập giờ lấy thêm crypto tăng mạnh và giao dịch nhiều nhất hôm nay (Binance trong ứng dụng, CoinGecko trên máy chủ), bên cạnh cổ phiếu Mỹ tăng mạnh và giao dịch nhiều nhất. Watchlist chỉ được thêm vào, không còn là nguồn duy nhất.',
      'AI Picks có thể quét "Toàn thị trường" (mã biến động trực tiếp hôm nay, cổ phiếu và crypto) hoặc "Danh sách của tôi".',
      'Bản tin ở đầu trang do AI miễn phí của bạn viết từ dữ liệu thật trên trang, mỗi lần quét một lần, và được lưu lại tới khi dữ liệu đổi. Nếu mọi key AI đều lỗi, trang hiện bản tóm tắt thường từ cùng dữ liệu.',
      'Tốn ít dữ liệu hơn: Brief, watchlist và AI Picks dùng chung một lần tải danh sách thị trường, không cập nhật khi tab bị ẩn, và danh sách cổ phiếu tạm dừng ngoài giờ thị trường Mỹ.',
      'Màn hình cũ giờ là tab Bàn giao dịch, giữ nguyên. Tắt trang chủ mới trong Cài đặt > Quy tắc AI > "Jarvis Brief là trang chủ". Bản tin do AI viết và crypto biến động cũng có công tắc riêng.',
    ],
  },
  {
    version: '1.9.2',
    date: '2026-10-16',
    changes: [
      'Last session\'s data now shows when markets are closed, with a timestamp and indicator. Instead of empty lists, you see the most recent quotes and top movers. This keeps trading insights active even during overnight hours or weekends.',
      'New market lists for deeper market insights: Top most active pairs (highest volume) and New highs (prices at their peaks). These join Top gainers, Top losers and Top volume. All update live when markets are open.',
      'Chart now lets you zoom to different periods: 1D, 1W, 1M, 1Y, and All. Buttons at the top of the chart let you focus on intraday moves, weekly trends, or go back to the entire trading history in one tap.',
    ],
    changesVi: [
      'Dữ liệu phiên trước giờ hiện khi thị trường đóng cửa, kèm timestamp và biểu tượng. Thay vì danh sách rỗng, bạn sẽ thấy báo giá mới nhất và những mã đi lên/xuống nhiều nhất. Điều này giữ cho thông tin trading luôn sẵn sàng cả lúc ban đêm hoặc cuối tuần.',
      'Danh sách thị trường mới cho thông tin sâu hơn: Giao dịch nhất (khối lượng cao nhất) và Đỉnh mới (giá ở mức cao nhất). Chúng gia nhập Tăng mạnh nhất, Giảm mạnh nhất và Khối lượng lớn nhất. Tất cả cập nhật trực tiếp khi thị trường mở cửa.',
      'Chart giờ cho phép zoom các kỳ khác nhau: 1D, 1W, 1M, 1Y, và All. Nút ở trên cùng chart để bạn tập trung vào biến động trong ngày, xu hướng hàng tuần, hoặc quay lại toàn bộ lịch sử giao dịch chỉ bằng một chạm.',
    ],
  },
  {
    version: '1.9.1',
    date: '2026-10-16',
    changes: [
      'Top gainers, Top losers and Top volume now come from the whole market, live, refreshed every minute. Before, they only re-sorted your watchlist, so the same names (Tesla, Amazon, Apple and so on) always showed up.',
      'Stocks come from the Alpaca market screener and need an Alpaca paper key (Portfolio page). Crypto comes from every Binance USDT pair and needs no key. Thin pairs, stablecoins and leveraged tokens are skipped.',
      'Without a key, the list says so plainly instead of showing a fixed list. Tap any name to open its chart; it is added to your watchlist.',
      'Alpaca keys now save the moment a valid Key and Secret are pasted, without pressing Save. The Portfolio page shows which key is saved and for which web address, because keys stay with that address.',
    ],
    changesVi: [
      'Tăng mạnh nhất, Giảm mạnh nhất và Khối lượng lớn nhất giờ lấy trực tiếp từ toàn thị trường, cập nhật mỗi phút. Trước đây nút này chỉ sắp xếp lại watchlist, nên lúc nào cũng thấy các mã quen như Tesla, Amazon, Apple.',
      'Cổ phiếu lấy từ bộ lọc thị trường của Alpaca, cần key Alpaca paper (trang Danh mục). Crypto lấy từ mọi cặp USDT trên Binance, không cần key. Bỏ qua cặp quá ít giao dịch, stablecoin và token đòn bẩy.',
      'Khi chưa có key, danh sách báo rõ là cần key thay vì hiện list cố định. Bấm vào mã để mở biểu đồ, mã đó sẽ được thêm vào watchlist.',
      'Key Alpaca giờ tự lưu ngay khi dán đủ Key và Secret hợp lệ, không cần bấm Save. Trang Danh mục hiện key nào đã lưu và lưu cho địa chỉ web nào, vì key chỉ nằm ở địa chỉ đó.',
    ],
  },
  {
    version: '1.9.0',
    date: '2026-10-16',
    changes: [
      'Phase 1 Jarvis router now active: integrated useJarvisRouter into live trading flow. Router receives market data on each bar close and generates trading decisions.',
      'Chart dates now show every 6 hours and at day boundaries for professional intraday display. No more missing date context on multi-day views.',
      'Settings modal explains origin-based localStorage isolation. Added diagnostic logging to help debug missing API keys across different app origins.',
      'Show me tour checked and working.',
    ],
    changesVi: [
      'Router Jarvis Phase 1 giờ hoạt động: useJarvisRouter được nối vào flow trading trực tiếp. Router nhận dữ liệu thị trường mỗi khi bar đóng và tạo quyết định giao dịch.',
      'Chart giờ show ngày mỗi 6 giờ và ở biên ngày để hiển thị chuyên nghiệp trên intraday. Không còn thiếu ngày trên view nhiều ngày.',
      'Modal Settings giải thích origin-based localStorage isolation. Thêm diagnostic logging giúp debug missing API keys qua các origin khác nhau.',
      'Đã kiểm tra tour "Show me" hoạt động.',
    ],
  },
  {
    version: '1.21.4',
    date: '2026-10-17',
    changes: [
      'Fixed: Alpaca news endpoint now uses the correct API version (v1beta1 instead of v1beta3) and shows error details instead of silently returning empty when the upstream call fails, so problems are easier to diagnose.',
    ],
    changesVi: [
      'Đã sửa: endpoint tin Alpaca giờ dùng phiên bản API đúng (v1beta1 thay vì v1beta3) và hiện chi tiết lỗi thay vì câm lặng khi gọi upstream thất bại, để dễ chẩn đoán vấn đề.',
    ],
  },
  {
    version: '1.9.0-beta',
    date: '2026-10-16',
    changes: [
      'Phase 1: Jarvis unified agent foundation. Walk-forward validator prevents overfitting in the learner. Router combines signals from multiple sources with consensus voting (≥2/3 must agree). All new features disabled by default — enable only what you trust.',
      'Walk-forward validation: time-series train/test split with purging and embargo to avoid lookahead bias. Learner now evaluates rule accuracy out-of-sample.',
      'Unified Jarvis router: coordinates signals from analyst, scanner, order flow. Uses consensus voting to decide BUY, SELL, or HOLD.',
      'React hook for router integration (useJarvisRouter). Settings panel shows Jarvis AI toggles. Brain tab displays Phase 1 status.',
      'Measured approach: collects actual AI calls and validation metrics. No promises or estimates. Paper trading only.',
    ],
    changesVi: [
      'Phase 1: nền tảng agent Jarvis thống nhất. Walk-forward validator ngăn overfitting trong learner. Router kết hợp tín hiệu từ nhiều nguồn với bỏ phiếu đồng thuận (≥2/3 phải đồng ý). Tất cả tính năng mới tắt theo mặc định — chỉ bật những cái bạn tin tưởng.',
      'Walk-forward validation: chia train/test theo chuỗi thời gian với purging và embargo tránh lookahead bias. Learner giờ đánh giá độ chính xác rule ngoài mẫu.',
      'Router Jarvis thống nhất: điều phối tín hiệu từ analyst, scanner, order flow. Dùng bỏ phiếu đồng thuận để quyết BUY, SELL hay HOLD.',
      'React hook cho tích hợp router (useJarvisRouter). Panel Settings hiển thị Jarvis AI toggles. Tab Bộ não hiển thị trạng thái Phase 1.',
      'Phương pháp đo lường: ghi lại thực tế AI calls và validation metrics. Không hứa hay ước tính. Chỉ thử nghiệm.',
    ],
  },

  {
    version: '1.8.0',
    date: '2026-10-15',
    changes: [
      'Optional free AI helper for Jarvis. He still answers from his own records first. Only when he doesn\'t understand you does he ask a free AI (Gemini, Groq, Grok or NVIDIA), and he hands it those records so the answer is about your trades. Answers from the AI say which one wrote them.',
      'Keys stay on the server as Cloudflare secrets, never in the app or the code. The Brain tab shows whether a key is connected and how to add one. Without a key, Jarvis works exactly as before.',
      'The AI only explains: it can\'t change settings or place trades, and it never promises profits. Switch it off in Settings > AI rules: "Free AI helper".',
    ],
    changesVi: [
      'Trợ lý AI miễn phí tùy chọn cho Jarvis. Jarvis vẫn trả lời từ dữ liệu của mình trước. Chỉ khi không hiểu bạn, Jarvis mới hỏi một AI miễn phí (Gemini, Groq, Grok hoặc NVIDIA), kèm dữ liệu đó để câu trả lời đúng về lệnh của bạn. Câu trả lời từ AI ghi rõ AI nào viết.',
      'Khóa nằm trên máy chủ dưới dạng secret của Cloudflare, không bao giờ trong ứng dụng hay mã nguồn. Tab Bộ não cho biết đã kết nối khóa chưa và cách thêm. Không có khóa, Jarvis hoạt động như cũ.',
      'AI chỉ giải thích: không thể đổi cài đặt hay đặt lệnh, và không bao giờ hứa lợi nhuận. Tắt trong Cài đặt > Quy tắc AI: "Trợ lý AI miễn phí".',
    ],
  },
  {
    version: '1.7.0',
    date: '2026-10-10',
    changes: [
      'New floating brain button in the bottom-right corner of every screen. Tap it to talk or type to Jarvis. The whole conversation is written out, your words and his, and your words appear live while you speak. A clear "Listening… speak now" shows when to talk.',
      'Jarvis answers more questions in plain words, like "did you buy it too high?". If he isn\'t sure what you mean, he tells you about the stock on screen instead of giving up.',
      'Jarvis now speaks with a male voice by default. Pick Male, Female or Any in the Brain tab; the card shows which voice is actually speaking. A picked voice now really changes.',
      'When the microphone fails, Jarvis says why in the chat (blocked, nothing heard, no internet) and how to fix it.',
      'Switch it off in Settings > AI rules: "Floating brain button", and "The floating brain answers out loud".',
    ],
    changesVi: [
      'Nút bộ não nổi mới ở góc dưới bên phải mọi màn hình. Bấm để nói hoặc gõ với Jarvis. Toàn bộ cuộc trò chuyện được ghi ra, lời của bạn và của Jarvis, và lời bạn hiện ngay khi đang nói. Chữ "Đang nghe… hãy nói" cho biết lúc nào nói.',
      'Jarvis trả lời được nhiều câu hỏi hơn bằng lời dễ hiểu, như "bạn có mua giá cao không?". Nếu chưa chắc bạn hỏi gì, Jarvis nói về mã đang xem thay vì bỏ cuộc.',
      'Jarvis giờ nói bằng giọng nam theo mặc định. Chọn Nam, Nữ hoặc Bất kỳ trong tab Bộ não; thẻ cho biết giọng nào đang nói. Giọng đã chọn giờ thật sự thay đổi.',
      'Khi micro lỗi, Jarvis nói lý do trong cuộc trò chuyện (bị chặn, không nghe thấy, mất mạng) và cách sửa.',
      'Tắt trong Cài đặt > Quy tắc AI: "Nút bộ não nổi" và "Bộ não nổi trả lời thành tiếng".',
    ],
  },
  {
    version: '1.6.6',
    date: '2026-10-10',
    changes: [
      'Jarvis\'s voice is more reliable: it works around Chrome dropping speech, reads long answers in short pieces so they don\'t cut off, and starts right from your tap so iPhones allow it.',
      'If Jarvis can\'t make a sound, the voice card now says why (blocked by the browser, voice not installed, phone on silent or muted tab) instead of staying quiet. When the voice is off, the Brain tab shows a "Turn on Jarvis\'s voice" button.',
    ],
    changesVi: [
      'Giọng Jarvis ổn định hơn: khắc phục lỗi Chrome làm mất tiếng, đọc câu trả lời dài theo từng đoạn ngắn để không bị ngắt, và bắt đầu ngay khi bạn chạm nên iPhone cho phép phát.',
      'Nếu Jarvis không phát ra tiếng, thẻ giọng nói giờ cho biết lý do (trình duyệt chặn, chưa cài giọng, điện thoại để im lặng hoặc tab bị tắt tiếng) thay vì im lặng. Khi giọng đang tắt, tab Bộ não có nút "Bật giọng Jarvis".',
    ],
  },
  {
    version: '1.6.5',
    date: '2026-10-10',
    changes: [
      'Jarvis can act, under your control: ask it to "pause practice", "turn the kill switch on", "add PLTR to my watchlist" or "turn off trade alerts", typed or spoken. Jarvis shows exactly what it will change and does it only when you tap Do it. Every action, done or cancelled, is listed in "My actions" in the Brain tab.',
      'Jarvis can read everything in the app, but it can only change those few settings. It never places, sizes or closes a trade for you and never touches real money. Switch: "Jarvis can act" in AI rules > Jarvis; the master Jarvis switch turns it all off.',
    ],
    changesVi: [
      'Jarvis có thể hành động, dưới sự kiểm soát của bạn: bảo nó "tạm dừng luyện tập", "bật dừng khẩn cấp", "thêm PLTR vào danh sách" hoặc "tắt thông báo lệnh", bằng chữ hoặc giọng nói. Jarvis cho thấy chính xác điều sẽ thay đổi và chỉ làm khi bạn bấm Làm đi. Mọi hành động, đã làm hay đã hủy, đều có trong "Hành động của tôi" ở tab Bộ não.',
      'Jarvis đọc được mọi thứ trong ứng dụng nhưng chỉ đổi được vài cài đặt đó. Nó không bao giờ đặt, định cỡ hay đóng lệnh thay bạn và không đụng tới tiền thật. Công tắc: "Jarvis có thể hành động" trong Quy tắc AI > Jarvis; công tắc Jarvis chính tắt toàn bộ.',
    ],
  },
  {
    version: '1.6.4',
    date: '2026-10-10',
    changes: [
      'Jarvis greets you: the Brain tab opens with Jarvis powering up and saying good morning (or afternoon, or evening) by name, with a one-line summary of the market, open trades and the practice account. With speech on, it says it out loud once a day. Tap "Change what I call you" to set your name. Switch: "Greeting" in AI rules > Jarvis.',
      'Ask Jarvis anything: type or say a question. Name a stock ("why AAPL?", "what about Tesla?") and Jarvis opens that chart and walks you through it in the HUD: its take, the strongest reasons for and against, its own history with that stock, then the entry, stop and target. Switch: "Ask about any stock".',
      'What I\'m linked to: Jarvis now answers about everything it uses: who it is, its memory of lessons, the skills it runs, the playbook, the decision log, trade reviews and the 24/7 learner. Tap a tile or just ask. Switch: "What I\'m linked to".',
      'Answers still come from the app\'s own records, with no AI service or key. The app is ready to plug in free AI providers later; they will only reword the facts, never trade.',
    ],
    changesVi: [
      'Jarvis chào bạn: tab Bộ não mở ra với Jarvis khởi động và chào buổi sáng (chiều, tối) bằng tên bạn, kèm một dòng tóm tắt thị trường, lệnh đang mở và tài khoản luyện tập. Khi bật giọng nói, Jarvis nói lời chào một lần mỗi ngày. Chạm "Đổi tên tôi gọi bạn" để đặt tên. Công tắc: "Lời chào" trong Quy tắc AI > Jarvis.',
      'Hỏi Jarvis bất cứ điều gì: gõ hoặc nói câu hỏi. Nêu một mã ("vì sao AAPL?", "còn Tesla thì sao?") và Jarvis mở biểu đồ mã đó, giải thích trong giao diện HUD: nhận định, lý do ủng hộ và phản đối mạnh nhất, lịch sử giao dịch của nó với mã này, rồi điểm vào, cắt lỗ và mục tiêu. Công tắc: "Hỏi về bất kỳ mã nào".',
      'Tôi kết nối với: Jarvis giờ trả lời về mọi thứ nó dùng: nó là ai, bộ nhớ bài học, các kỹ năng, sổ tay, nhật ký quyết định, đánh giá lệnh và bộ học 24/7. Chạm một ô hoặc cứ hỏi. Công tắc: "Kết nối của tôi".',
      'Câu trả lời vẫn lấy từ dữ liệu của chính ứng dụng, không dùng dịch vụ AI hay khóa. Ứng dụng đã sẵn sàng để gắn các AI miễn phí sau này; chúng chỉ diễn đạt lại sự thật, không bao giờ giao dịch.',
    ],
  },
  {
    version: '1.6.3',
    date: '2026-10-10',
    changes: [
      'Meet Jarvis, the Arc Brain: a practice trading mentor with its own Brain tab. It gives a morning briefing (market hours, today\'s plan, the practice account, what the learner says, and the rule to focus on), and an "Ask Jarvis" box that answers questions such as "Why did you buy your last trade?" or "What is my risk right now?" from the app\'s own records. No AI service or API key is used.',
      'Jarvis\'s playbook: 14 rules experienced traders use (reward at least 1.5x the risk, stop within 3%, no buys in the first 15 minutes, don\'t chase a stock up 8%+, pause after 3 losses in a row, no revenge trades, and more). Every practice trade is checked against them, and the trade story in Positions and History now shows which rules it followed and broke.',
      'Honest learning: every rule starts as "Unproven". It is only called proven when our own paper trades show that following it wins clearly more often than breaking it, on enough trades. Experience is counted in practice trades, not years. Nothing here has beaten buying and holding yet, and Jarvis never promises profits.',
      'Lessons after each reviewed trade: a lucky win (broke rules but made money) says don\'t repeat it; a good trade that lost is the cost of trading.',
      'A short Jarvis line under the AI Analyst call, in plain words.',
      'Show me: when you ask Jarvis why it bought, tap Show me on a lesson, or tap Show me on the AI Analyst call, Jarvis opens that stock\'s chart and walks you through it step by step in a futuristic HUD: a targeting reticle that sweeps to the exact bar, bold buy, stop and target lines, and a pop-up explaining each point (Back, Next, Done; Esc closes). With speech on, it reads each step aloud. Switch: "Show me" in AI rules > Jarvis.',
      'Replay the day: one tap in the Brain tab and Jarvis walks through every practice trade of the day on the chart, switching stocks as it goes: where it bought, the stop and target, where it sold, and how the day went.',
      'Jarvis alerts: when a practice trade opens or closes, Jarvis pops up in the corner ("I just bought NVDA as a day trade. Want to see why?") with a Show me button. It replaces the plain pop-up; switch it off in AI rules > Jarvis.',
      'Ask by voice (off by default): turn on "Ask Jarvis by voice", tap 🎙 and say things like "why did you buy", "what\'s my risk" or "replay today". Uses the browser\'s built-in speech recognition (Chrome, Edge or Safari); no key.',
      'Jarvis can speak (off by default): turn on "Jarvis speaks" in AI rules, then pick a voice in the Brain tab, set speed and pitch, and tap Read aloud or ask a question. It talks like a person: short, direct answers, read in the most natural-sounding voice your device has (marked ★). It uses your device\'s free built-in voices (male, female and Vietnamese depend on what your device has); no key.',
      'Every part has its own switch in Settings > AI rules > Jarvis. An optional gate (off by default) makes practice skip buys that break a rule already proven on paper trades. Paper trading only.',
    ],
    changesVi: [
      'Làm quen với Jarvis, Bộ não Arc: người hướng dẫn luyện tập giao dịch với tab Bộ não riêng. Jarvis có bản tin buổi sáng (giờ thị trường, kế hoạch hôm nay, tài khoản luyện tập, nhận định của bộ học và quy tắc cần tập trung), và ô "Hỏi Jarvis" trả lời các câu như "Vì sao bạn mua lệnh gần nhất?" hay "Rủi ro của tôi lúc này là gì?" từ dữ liệu của chính ứng dụng. Không dùng dịch vụ AI hay khóa API.',
      'Sổ tay của Jarvis: 14 quy tắc của trader kinh nghiệm (lợi nhuận ít nhất 1,5 lần rủi ro, cắt lỗ trong 3%, không mua trong 15 phút đầu phiên, không đuổi theo mã đã tăng 8%+, tạm dừng sau 3 lần thua liên tiếp, không giao dịch trả thù, và nhiều hơn). Mỗi lệnh luyện tập được kiểm tra theo các quy tắc này, và câu chuyện lệnh trong Vị thế và Lịch sử giờ hiện quy tắc nào được tuân theo và bị vi phạm.',
      'Học một cách trung thực: mọi quy tắc bắt đầu là "Chưa chứng minh". Chỉ khi chính lệnh thử của chúng ta cho thấy tuân theo thắng nhiều hơn rõ rệt so với vi phạm, trên đủ số lệnh, quy tắc mới được gọi là đã chứng minh. Kinh nghiệm được tính bằng số lệnh luyện tập, không phải số năm. Chưa có gì ở đây thắng được mua và giữ, và Jarvis không bao giờ hứa lợi nhuận.',
      'Bài học sau mỗi lệnh được đánh giá: thắng may mắn (vi phạm quy tắc nhưng có lãi) thì đừng lặp lại; lệnh làm đúng mà thua là chi phí giao dịch.',
      'Một dòng ngắn của Jarvis dưới nhận định AI, bằng lời dễ hiểu.',
      'Chỉ cho tôi: khi bạn hỏi Jarvis vì sao mua, bấm Chỉ cho tôi ở một bài học, hoặc bấm Chỉ trên biểu đồ ở nhận định AI, Jarvis mở biểu đồ mã đó và hướng dẫn từng bước với giao diện HUD tương lai: tâm ngắm lướt tới đúng cây nến, đường mua, cắt lỗ và mục tiêu đậm, và khung bật lên giải thích từng điểm (Lùi, Tiếp, Xong; Esc để đóng). Khi bật giọng nói, Jarvis đọc to từng bước. Công tắc: "Chỉ cho tôi" trong Quy tắc AI > Jarvis.',
      'Xem lại ngày: một chạm trong tab Bộ não, Jarvis dẫn xem mọi lệnh luyện tập trong ngày trên biểu đồ, chuyển mã khi cần: mua ở đâu, cắt lỗ và mục tiêu, bán ở đâu, và cả ngày ra sao.',
      'Jarvis báo lệnh: khi lệnh luyện tập mở hoặc đóng, Jarvis hiện ở góc màn hình ("Tôi vừa mua NVDA, lệnh trong ngày. Muốn xem vì sao không?") kèm nút Chỉ cho tôi. Thay cho thông báo thường; tắt trong Quy tắc AI > Jarvis.',
      'Hỏi bằng giọng nói (mặc định tắt): bật "Hỏi Jarvis bằng giọng nói", bấm 🎙 và nói như "vì sao mua", "rủi ro" hoặc "xem lại hôm nay". Dùng nhận dạng giọng nói có sẵn của trình duyệt (Chrome, Edge hoặc Safari); không cần khóa.',
      'Jarvis có thể nói (mặc định tắt): bật "Jarvis nói" trong Quy tắc AI, rồi chọn giọng trong tab Bộ não, chỉnh tốc độ và cao độ, và bấm Đọc to hoặc đặt câu hỏi. Jarvis nói như người thật: trả lời ngắn, thẳng vào câu hỏi, bằng giọng tự nhiên nhất trên thiết bị (đánh dấu ★). Dùng giọng miễn phí có sẵn trên thiết bị (giọng nam, nữ và tiếng Việt tùy thiết bị); không cần khóa.',
      'Mỗi phần có công tắc riêng trong Cài đặt > Quy tắc AI > Jarvis. Một cổng tùy chọn (mặc định tắt) cho luyện tập bỏ qua lệnh mua vi phạm quy tắc đã chứng minh trên lệnh thử. Chỉ giao dịch thử nghiệm.',
    ],
  },
  {
    version: '1.6.2',
    date: '2026-10-10',
    changes: [
      'Penny stocks (on by default): practice can now trade stocks from $1 to $5, and today\'s movers lists include them, because they move more and give the AI more to learn from.',
      'Safeguards: never under $1; only stocks trading at least $100k per 15-minute bar on average (about $2.6M a day) so fills are realistic; half the usual trade size; and 5x the usual spread and slippage (20 bps spread, 10 bps slippage) so results aren\'t flattered.',
      'Penny trades are tagged "penny" in Positions, Open orders and History, and the Practice report shows penny vs regular results separately. Turn it off in the Practice tab ("Penny stocks") or Settings > AI rules. Works in the browser and on the 24/7 server.',
    ],
    changesVi: [
      'Cổ phiếu penny (mặc định bật): luyện tập giờ có thể giao dịch mã từ $1 đến $5, và danh sách mã biến động hôm nay có cả các mã này, vì chúng biến động nhiều hơn và cho AI nhiều cơ hội học hơn.',
      'Bảo vệ: không bao giờ dưới $1; chỉ mã giao dịch trung bình ít nhất $100k mỗi nến 15 phút (khoảng $2,6 triệu mỗi ngày) để khớp lệnh thực tế; nửa khối lượng thường; và chênh lệch, trượt giá gấp 5 lần (chênh lệch 20 bps, trượt giá 10 bps) để kết quả không bị đẹp giả.',
      'Lệnh penny gắn nhãn "penny" trong Vị thế, Lệnh chờ và Lịch sử, và báo cáo Luyện tập tách riêng kết quả penny và mã thường. Tắt trong tab Luyện tập ("Cổ phiếu penny") hoặc Cài đặt > Quy tắc AI. Áp dụng trên trình duyệt và máy chủ 24/7.',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-10-10',
    changes: [
      'Unlimited practice trades (on by default): the AI now makes a day trade on every BUY its rules allow, instead of stopping at 4 a day, so it learns faster. Long-term trades keep their daily number (1) because they are held for days. Turn it off in the Practice tab ("Unlimited trades") or Settings > AI rules to go back to the daily caps.',
      'Daily loss limit (on by default, 2% of the practice account, about $200): once trades closed today lose that much, the AI stops new practice buys until the next trading day. Open trades still exit at their stop, target or market close. Change the % in Settings > AI rules.',
      'In unlimited mode, practice can hold up to 25 trades at once (was 8), still inside the 60% exposure limit (25 trades x 2% = 50%). The 20% drawdown halt and the kill switch still apply. Your own paper account keeps the 8-position limit.',
      'Works in the browser and on the 24/7 server. The server checks every 15 minutes, so that sets how often it can trade.',
    ],
    changesVi: [
      'Luyện tập không giới hạn lệnh (mặc định bật): AI giờ vào lệnh trong ngày ở mọi tín hiệu MUA mà quy tắc cho phép, thay vì dừng ở 4 lệnh mỗi ngày, để học nhanh hơn. Lệnh dài hạn vẫn giữ số lượng mỗi ngày (1) vì giữ nhiều ngày. Tắt trong tab Luyện tập ("Không giới hạn lệnh") hoặc Cài đặt > Quy tắc AI để quay lại giới hạn mỗi ngày.',
      'Giới hạn lỗ trong ngày (mặc định bật, 2% tài khoản luyện tập, khoảng $200): khi các lệnh đóng hôm nay lỗ đến mức đó, AI ngừng mua luyện tập đến ngày giao dịch tiếp theo. Lệnh đang mở vẫn thoát ở cắt lỗ, chốt lời hoặc giờ đóng cửa. Đổi % trong Cài đặt > Quy tắc AI.',
      'Ở chế độ không giới hạn, luyện tập có thể giữ tối đa 25 lệnh cùng lúc (trước là 8), vẫn trong giới hạn 60% tổng tiền vào lệnh (25 lệnh x 2% = 50%). Dừng khi giảm 20% từ đỉnh và công tắc dừng khẩn cấp vẫn áp dụng. Tài khoản thử nghiệm của bạn giữ giới hạn 8 vị thế.',
      'Áp dụng trên trình duyệt và máy chủ 24/7. Máy chủ kiểm tra mỗi 15 phút, nên đó là tần suất nó có thể giao dịch.',
    ],
  },
  {
    version: '1.5.2',
    date: '2026-10-10',
    changes: [
      'Practice trades now tell their whole story. Tap any 🎯 Practice row in Positions, Open orders or History (▸ details) to see: when it bought and at what price, why (the AI call, Trade Score, why the picker chose it, and the checks it passed), the data it used, when it will sell (target, stop, and the market-close or long-term hold deadline), and once closed, when and why it sold, the profit or loss, costs and the process review.',
      'Each practice row shows a clear status: Open, Closed or Blocked. History also lists today\'s blocked buys and the rule that stopped each one (up to 20).',
      'Works on old trades too. Every trade explains why it bought (how the analyst signal, Trade Score and learner decided, and the skills used) and why it sold, in plain words. Where an older trade was saved before some of this was recorded, it says "not recorded" instead of guessing.',
      'The details fit a phone screen and follow the same "In Positions & History" switch.',
    ],
    changesVi: [
      'Lệnh luyện tập giờ kể đầy đủ câu chuyện. Chạm vào dòng 🎯 Practice trong Vị thế, Lệnh chờ hoặc Lịch sử (▸ details) để xem: mua lúc nào, giá bao nhiêu, vì sao (nhận định AI, Điểm GD, lý do bộ chọn mã chọn nó và các bước kiểm tra đã đạt), dữ liệu đã dùng, khi nào sẽ bán (chốt lời, cắt lỗ, và hạn đóng cửa hoặc hạn giữ dài hạn), và khi đã đóng thì bán lúc nào, vì sao, lãi/lỗ, chi phí và đánh giá quy trình.',
      'Mỗi dòng luyện tập hiện rõ trạng thái: Đang mở, Đã đóng hoặc Bị chặn. Lịch sử cũng liệt kê các lệnh mua bị chặn hôm nay và quy tắc đã chặn (tối đa 20).',
      'Áp dụng cả cho lệnh cũ. Mỗi lệnh giải thích vì sao mua (tín hiệu phân tích, Điểm GD và bộ học quyết định thế nào, cùng các kỹ năng đã dùng) và vì sao bán, bằng lời dễ hiểu. Lệnh cũ được lưu trước khi có một số thông tin này sẽ ghi "not recorded" thay vì đoán.',
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
