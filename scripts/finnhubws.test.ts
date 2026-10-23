import assert from 'node:assert/strict'

// a fake socket that throws like a browser when sent to before it is open
class FakeWS {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  static all: FakeWS[] = []
  readyState = FakeWS.CONNECTING
  sent: string[] = []
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  constructor(public url: string) {
    FakeWS.all.push(this)
  }
  send(s: string) {
    if (this.readyState !== FakeWS.OPEN) throw new Error("Failed to execute 'send' on 'WebSocket': Still in CONNECTING state.")
    this.sent.push(s)
  }
  close() {
    this.readyState = FakeWS.CLOSING // onclose comes later, like a real socket
  }
  open() {
    this.readyState = FakeWS.OPEN
    this.onopen?.()
  }
  closed() {
    this.readyState = FakeWS.CLOSED
    this.onclose?.()
  }
}
;(globalThis as any).WebSocket = FakeWS

const { finnhubTrades } = await import('../src/data/providers')
const noop = () => {}

// pick a stock, the socket opens
const offA = finnhubTrades('AAPL', 'k', noop, noop)
FakeWS.all[0].open()
// pick another stock: the old one is dropped, then a new socket starts connecting
offA()
const offB = finnhubTrades('MSFT', 'k', noop, noop)
assert.equal(FakeWS.all.length, 2)
// a third panel subscribes while the new socket is still connecting: this used to throw
const offC = finnhubTrades('TSLA', 'k', noop, noop)
// the old socket finishing its close must not mark the new one as down
FakeWS.all[0].closed()
FakeWS.all[1].open()
assert.deepEqual(FakeWS.all[1].sent.map((s) => JSON.parse(s).symbol).sort(), ['MSFT', 'TSLA'])
// unsubscribing while open still sends
offC()
assert.equal(JSON.parse(FakeWS.all[1].sent.at(-1)!).type, 'unsubscribe')
offB()

// a new key while the socket is connecting: no send on the connecting socket
finnhubTrades('AAPL', 'k2', noop, noop)
finnhubTrades('NVDA', 'k2', noop, noop)
console.log('finnhub socket: ok')
