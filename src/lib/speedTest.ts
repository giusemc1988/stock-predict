/**
 * Speed test that runs in the browser against speed.cloudflare.com (it allows any site to call it).
 * Measures the network this phone or computer is on right now, so it works anywhere without the home agent.
 */
const URL_DOWN = 'https://speed.cloudflare.com/__down'
const URL_UP = 'https://speed.cloudflare.com/__up'

const mbps = (bytes: number, ms: number) => Math.round(((bytes * 8) / (ms / 1000) / 1e6) * 10) / 10

export async function browserSpeedTest(): Promise<{ downMbps: number; upMbps: number; pingMs: number }> {
  // ping: median of a few empty requests, the first one warms up the connection
  const pings: number[] = []
  for (let i = 0; i < 6; i++) {
    const t = performance.now()
    await fetch(`${URL_DOWN}?bytes=0&r=${Math.random()}`, { cache: 'no-store' })
    if (i) pings.push(performance.now() - t)
  }
  pings.sort((a, b) => a - b)

  const downBytes = 10_000_000
  const t0 = performance.now()
  const r = await fetch(`${URL_DOWN}?bytes=${downBytes}&r=${Math.random()}`, { cache: 'no-store' })
  const got = (await r.arrayBuffer()).byteLength
  const t1 = performance.now()

  const up = new Uint8Array(3_000_000)
  await fetch(URL_UP, { method: 'POST', body: up })
  const t2 = performance.now()

  return { downMbps: mbps(got, t1 - t0), upMbps: mbps(up.length, t2 - t1), pingMs: Math.round(pings[Math.floor(pings.length / 2)]) }
}
