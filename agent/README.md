# Jarvis home agent / Chương trình trên máy nhà

Trang **Wi-Fi và Bluetooth** cần một chương trình nhỏ chạy trên máy ở nhà, vì trang web không tự quét Wi-Fi được.
Chương trình chỉ làm việc với mạng của anh: liệt kê thiết bị, liệt kê Wi-Fi máy đã thấy, ping, kiểm tra cổng, đánh thức máy, đo tốc độ.
Nó không bắt gói tin, không tấn công mạng khác, và chỉ nghe ở `127.0.0.1`, nên máy khác trong mạng cũng không gọi vào được.

The Wi-Fi page needs this small program on your home PC, because a website cannot scan Wi-Fi. It only works on your own network, never captures traffic, and only listens on `127.0.0.1`.

> Nếu `git pull` báo lỗi gộp (merge), dừng lại và nhắn Claude trong project. Đừng tự xóa hay reset.

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

## Argus: máy bay thời gian thực qua máy nhà

Các nguồn máy bay miễn phí (adsb.lol, adsb.fi) chặn máy chủ Cloudflare, nhưng mạng nhà thì không bị chặn.
Khi chương trình máy nhà đang chạy và đã nối Cloudflare Tunnel như Cách 2 ở trên, Argus tự lấy máy bay qua máy nhà: dữ liệu thời gian thực, $0.
Không cần thêm secret nào, vì Argus mượn đường của Hub (`stock-predict`). Hub đã giữ sẵn `HOME_AGENT_URL` và `HOME_AGENT_TOKEN`.

Argus thử lần lượt từng nguồn:
1. **Máy nhà**: thời gian thực.
2. **Gọi thẳng** adsb.lol hoặc adsb.fi: thường bị chặn.
3. **Ảnh chụp từ GitHub**, khoảng 10 phút một lần (workflow `Argus aircraft snapshot`): trễ khoảng 10–15 phút, nhưng chạy cả khi máy nhà tắt.

Header `x-flight-source` cho biết nguồn nào đang được dùng.

Lưu ý: link `trycloudflare.com` đổi mỗi lần chạy lại tunnel, nên sau khi máy khởi động lại phải sửa `HOME_AGENT_URL`. Muốn link cố định thì dùng cách có tên miền.

## Chuyển sang Mac (MacBook hoặc Mac mini)

Mọi thứ của anh nằm trên GitHub và Cloudflare, không nằm trên máy. Chuyển máy chỉ cần cài lại chương trình máy nhà.
Mở **Terminal** trên Mac rồi chạy từng dòng:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node git cloudflared
git clone https://github.com/giusemc1988/stock-predict.git ~/stock-predict
cd ~/stock-predict && npm install
bash agent/mac-autostart.sh
```

Lệnh cuối làm chương trình tự chạy mỗi khi Mac bật, và in ra **Token**.

Tunnel tự chạy, cách dễ nhất là tạo trên dashboard:
1. Vào Cloudflare **Zero Trust** > Networks > **Tunnels** > Create tunnel, chọn macOS.
2. Dán lệnh `sudo cloudflared service install ...` mà trang đưa cho anh vào Terminal. Lệnh này cài tunnel thành dịch vụ, tự bật lại sau khi khởi động máy.
3. Thêm **Public hostname** trỏ tới `http://127.0.0.1:8787`. Bước này cần một tên miền trên Cloudflare.

Xong thì đổi `HOME_AGENT_URL` và `HOME_AGENT_TOKEN` của Worker **stock-predict** sang giá trị mới (Settings > Variables and Secrets), làm được từ điện thoại.

Mac mini để ở nhà: vào System Settings > Users & Groups, bật **tự đăng nhập**. Vào Energy, bật **khởi động lại sau khi mất điện**. Chương trình chạy theo user, nên chỉ chạy khi user đã đăng nhập.

Tắt tự chạy: `bash agent/mac-autostart.sh off`.

Trên Mac, trang Wi-Fi chưa liệt kê được mạng xung quanh (macOS không có lệnh như netsh). Các phần khác (thiết bị, ping, cổng, tốc độ, Argus) vẫn chạy.

## RuView

Cảm biến bằng sóng Wi-Fi.

Trang **RuView cảm biến** chạy [RuView](https://github.com/ruvnet/ruview) (MIT, của rUv) nguyên bản trong Docker trên máy nhà.
Bản được chọn nằm trong `ruview.versions.json`. Trang đọc RuView qua chương trình máy nhà ở trên, nên không cần mở thêm link Cloudflare nào.

1. Cài **Docker Desktop** (docker.com), mở nó lên một lần.
2. Để `npm run agent` chạy (Cách 1).
3. Mở thêm một cửa sổ PowerShell, thử với dữ liệu tập (chưa cần ESP32):
   ```powershell
   cd C:\Users\chanh\stock-predict; npm run ruview -- sim
   ```
4. Mở trang **RuView cảm biến** trên Hub. Thấy "Trong phòng lúc này" là chạy được.
5. Khi có board ESP32-S3 (hoặc C6): chạy `npm run ruview -- esp32`. Windows có thể hỏi cho phép mạng: chọn **Private networks** (mạng riêng). Rồi bấm **+ Thêm node** trên trang.

Các lệnh khác:
- `npm run ruview` : bật lại, hoặc lên bản mới sau khi anh merge PR cập nhật RuView.
- `npm run ruview -- status` : xem đang chạy bản nào.
- `npm run ruview -- stop` : tắt RuView.
- `npm run ruview -- esp32 --mqtt 192.168.1.50` : gửi thêm sang Home Assistant (MQTT).

An toàn: RuView chỉ nghe trên `127.0.0.1:3000`, có token riêng (`%USERPROFILE%\.jarvis-agent\ruview-token`). Cổng UDP 5005 chỉ mở ở chế độ esp32 và chỉ nhận từ mạng nhà.
RuView cảm nhận được người qua tường: chỉ dùng trong nhà anh và để mọi người trong nhà biết.

Trước khi nạp firmware cho board, gửi Claude ảnh chụp nắp kim loại trên module (N4, N8 hoặc N16R8) để chọn đúng file.

## An toàn

- Token mới được tạo lần chạy đầu, lưu ở `%USERPROFILE%\.jarvis-agent\token`. Muốn đổi thì xóa file đó rồi chạy lại.
- Ping và kiểm tra cổng chỉ nhận địa chỉ trong mạng nhà (192.168.x.x, 10.x.x.x, 172.16-31.x.x).
- Danh sách thiết bị đã thấy nằm ở `%USERPROFILE%\.jarvis-agent\known.json`.
- Đổi cổng: `$env:AGENT_PORT=8788; npm run agent`.

## Chi phí

$0. Cloudflare Tunnel và Access miễn phí cho cá nhân. Máy nhà phải mở thì mới quét được (tốn tiền điện).
RuView và Docker Desktop miễn phí cho cá nhân. Board ESP32-S3 khoảng $9 một cái (RuView khuyên từ 2 cái), C6 khoảng $6-10, anten ngoài vài đô.
