import assert from 'node:assert/strict'
import { channelTip, isPrivateIPv4, parseArp, parseNetsh, parseNmcli } from '../src/lib/netParse'

// only home-network addresses pass
assert.ok(isPrivateIPv4('192.168.1.20') && isPrivateIPv4('10.0.0.5') && isPrivateIPv4('172.20.1.1'))
assert.ok(!isPrivateIPv4('8.8.8.8') && !isPrivateIPv4('172.32.0.1') && !isPrivateIPv4('192.168.1.300') && !isPrivateIPv4('example.com'))

// Windows arp -a: dynamic entries only, no broadcast or multicast
const win = `
Interface: 192.168.1.12 --- 0x7
  Internet Address      Physical Address      Type
  192.168.1.1           50-c7-bf-11-22-33     dynamic
  192.168.1.30          24-0a-c4-aa-bb-cc     dynamic
  192.168.1.255         ff-ff-ff-ff-ff-ff     static
  224.0.0.22            01-00-5e-00-00-16     static
`
const d = parseArp(win)
assert.deepEqual(d.map((x) => x.ip), ['192.168.1.1', '192.168.1.30'])
assert.equal(d[0].vendor, 'TP-Link')
assert.equal(d[1].vendor, 'Espressif')
assert.equal(d[1].mac, '24:0a:c4:aa:bb:cc')

// macOS / Linux arp -a, with short octets
const nix = '? (192.168.0.5) at 3c:22:fb:1:2:3 on en0 ifscope [ethernet]\n? (8.8.8.8) at 00:11:22:33:44:55 on en0'
assert.deepEqual(parseArp(nix).map((x) => `${x.ip} ${x.mac} ${x.vendor}`), ['192.168.0.5 3c:22:fb:01:02:03 Apple'])

// Windows netsh: one row per access point
const netsh = `
SSID 1 : Chanh-Home
    Network type            : Infrastructure
    Authentication          : WPA2-Personal
    Encryption              : CCMP
    BSSID 1                 : 50:c7:bf:11:22:33
         Signal             : 92%
         Radio type         : 802.11ax
         Channel            : 6
SSID 2 : Neighbour
    Authentication          : Open
    BSSID 1                 : aa:bb:cc:dd:ee:01
         Signal             : 70%
         Channel            : 6
    BSSID 2                 : aa:bb:cc:dd:ee:02
         Signal             : 40%
         Channel            : 44
`
const n = parseNetsh(netsh)
assert.deepEqual(n.map((x) => `${x.ssid}:${x.channel}:${x.signal}:${x.auth}`), ['Chanh-Home:6:92:WPA2-Personal', 'Neighbour:6:70:Open', 'Neighbour:44:40:Open'])

// Linux nmcli with an escaped colon in the BSSID
const nm = parseNmcli('Home:AA\\:BB\\:CC\\:DD\\:EE\\:FF:80:11:WPA2\n:11\\:22\\:33\\:44\\:55\\:66:30:1:')
assert.deepEqual(nm.map((x) => `${x.ssid}|${x.bssid}|${x.channel}|${x.auth}`), ['Home|aa:bb:cc:dd:ee:ff|11|WPA2', '(hidden)|11:22:33:44:55:66|1|Open'])

// channel tip: a crowded 6 points to a quiet 1 or 11, and your own network is left out
const tip = channelTip(n, 'Chanh-Home')
assert.equal(tip.current, 6)
assert.notEqual(tip.best, 6)
assert.ok(tip.shouldMove)
assert.equal(channelTip([{ ssid: 'Home', bssid: 'x', signal: 90, channel: 1, auth: '' }], 'Home').shouldMove, false)

console.log('netparse tests passed')
