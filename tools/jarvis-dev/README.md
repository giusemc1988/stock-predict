# Jarvis Dev: sửa và nâng cấp Jarvis OS ngay trên máy, không cần mạng

Dùng khi Claude hết lượt hoặc khi không có mạng. Một AI chạy trên máy anh (Aider + Ollama `qwen3-coder:30b`) đọc code và sửa theo lời anh.

## Bắt đầu (làm 1 lần, cần mạng)
Mở **PowerShell** rồi dán lệnh này:
```powershell
git clone https://github.com/giusemc1988/stock-predict.git $HOME\jarvis-dev; cd $HOME\jarvis-dev; .\jarvis.bat
```
Bảng chọn hiện ra thì chọn **1** (Cài đặt). Máy sẽ tự kiểm tra và cài những gì còn thiếu:

| Cần | Để làm gì |
|---|---|
| Git, Node.js | Tải code và chạy app |
| Ollama + `qwen3-coder:30b` | AI viết code trên máy (khoảng 19 GB, máy anh đã có sẵn) |
| Python + Aider | Công cụ để AI sửa file |

Nếu máy báo thiếu chương trình nào, nó sẽ đưa đúng lệnh `winget install ...` để anh dán vào.

Lưu ý: thư mục cũ `C:\Users\chanh\stock-predict` **không bị đụng tới**. Jarvis Dev làm việc trong thư mục riêng `C:\Users\chanh\jarvis-dev`.

## Dùng hằng ngày
Mở `C:\Users\chanh\jarvis-dev\jarvis.bat`:

| Số | Việc |
|---|---|
| 2 | **Mở app** ở http://localhost:5173 |
| 3 | **Sửa bằng AI**: gõ điều anh muốn bằng lời thường (ví dụ "nút ở trang Wi-Fi nhỏ quá"). Gõ `/exit` khi xong |
| 4 | **Kiểm tra**: chạy test và build. Hiện ĐẠT hoặc LỖI |
| 5 | **Lưu**: lưu vào một nhánh riêng (`offline-ngày-giờ`). Có mạng thì gửi lên GitHub để anh mở pull request và merge |
| 6 | **Tình trạng**: mạng, Ollama, model, Aider, các file đã đổi |

## An toàn
- Chỉ lưu vào nhánh riêng, **không bao giờ** đẩy vào `main`.
- AI trên máy đọc luật dự án trong `AGENTS.md` (chỉ paper trading, có What's new tiếng Anh và tiếng Việt, mỗi tính năng có nút tắt).
- Muốn lên trang Cloudflare vẫn phải có mạng: anh merge pull request, rồi GitHub Actions tự deploy.

## Giới hạn
- AI trên máy chậm và yếu hơn Claude, hợp với sửa nhỏ. Việc lớn thì để Claude làm khi có lượt.
- Chưa chạy thử trên Surface của anh. Lần đầu nếu có lỗi, anh chụp màn hình gửi Claude.

---

# Jarvis Dev (English)
Fix and upgrade Jarvis OS on this PC without internet or Claude. First time (online): run the PowerShell line above, then choose 1 (Setup). Daily: `jarvis.bat` with 2 Run, 3 Fix with AI, 4 Check, 5 Save (branch only, never main), and 6 Status. The local AI follows `AGENTS.md`. Cost: $0. Not yet tested on the Surface.
