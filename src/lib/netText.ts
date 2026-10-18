/**
 * Labels for the Wi-Fi & Bluetooth page, in English and Vietnamese.
 * scripts/i18n.test.ts checks that every entry has both languages and the same {slots}.
 */
import { useLang, type Lang } from './i18n'
import type { Bi } from './hubText'

export const NET_TEXT = {
  title: { en: 'Wi-Fi & Bluetooth', vi: 'Wi-Fi và Bluetooth' },
  back: { en: '← Hub', vi: '← Hub' },
  agentLive: { en: 'Home agent connected', vi: 'Máy nhà đã kết nối' },
  agentOff: { en: 'Home agent offline', vi: 'Máy nhà đang tắt' },
  agentNotSetUp: { en: 'Home agent not set up yet', vi: 'Chưa cài chương trình trên máy nhà' },
  lastScan: { en: 'Showing the last scan from {when}.', vi: 'Đang hiện lần quét gần nhất lúc {when}.' },
  rescan: { en: 'Rescan', vi: 'Quét lại' },
  scanning: { en: 'Scanning…', vi: 'Đang quét…' },
  devicesKpi: { en: 'Devices', vi: 'Thiết bị' },
  newKpi: { en: 'New (24h)', vi: 'Mới (24 giờ)' },
  nearbyKpi: { en: 'Wi-Fi nearby', vi: 'Wi-Fi xung quanh' },
  speedKpi: { en: 'Down / up', vi: 'Tải xuống / lên' },
  devices: { en: 'Devices on your network', vi: 'Thiết bị trong mạng' },
  colDevice: { en: 'Device', vi: 'Thiết bị' },
  colIp: { en: 'IP', vi: 'IP' },
  colMaker: { en: 'Maker', vi: 'Hãng' },
  unknownDevice: { en: 'Unnamed device', vi: 'Thiết bị chưa đặt tên' },
  unknownMaker: { en: 'unknown', vi: 'không rõ' },
  flagNew: { en: 'New', vi: 'Mới' },
  flagMe: { en: 'This PC', vi: 'Máy này' },
  flagRouter: { en: 'Router', vi: 'Router' },
  flagTrusted: { en: 'Trusted', vi: 'Tin cậy' },
  rename: { en: 'Name', vi: 'Đặt tên' },
  renamePrompt: { en: 'Name for this device', vi: 'Tên cho thiết bị này' },
  trust: { en: 'Trust', vi: 'Tin cậy' },
  checkPorts: { en: 'Ports', vi: 'Cổng' },
  ping: { en: 'Ping', vi: 'Ping' },
  wake: { en: 'Wake', vi: 'Đánh thức' },
  portsOpen: { en: 'Open ports on {ip}: {list}', vi: 'Cổng mở trên {ip}: {list}' },
  portsNone: { en: 'No common port is open on {ip}.', vi: 'Không có cổng phổ biến nào mở trên {ip}.' },
  pingResult: { en: '{ip}: {got}/{sent} replies, average {ms} ms', vi: '{ip}: {got}/{sent} lần trả lời, trung bình {ms} ms' },
  pingNone: { en: '{ip} did not answer.', vi: '{ip} không trả lời.' },
  wakeSent: { en: 'Wake-up packet sent.', vi: 'Đã gửi tín hiệu đánh thức.' },
  offlineDevices: { en: 'Seen before, offline now: {n}', vi: 'Đã thấy trước đây, giờ đang tắt: {n}' },
  noDevices: { en: 'No devices yet. Press Rescan.', vi: 'Chưa có thiết bị nào. Bấm Quét lại.' },
  analyzer: { en: 'Wi-Fi channels (2.4 GHz)', vi: 'Kênh Wi-Fi (2,4 GHz)' },
  tipMove: { en: 'Channel {cur} is crowded. Moving your router to channel {best} should be steadier.', vi: 'Kênh {cur} đang đông. Đổi router sang kênh {best} sẽ ổn định hơn.' },
  tipOk: { en: 'Your channel looks fine. Quietest of 1, 6 and 11 is {best}.', vi: 'Kênh của anh ổn. Kênh vắng nhất trong 1, 6 và 11 là {best}.' },
  wifiUnsupported: { en: 'This PC cannot list Wi-Fi networks (needs Windows or Linux with Wi-Fi).', vi: 'Máy này không liệt kê được Wi-Fi (cần Windows hoặc Linux có Wi-Fi).' },
  noNetworks: { en: 'No Wi-Fi networks seen yet.', vi: 'Chưa thấy mạng Wi-Fi nào.' },
  open: { en: 'open, no password', vi: 'mở, không mật khẩu' },
  ble: { en: 'Bluetooth', vi: 'Bluetooth' },
  blePick: { en: 'Pick a nearby device', vi: 'Chọn thiết bị gần đây' },
  bleNote: { en: 'Your browser lets you pick one device at a time. A full nearby list and the lost-device finder need the ESP32 (next step).', vi: 'Trình duyệt chỉ cho chọn từng thiết bị một. Danh sách đầy đủ và tìm đồ bị lạc cần ESP32 (bước sau).' },
  bleNoSupport: { en: 'This browser has no Web Bluetooth. Use Chrome or Edge.', vi: 'Trình duyệt này không có Web Bluetooth. Dùng Chrome hoặc Edge.' },
  blePicked: { en: 'Picked: {name}', vi: 'Đã chọn: {name}' },
  tools: { en: 'Tools', vi: 'Công cụ' },
  speedTest: { en: 'Speed test', vi: 'Đo tốc độ' },
  speedNote: { en: 'Download, upload, ping', vi: 'Tải xuống, tải lên, ping' },
  speedResult: { en: '{down} Mbps down · {up} Mbps up · {ping} ms', vi: 'Tải xuống {down} Mbps · tải lên {up} Mbps · {ping} ms' },
  speedHere: { en: 'This device: {down} Mbps down · {up} Mbps up · {ping} ms', vi: 'Máy này: tải xuống {down} Mbps · tải lên {up} Mbps · {ping} ms' },
  speedNoteHere: { en: 'Runs on this device, any Wi-Fi', vi: 'Chạy ngay trên máy này, Wi-Fi nào cũng được' },
  dns: { en: 'DNS lookup', vi: 'Tra DNS' },
  dnsNote: { en: 'Where a domain points', vi: 'Tên miền trỏ về đâu' },
  dnsPrompt: { en: 'Domain to look up', vi: 'Tên miền cần tra' },
  dnsNone: { en: 'No address found for {name}.', vi: 'Không tìm thấy địa chỉ cho {name}.' },
  pingTool: { en: 'Ping a device', vi: 'Ping thiết bị' },
  pingNote: { en: 'Is it answering, how fast', vi: 'Có trả lời không, nhanh không' },
  ipPrompt: { en: 'Address on your network (e.g. 192.168.1.20)', vi: 'Địa chỉ trong mạng nhà (vd. 192.168.1.20)' },
  portsTool: { en: 'Open port check', vi: 'Kiểm tra cổng mở' },
  portsNote: { en: 'Your own devices only', vi: 'Chỉ thiết bị của anh' },
  wolTool: { en: 'Wake-on-LAN', vi: 'Đánh thức máy' },
  wolNote: { en: 'Turn on a PC from here', vi: 'Bật máy tính từ đây' },
  macPrompt: { en: 'MAC address of the PC to wake', vi: 'Địa chỉ MAC của máy cần bật' },
  needAgent: { en: 'Needs the home agent', vi: 'Cần chương trình trên máy nhà' },
  soonAlert: { en: 'New-device alert (Telegram): next update', vi: 'Báo thiết bị mới qua Telegram: bản sau' },
  legal: { en: 'For your own network and devices only. No tools to attack Wi-Fi, crack passwords or spy on other people.', vi: 'Chỉ dùng cho mạng và thiết bị của anh. Không có công cụ phá Wi-Fi, bẻ mật khẩu hay nghe lén người khác.' },
  setupTitle: { en: 'Connect your home PC (one time)', vi: 'Kết nối máy nhà (làm một lần)' },
  setupWhy: { en: 'A website cannot scan Wi-Fi. A small program on your PC does the scanning and the app reads it through a private Cloudflare link only you can open.', vi: 'Trang web không quét Wi-Fi được. Một chương trình nhỏ trên máy anh làm việc quét, rồi app đọc qua một link Cloudflare riêng chỉ anh mở được.' },
  setupGuide: { en: 'Step-by-step guide (PowerShell)', vi: 'Hướng dẫn từng bước (PowerShell)' },
  privateOnly: { en: 'Only addresses on your home network (192.168.x.x, 10.x.x.x, 172.16-31.x.x).', vi: 'Chỉ địa chỉ trong mạng nhà (192.168.x.x, 10.x.x.x, 172.16-31.x.x).' },
  phoneScanning: { en: 'Scanning with this phone · {ssid}', vi: 'Đang quét bằng điện thoại · {ssid}' },
  phoneOwnOnly: { en: 'Scanning the Wi-Fi this phone is on. Only scan Wi-Fi you own (your home or shop). Android hides most device makers, and needs Location turned on to read Wi-Fi names.', vi: 'Đang quét Wi-Fi mà điện thoại đang kết nối. Chỉ quét Wi-Fi của anh (nhà hoặc tiệm). Android ẩn hãng của đa số thiết bị, và cần bật Vị trí để đọc tên Wi-Fi.' },
  getApp: { en: 'Get the Android app to scan any of your Wi-Fi from this phone', vi: 'Cài app Android để quét Wi-Fi của anh ngay trên điện thoại này' },
  demoTry: { en: 'Try it with sample data', vi: 'Xem thử với dữ liệu mẫu' },
  demoOn: { en: 'Sample data', vi: 'Dữ liệu mẫu' },
  demoNote: { en: 'Showing made-up sample data so you can see how the page works. Real scans need the home agent.', vi: 'Đang hiện dữ liệu mẫu (không có thật) để anh xem trang chạy thế nào. Quét thật cần chương trình trên máy nhà.' },
  demoExit: { en: 'Leave sample', vi: 'Thoát dữ liệu mẫu' },
  error: { en: 'Something went wrong: {msg}', vi: 'Có lỗi: {msg}' },
} satisfies Record<string, Bi>

export type NetKey = keyof typeof NET_TEXT

export function netText(lang: Lang, key: NetKey, vars: Record<string, string | number> = {}) {
  return NET_TEXT[key][lang].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`))
}

export function useNetT() {
  const lang = useLang()
  return (key: NetKey, vars?: Record<string, string | number>) => netText(lang, key, vars)
}
