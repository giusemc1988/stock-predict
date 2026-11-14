/**
 * Plain-words help for every button of the Max Team part of the Max page (voice box, little office, work board).
 * `line` is the one-line hint shown next to the button; `more` opens when the "?" beside it is tapped.
 * scripts/maxhelp.test.ts checks every entry has both languages and a short line.
 */
import type { Bi } from './hubText'

export interface HelpText {
  line: Bi
  more: Bi
}

export const HELP = {
  mic: {
    line: { en: 'Tap, talk, tap again when done.', vi: 'Bấm, nói, nói xong bấm lần nữa.' },
    more: { en: 'Records your voice and writes it down as text (Vietnamese mixed with English is fine). It only helps you write a prompt for Claude, so use it when Claude still has limit. Nothing is sent yet.', vi: 'Ghi âm giọng anh rồi tự chép thành chữ (nói Việt xen Anh đều được). Chỉ để soạn lời nhắc cho Claude, nên dùng khi Claude còn limit. Lúc này chưa gửi gì đi.' },
  },
  lang: {
    line: { en: 'Which language you speak.', vi: 'Anh nói tiếng gì.' },
    more: { en: 'Auto is fine for Vietnamese mixed with English. Pick one language only if the text comes out wrong.', vi: 'Để Tự nhận là được, kể cả khi nói Việt xen Anh. Chỉ chọn một thứ tiếng khi chữ chép ra bị sai.' },
  },
  done: {
    line: { en: 'Turns your words into a prompt for you to check.', vi: 'Biến lời anh thành lời nhắc để anh xem lại.' },
    more: { en: 'Nothing is sent. After this you check the prompt, tap 1 Copy and 2 Open Claude. Use this when Claude has limit. When Claude is out of limit, use “Give work” in the board below: it goes straight to Milo.', vi: 'Chưa gửi gì cả. Sau đó anh xem lại, bấm 1 Sao chép rồi 2 Mở Claude. Dùng khi Claude còn limit. Khi Claude hết limit: dùng ô “Giao việc” ở bảng bên dưới, việc đi thẳng cho Milo.' },
  },
  clear: {
    line: { en: 'Erases the text in the box.', vi: 'Xoá chữ đang có trong ô.' },
    more: { en: 'Only this box is cleared. Work you already gave stays on the board.', vi: 'Chỉ xoá ô này. Việc đã giao trên bảng vẫn còn nguyên.' },
  },
  copyPrompt: {
    line: { en: 'Copies the prompt to your phone.', vi: 'Chép lời nhắc vào bộ nhớ điện thoại.' },
    more: { en: 'Copies the text in the box. A green message tells you it worked. Then tap “2. Open Claude” and paste there.', vi: 'Sao chép chữ trong khung. Hiện khung xanh báo đã chép xong. Rồi bấm “2. Mở Claude” và dán ở đó.' },
  },
  openClaude: {
    line: { en: 'Opens the Claude project in a new tab.', vi: 'Mở dự án Claude ở thẻ mới.' },
    more: { en: 'Tap the message box in Claude, hold, choose Paste, then Send. If nothing was copied yet, tap 1 first.', vi: 'Trong Claude chạm ô nhắn tin, giữ, chọn Dán, rồi Gửi. Nếu chưa sao chép thì bấm 1 trước.' },
  },
  share: {
    line: { en: 'Sends the prompt through the phone share menu.', vi: 'Gửi lời nhắc qua bảng chia sẻ của điện thoại.' },
    more: { en: 'Pick Claude (or any app) in the menu. It is another way to do copy and open.', vi: 'Chọn Claude (hoặc app khác) trong bảng. Đây là cách khác thay cho sao chép rồi mở.' },
  },
  back: {
    line: { en: 'Back to your words to edit them.', vi: 'Quay lại lời anh nói để sửa.' },
    more: { en: 'The prompt is dropped and your original words come back. Nothing is lost.', vi: 'Lời nhắc bị bỏ và lời anh nói quay lại. Không mất gì.' },
  },
  museCopy: {
    line: { en: 'Copies the saved prompt.', vi: 'Chép lời nhắc đã lưu.' },
    more: { en: 'For the old way only: you paste a prompt Claude wrote, copy it, then paste it in Muse’s chat. “Give work” below does this for you.', vi: 'Chỉ cho cách cũ: anh dán lời nhắc Claude viết, sao chép, rồi dán vào chat Muse. Ô “Giao việc” bên dưới làm giúp việc này.' },
  },
  musePaste: {
    line: { en: 'Pastes what you copied into this box.', vi: 'Dán thứ anh vừa copy vào ô này.' },
    more: { en: 'It replaces the box with the text from your clipboard and keeps it on this phone.', vi: 'Thay nội dung ô bằng chữ trong bộ nhớ tạm và giữ lại trên điện thoại này.' },
  },
  museClear: {
    line: { en: 'Erases the saved prompt.', vi: 'Xoá lời nhắc đã lưu.' },
    more: { en: 'Use it when the old prompt is stale. It only clears this box on this phone.', vi: 'Dùng khi lời nhắc cũ đã hết dùng. Chỉ xoá ô này trên điện thoại này.' },
  },
  officeRefresh: {
    line: { en: 'Reads the board again right now.', vi: 'Đọc lại bảng ngay bây giờ.' },
    more: { en: 'The office updates by itself every 30 seconds, so you rarely need this. Tap a window to see what that worker is doing and why it shows Problem.', vi: 'Văn phòng tự cập nhật mỗi 30 giây nên ít khi cần bấm. Chạm vào một cửa sổ để xem người đó đang làm gì và vì sao báo Có lỗi.' },
  },
  boardRefresh: {
    line: { en: 'Reads the board again right now.', vi: 'Đọc lại bảng ngay bây giờ.' },
    more: { en: 'The board also updates by itself every 30 seconds.', vi: 'Bảng cũng tự cập nhật mỗi 30 giây.' },
  },
  driverOut: {
    line: { en: 'Tells the team: Claude is out of limit, Milo leads.', vi: 'Báo cả đội: Claude hết limit, Milo cầm lái.' },
    more: { en: 'It only writes on the board who is in charge, and sends nothing to Milo. Tap it when Claude has no limit left so everyone knows Milo is leading. Tap it again, as “Claude is back”, when Claude returns.', vi: 'Chỉ ghi lên bảng ai đang chỉ huy, không gửi gì cho Milo. Bấm khi Claude hết limit để mọi người biết Milo đang chỉ huy. Khi Claude quay lại thì bấm lại, nút đổi thành “Claude quay lại”.' },
  },
  driverBack: {
    line: { en: 'Tells the team Claude leads again.', vi: 'Báo cả đội Claude chỉ huy lại.' },
    more: { en: 'Tap it when Claude has limit again. Claude then reads everything that changed while it was away.', vi: 'Bấm khi Claude có limit lại. Claude sẽ đọc mọi thay đổi trong lúc vắng mặt.' },
  },
  copyAll: {
    line: { en: 'Copies one prompt with all waiting work for Milo.', vi: 'Chép một lời nhắc chứa mọi việc Milo đang chờ.' },
    more: { en: 'Use it only if Milo has not started a few minutes after you gave the work. Tap, open Milo’s chat, paste, send. It costs no Claude limit.', vi: 'Chỉ dùng khi Milo chưa bắt đầu sau vài phút. Bấm, mở chat Milo, dán, gửi. Không tốn limit của Claude.' },
  },
  copyOne: {
    line: { en: 'Copies the prompt for this one task.', vi: 'Chép lời nhắc riêng cho việc này.' },
    more: { en: 'Same as the big copy button, but for this task only. Paste it in Milo’s chat if Milo has not started it.', vi: 'Giống nút sao chép lớn nhưng chỉ cho việc này. Dán vào chat Milo nếu Milo chưa bắt đầu.' },
  },
  addImg: {
    line: { en: 'Add a picture to explain better.', vi: 'Thêm ảnh để giải thích rõ hơn.' },
    more: { en: 'Pictures stay on this phone and are not uploaded. Milo cannot see them by itself: tap “Copy picture” and paste it into Milo’s chat with the prompt.', vi: 'Ảnh chỉ nằm trên điện thoại này, không tải lên. Milo không tự thấy ảnh: bấm “Sao chép ảnh” rồi dán vào chat Milo cùng lời nhắc.' },
  },
  giveMilo: {
    line: { en: 'Puts the work on the board for Milo. No Claude needed.', vi: 'Đưa việc lên bảng cho Milo. Không cần Claude.' },
    more: { en: 'The work appears in the queue, Milo picks it up by itself, writes progress and a result, and ends with a lesson. Works also when Claude is out of limit.', vi: 'Việc hiện trong hàng việc, Milo tự nhận, ghi tiến độ và kết quả, rồi kết thúc bằng một bài học. Dùng được cả khi Claude hết limit.' },
  },
  giveClaude: {
    line: { en: 'Puts the work on the board for Claude.', vi: 'Đưa việc lên bảng cho Claude.' },
    more: { en: 'It waits in the queue until Claude has limit. If Claude is out of limit, change “Who” in Options to Milo.', vi: 'Việc nằm chờ trong hàng cho tới khi Claude còn limit. Nếu Claude hết limit, đổi “Ai làm” trong Tuỳ chọn sang Milo.' },
  },
  giveMachine: {
    line: { en: 'Runs a fixed script on that PC.', vi: 'Chạy một script cố định trên máy đó.' },
    more: { en: 'Scripts only (check the PC, test, build). No code is written. The result shows in the queue.', vi: 'Chỉ chạy script có sẵn (kiểm tra máy, test, build). Không viết code. Kết quả hiện trong hàng việc.' },
  },
  who: {
    line: { en: 'Who does the work.', vi: 'Ai làm việc này.' },
    more: { en: 'Milo: default, works even when Claude is out of limit. Claude: waits until Claude has limit. Windows or Ubuntu PC: runs a fixed script, no coding.', vi: 'Milo: mặc định, làm được cả khi Claude hết limit. Claude: nằm chờ tới khi Claude còn limit. Máy Windows hoặc Ubuntu: chạy script có sẵn, không viết code.' },
  },
  project: {
    line: { en: 'Only a label to sort the work.', vi: 'Chỉ là nhãn để xếp việc.' },
    more: { en: 'Pick the app the work is about. It changes nothing else.', vi: 'Chọn app mà việc nói tới. Không đổi gì khác.' },
  },
  red: {
    line: { en: 'Red work waits until you tap Approve.', vi: 'Việc đỏ nằm chờ tới khi anh bấm Duyệt.' },
    more: { en: 'Tick it for risky work. Nobody starts it before you approve it in the queue.', vi: 'Tick cho việc rủi ro. Chưa ai bắt đầu khi anh chưa bấm Duyệt trong hàng việc.' },
  },
  idea: {
    line: { en: 'Asks Claude for 3 new ideas. Nothing is built.', vi: 'Nhờ Claude nghĩ 3 ý tưởng mới. Chưa làm gì.' },
    more: { en: 'Adds an “ideas” task for the chosen project. Claude answers when it has limit.', vi: 'Thêm một việc “ý tưởng” cho dự án đã chọn. Claude trả lời khi còn limit.' },
  },
  approve: {
    line: { en: 'Lets a red task start.', vi: 'Cho phép việc đỏ bắt đầu.' },
    more: { en: 'A red task waits for you. After Approve it joins the normal queue.', vi: 'Việc đỏ chờ anh. Sau khi Duyệt nó vào hàng việc bình thường.' },
  },
  drop: {
    line: { en: 'Cancels this task: nobody will do it.', vi: 'Huỷ việc này: sẽ không ai làm nữa.' },
    more: { en: 'The task moves to “Dropped” and stays in the log. Nothing is deleted. You can only cancel a task that has not started (waiting, or waiting for your OK). A task that is working or done cannot be cancelled.', vi: 'Việc chuyển sang “Đã huỷ” và vẫn nằm trong nhật ký, không xoá gì. Chỉ huỷ được việc chưa bắt đầu (đang chờ, hoặc chờ anh duyệt). Việc đang làm hay đã xong thì không huỷ được.' },
  },
} satisfies Record<string, HelpText>

export type HelpKey = keyof typeof HELP
