# nexus-scout

A passive-only Wi-Fi + BLE scanner for an ESP32, built for the Neo Hub's Nexus page
("Thiết bị bỏ túi" / pocket device). It watches and reports; it never transmits deauth,
beacon spam, evil-portal or any other frame meant to affect someone else's device or
network — see `AGENTS.md` rule 5 in the repo root.

## What it does

- Scans nearby Wi-Fi networks (SSID, BSSID, channel, signal, auth type) passively.
- Scans nearby BLE advertisements (name if broadcast, signal, rough kind) passively — it
  never sends a connect request.
- Reports both over USB serial (115200, one JSON object per line; the host sends `ping` every 10s to keep it streaming) and over one BLE GATT characteristic as small JSON chunks, read live by the
  Nexus page in Neo Hub (`src/components/NexusScoutPanel.tsx` / `src/lib/nexusScout.ts`).
- Falls back to its own `NexusScout-xxxx` Wi-Fi access point with a read-only status page
  if nothing connects over Bluetooth within a minute of boot — useful to confirm it's
  alive, not a way to start a scan (that's Bluetooth-only, from the Nexus page).
- 2.4 GHz only. No 5 GHz scanning.

## Boards

- `esp32-s3` — Chanh's board (N16R8, external IPEX antenna). Build and flash this one first.
- `esp32dev` — a plain ESP32 (WROOM-32E), as a cheaper second option.

## Building

This is a [PlatformIO](https://platformio.org/) project.

```
pio run -e esp32-s3   # or -e esp32dev
```

GitHub Actions builds both targets on every pull request that touches this folder
(`.github/workflows/nexus-scout.yml`), and on a push to `main` publishes the two `.bin`
files plus a `SHA256SUMS` file to a rolling `nexus-scout-latest` release. Volt (the ESP32
flasher page in Neo Hub) can flash straight from that release's link.

## USB serial and the shared S3 kit

The same ESP32-S3 kit also runs RuView (Echo). Nexus and Echo are told apart by the boot line
`NEXUS-SCOUT v<ver> board=<chip> ready` (printed at boot and in reply to every `ping`).
Connect with "Kết nối qua USB" on the Nexus page (Web Serial; Chrome on a phone works over OTG).
Switching between Nexus and Echo is a reflash through Volt. The release ships a merged image
(`nexus-scout-esp32-s3.bin`, offset 0x0) plus `manifest.json`, so Volt flashes it in one step.

## Flashing

Use Volt (`/#volt` in Neo Hub): paste `giusemc1988/stock-predict` as the repo, pick the
`nexus-scout-latest` release, and Volt will check the firmware against your connected
board before writing it.

## Testing without a board

The firmware itself can't be exercised from the cloud — someone needs a real ESP32. The
JSON chunk format it emits is covered by unit tests in `scripts/nexusscout.test.ts`
(`src/lib/nexusScout.ts`'s `parseScoutChunk`), so the app side is verified even without
hardware. At home:

1. Flash an ESP32-S3 with the `nexus-scout` firmware via Volt.
2. Power it from any USB power bank — no PC needed after that.
3. Open Nexus in Neo Hub on your phone, tap "Connect to Nexus Scout", and pick
   `NexusScout-xxxx` from the Bluetooth picker.
