# Jarvis home agent / Chương trình trên máy nhà

Trang **Wi-Fi và Bluetooth** cần một chương trình nhỏ chạy trên máy ở nhà, vì trang web không tự quét Wi-Fi được.
Chương trình chỉ làm việc với mạng của anh: liệt kê thiết bị, liệt kê Wi-Fi máy đã thấy, ping, kiểm tra cổng, đánh thức máy, đo tốc độ.
Nó không bắt gói tin, không tấn công mạng khác, và chỉ nghe ở `127.0.0.1`, nên máy khác trong mạng cũng không gọi vào được.

The Wi-Fi page needs this small program on your home PC, because a website cannot scan Wi-Fi. It only works on your own network, never captures traffic, and only listens on `127.0.0.1`.

## Cách 1: dùng trên máy nhà (dễ nhất, không cần cài thêm)

Mở **PowerShell** rồi chạy từng dòng:

```powershell
cd C:\Users\chanh\stock-predict; git pull; npm install
npm run agent
```

Cửa sổ sẽ hiện `Jarvis home agent ... on http://127.0.0.1:8787` và một dòng `Token`. Để cửa sổ đó mở.

Mở thêm một cửa sổ PowerShell khác:

```powershell
cd C:\Users\chanh\stock-predict; npm run dev
```

Vào `http://localhost:5173`, bấm **Mạng nhà** trên Hub. App trên máy tự đọc token, không cần dán gì.

## Cách 2: xem từ điện thoại hoặc ở ngoài (qua Cloudflare Tunnel)

Cần làm Cách 1 trước, và để `npm run agent` chạy.

1. Cài cloudflared:
   ```powershell
   winget install --id Cloudflare.cloudflared
   ```
2. **Nếu anh có tên miền trên Cloudflare** (khuyên dùng, link cố định):
   ```powershell
   cloudflared tunnel login
   cloudflared tunnel create jarvis-home
   cloudflared tunnel route dns jarvis-home home.TEN-MIEN-CUA-ANH.com
   cloudflared tunnel run --url http://127.0.0.1:8787 jarvis-home
   ```
   Trong Cloudflare Zero Trust, tạo một Access application cho `home.TEN-MIEN-CUA-ANH.com` với policy **Service Auth**, và tạo một **Service Token**. Lưu lại Client ID và Client Secret.
3. **Nếu chưa có tên miền** (link đổi mỗi lần chạy lại):
   ```powershell
   cloudflared tunnel --url http://127.0.0.1:8787
   ```
   Lấy link `https://....trycloudflare.com` nó in ra. Token vẫn bảo vệ chương trình.
4. Vào Cloudflare dashboard > Workers & Pages > **stock-predict** > Settings > **Variables and Secrets**, thêm các secret:
   - `HOME_AGENT_URL`: link ở bước 2 hoặc 3
   - `HOME_AGENT_TOKEN`: dòng Token mà `npm run agent` in ra (cũng nằm trong `C:\Users\chanh\.jarvis-agent\token`)
   - `HOME_ACCESS_CLIENT_ID` và `HOME_ACCESS_CLIENT_SECRET`: chỉ khi làm bước 2

   Thêm secret trên dashboard, **không** chạy `wrangler deploy` từ máy nhà.

Xong, mở trang web như bình thường. Khi máy nhà tắt, trang hiện lần quét gần nhất.

## An toàn

- Token mới được tạo lần chạy đầu, lưu ở `%USERPROFILE%\.jarvis-agent\token`. Muốn đổi thì xóa file đó rồi chạy lại.
- Ping và kiểm tra cổng chỉ nhận địa chỉ trong mạng nhà (192.168.x.x, 10.x.x.x, 172.16-31.x.x).
- Danh sách thiết bị đã thấy nằm ở `%USERPROFILE%\.jarvis-agent\known.json`.
- Đổi cổng: `$env:AGENT_PORT=8788; npm run agent`.

## Chi phí

$0. Cloudflare Tunnel và Access miễn phí cho cá nhân. Máy nhà phải mở thì mới quét được (tốn tiền điện).
