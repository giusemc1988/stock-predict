/**
 * Starts or updates the RuView sensing server on this PC, in Docker, on the version pinned in ruview.versions.json.
 *
 *   npm run ruview                 start, or update to the pinned version (keeps the last mode, first time: sim)
 *   npm run ruview -- sim          practice data, no ESP32 needed
 *   npm run ruview -- esp32        real ESP32 nodes on your Wi-Fi
 *   npm run ruview -- esp32 --mqtt 192.168.1.50   also send to Home Assistant's MQTT broker
 *   npm run ruview -- status | stop
 *
 * Only touches its own container, "jarvis-ruview". The web page is reached through the home agent (npm run agent),
 * so port 3000 stays on 127.0.0.1. UDP 5005 is opened only in esp32 mode and only accepts your home network.
 */
import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { join } from 'node:path'
import { isPrivateIPv4 } from '../src/lib/netParse'
import { CSI_PORT, RUVIEW_IMAGE } from '../src/lib/ruview'

const HOME = process.env.AGENT_HOME ?? join(os.homedir(), '.jarvis-agent')
const NAME = 'jarvis-ruview'
const PORT = Number(process.env.RUVIEW_PORT ?? 3000)

const docker = (args: string[], env: NodeJS.ProcessEnv = process.env, timeout = 600_000) =>
  new Promise<{ ok: boolean; out: string }>((resolve) =>
    execFile('docker', args, { env, timeout, windowsHide: true, maxBuffer: 8 << 20 }, (e, out, err) => resolve({ ok: !e, out: String(out || err || e?.message || '') })),
  )

function say(en: string, vi: string) {
  console.log(`${vi}\n  ${en}`)
}

function token(): string {
  const file = join(HOME, 'ruview-token')
  if (existsSync(file)) return readFileSync(file, 'utf8').trim()
  const t = randomBytes(32).toString('hex')
  writeFileSync(file, t)
  return t
}

/** Home network ranges (x.y.z.0/24) for RuView's UDP allow-list. */
function lanRanges(): string[] {
  const ips = Object.values(os.networkInterfaces())
    .flat()
    .filter((i): i is os.NetworkInterfaceInfo => !!i && i.family === 'IPv4' && !i.internal && isPrivateIPv4(i.address))
    .map((i) => `${i.address.split('.').slice(0, 3).join('.')}.0/24`)
  return [...new Set(ips)]
}

async function main() {
  mkdirSync(HOME, { recursive: true })
  const args = process.argv.slice(2)
  const stateFile = join(HOME, 'ruview.json')
  const saved = existsSync(stateFile) ? (JSON.parse(readFileSync(stateFile, 'utf8')) as { mode?: string; mqtt?: string }) : {}
  const mi = args.indexOf('--mqtt')
  const cmd = args.find((a, i) => !a.startsWith('--') && (mi < 0 || i !== mi + 1)) ?? saved.mode ?? 'sim'

  if (!(await docker(['version', '--format', '{{.Server.Version}}'], process.env, 20_000)).ok)
    return say('Docker is not running. Install Docker Desktop (docker.com), open it, then run this again.', 'Docker chưa chạy. Cài Docker Desktop (docker.com), mở nó lên, rồi chạy lại lệnh này.')

  if (cmd === 'status') {
    const r = await docker(['ps', '-a', '--filter', `name=^${NAME}$`, '--format', '{{.Image}} {{.Status}}'])
    return console.log(r.out.trim() || 'not installed / chưa cài', `\npinned / bản đã chọn: ${RUVIEW_IMAGE}`)
  }
  if (cmd === 'stop') {
    await docker(['rm', '-f', NAME])
    return say('RuView stopped.', 'Đã tắt RuView.')
  }
  if (cmd !== 'sim' && cmd !== 'esp32') return say('Use: sim, esp32, status or stop.', 'Dùng: sim, esp32, status hoặc stop.')

  const mqtt = mi >= 0 ? args[mi + 1] : saved.mqtt
  if (mqtt && !isPrivateIPv4(mqtt)) return say('--mqtt needs an address on your home network.', '--mqtt cần một địa chỉ trong mạng nhà.')

  say(`Downloading ${RUVIEW_IMAGE} (first time can take a few minutes)…`, `Đang tải ${RUVIEW_IMAGE} (lần đầu có thể mất vài phút)…`)
  const pull = await docker(['pull', RUVIEW_IMAGE])
  if (!pull.ok) return console.error(pull.out)

  await docker(['rm', '-f', NAME])
  const env: NodeJS.ProcessEnv = { ...process.env, RUVIEW_API_TOKEN: token() }
  const run = ['run', '-d', '--name', NAME, '--restart', 'unless-stopped', '-e', 'RUVIEW_API_TOKEN', '-p', `127.0.0.1:${PORT}:3000`]
  if (cmd === 'sim') run.push('-e', 'CSI_SOURCE=simulated')
  else {
    // Docker Desktop hands LAN packets to the container from its bridge gateway, so that address is allowed too
    const gw = (await docker(['network', 'inspect', 'bridge', '-f', '{{(index .IPAM.Config 0).Gateway}}'])).out.trim()
    const allow = [...lanRanges(), ...(isPrivateIPv4(gw) ? [`${gw}/32`] : [])]
    run.push('-e', 'CSI_SOURCE=esp32', '-e', `RUVIEW_UDP_ALLOW=${allow.join(',')}`, '-p', `${CSI_PORT}:${CSI_PORT}/udp`)
  }
  if (mqtt) run.push('-e', 'RUVIEW_MQTT=true', '-e', `RUVIEW_MQTT_HOST=${mqtt}`)
  run.push(RUVIEW_IMAGE)
  const started = await docker(run, env)
  if (!started.ok) return console.error(started.out)
  writeFileSync(stateFile, JSON.stringify({ mode: cmd, mqtt, image: RUVIEW_IMAGE, at: Date.now() }, null, 2))
  say(
    `RuView ${RUVIEW_IMAGE} is running (${cmd === 'sim' ? 'practice data' : 'ESP32 nodes'}). Keep "npm run agent" running and open the RuView page.`,
    `RuView ${RUVIEW_IMAGE} đang chạy (${cmd === 'sim' ? 'dữ liệu tập' : 'ESP32 thật'}). Để "npm run agent" chạy rồi mở trang RuView.`,
  )
}

void main()
