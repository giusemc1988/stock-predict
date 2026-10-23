/**
 * Version and "What's new". Bump APP_VERSION and add an entry to the top of RELEASES
 * with each update. The banner shows once per version, then stays dismissed.
 */
export const APP_VERSION = '1.47.0'

export interface Release {
  version: string
  date: string
  changes: string[]
  /** Vietnamese version of the same list, shown when the app language is Tiếng Việt. */
  changesVi?: string[]
}

export const RELEASES: Release[] = [
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
