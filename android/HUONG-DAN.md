# App Jarvis cho Android / Jarvis Android app

App này mở đúng trang Jarvis (web), và thêm một thứ mà trình duyệt không cho: **quét Wi-Fi điện thoại đang kết nối**.
Tới tiệm hay nhà nào của anh, vào Wi-Fi đó, mở trang **Mạng nhà** là app tự quét: thiết bị trong mạng, kênh Wi-Fi, ping, kiểm tra cổng, đánh thức máy.
Mỗi Wi-Fi có danh sách riêng (tên thiết bị, tin cậy, báo thiết bị mới). Web cập nhật thì app tự có, không cần cài lại.

This app opens the Jarvis site and adds what a browser can't do: scan the Wi-Fi the phone is on, with a separate device list per shop or house.

## Cài lần đầu (trên điện thoại Android)

1. Mở link này bằng Chrome trên điện thoại, đăng nhập GitHub nếu nó hỏi:
   https://github.com/giusemc1988/stock-predict/releases/tag/android-latest
2. Bấm **jarvis.apk** để tải về.
3. Mở file vừa tải. Nếu Android hỏi "Cho phép cài ứng dụng từ nguồn này?", bấm **Cài đặt** (Settings) rồi bật **Cho phép từ nguồn này** cho Chrome, quay lại bấm **Cài đặt**.
4. Mở app **Jarvis**. Lần đầu sẽ có trang đăng nhập Cloudflare: nhập email của anh, lấy mã trong email, dán vào.
5. Vào Hub, bấm **Mạng nhà**. Android hỏi quyền **Vị trí**: bấm **Cho phép**. (Android bắt buộc quyền này để đọc tên Wi-Fi; app không lưu vị trí của anh.)

## Cập nhật

Trang web cập nhật thì app tự có. Chỉ khi có bản app mới (hiếm), tải lại `jarvis.apk` ở link trên.
Nếu Android báo "Ứng dụng không được cài đặt" thì gỡ app Jarvis cũ trước rồi cài lại (bản này ký bằng khóa thử nghiệm, mỗi lần build có thể khác khóa).

## Giới hạn của Android

- Android 10 trở lên ẩn địa chỉ MAC của thiết bị khác, nên đa số thiết bị không hiện hãng sản xuất.
- Quét Wi-Fi xung quanh cần bật **Vị trí**; Android chỉ cho quét mới khoảng 4 lần mỗi 2 phút.
- Không có cho iPhone (Apple không cho app quét mạng kiểu này).

## An toàn

Chỉ quét Wi-Fi của anh (nhà, tiệm). App không bắt gói tin, không phá Wi-Fi, không dò mật khẩu. Ping và kiểm tra cổng chỉ nhận địa chỉ trong mạng nội bộ.
Tắt tính năng: Cài đặt > Quy tắc AI > "App Android: quét Wi-Fi điện thoại đang kết nối".

## Chi phí

$0. Không cần Play Store. Không tốn thêm Cloudflare.
