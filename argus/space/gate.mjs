// Front door of the Iris API Space. Hugging Face's proxy adds forwarding headers, which the upstream
// server reads as "a request from another machine" and refuses on some routes, so this gate checks the
// shared key from the argus Worker, drops those headers and passes /api/* to Vite on localhost.
import http from 'node:http'

const KEY = process.env.IRIS_KEY || ''
const DROP = new Set(['forwarded', 'via', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-port', 'x-forwarded-proto', 'x-real-ip', 'cf-connecting-ip', 'cf-ray', 'origin', 'referer', 'sec-fetch-site', 'sec-fetch-mode', 'sec-fetch-dest', 'host', 'x-iris-key'])

http
  .createServer((req, res) => {
    const url = req.url || '/'
    // Hugging Face checks the app is up on "/"
    if (!url.startsWith('/api/')) return void res.end('iris api')
    if (!KEY || req.headers['x-iris-key'] !== KEY) {
      res.writeHead(403, { 'content-type': 'application/json' })
      return void res.end('{"error":"forbidden"}')
    }
    const headers = { host: 'localhost:5173' }
    for (const [k, v] of Object.entries(req.headers)) if (!DROP.has(k) && !k.startsWith('x-hf') && !k.startsWith('x-amzn')) headers[k] = v
    const up = http.request({ host: '127.0.0.1', port: 5173, path: url, method: req.method, headers }, (r) => {
      res.writeHead(r.statusCode || 502, r.headers)
      r.pipe(res)
    })
    up.setTimeout(60_000, () => up.destroy(new Error('timeout')))
    up.on('error', () => {
      if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' })
      res.end('{"error":"upstream not ready"}')
    })
    req.pipe(up)
  })
  .listen(7860, '0.0.0.0')
