// The upstream God's Eye View API (server/providers/*) inside the argus Worker: every Vite plugin
// installs its connect-style middleware on the small chain below, served through node:http.
// Bundled by build.mjs at the pinned upstream commit; worker.ts sends it every /api route it does not answer itself.
import { createServer } from 'node:http';
import { httpServerHandler } from 'cloudflare:node';
import { localProviderPlugins } from 'upstream/server/providers/local.js';
import { PROXY_SIGNALS } from 'upstream/src/localRequestGate.mjs';

// free public Overpass mirrors (the browser also asks them directly, see iris/iris.js)
process.env.OVERPASS_UPSTREAMS ||= 'https://overpass-api.de/api/interpreter,https://overpass.private.coffee/api/interpreter,https://maps.mail.ru/osm/tools/overpass/api/interpreter';

// Workers fetch has no redirect: 'error'; do the same check by hand
const workerFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  if (init?.redirect !== 'error') return workerFetch(input, init);
  const r = await workerFetch(input, { ...init, redirect: 'manual' });
  if (r.status >= 300 && r.status < 400) throw new TypeError('fetch failed: unexpected redirect');
  return r;
};

// voice (OpenAI/Gemini) needs keys this deploy does not have; key setup writes local files
const SKIP = new Set(['openai-realtime-proxy', 'gemini-live-proxy', 'key-setup-endpoint']);
const stack = [];
const middlewares = {
  use(route, fn) {
    if (typeof route === 'function') [route, fn] = ['/', route];
    stack.push({ route: route.replace(/\/$/, ''), fn });
    return middlewares;
  },
};
const viteServer = { middlewares, httpServer: null, config: { server: {}, preview: {} }, restart() {} };
let ready;
async function install() {
  for (const p of localProviderPlugins({})) {
    if (SKIP.has(p.name)) continue;
    const hook = p.configurePreviewServer ?? p.configureServer;
    try {
      await (typeof hook === 'function' ? hook : hook?.handler)?.call(p, viteServer);
    } catch (e) {
      console.warn('[iris] plugin', p.name, e?.message);
    }
  }
}

/** Runs the chain the way connect does: route prefixes are stripped from req.url, next(err) skips to error handlers. */
function dispatch(req, res) {
  const original = req.url;
  const path = original.split('?')[0];
  let i = 0;
  const next = (err) => {
    const layer = stack[i++];
    if (!layer) {
      res.statusCode = err ? 500 : 404;
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify({ error: err ? 'internal error' : 'not found' }));
    }
    const r = layer.route;
    if (r && path !== r && !path.startsWith(r + '/')) return next(err);
    req.url = original.slice(r.length) || '/';
    if (!req.url.startsWith('/')) req.url = '/' + req.url;
    req.originalUrl = original;
    try {
      const handles = layer.fn.length === 4;
      const out = err ? (handles ? layer.fn(err, req, res, next) : next(err)) : handles ? next() : layer.fn(req, res, next);
      out?.catch?.((e) => next(e));
    } catch (e) {
      next(e);
    }
  };
  // the Worker is the only caller: drop the CDN headers the upstream same-site gate refuses
  for (const h of [...PROXY_SIGNALS, 'origin', 'referer', 'sec-fetch-site', 'sec-fetch-mode', 'sec-fetch-dest']) delete req.headers[h];
  req.headers.host = 'localhost:4173';
  next();
}

const server = createServer((req, res) => {
  (ready ??= install()).then(() => dispatch(req, res));
});
server.listen(4173);
export const upstreamApi = httpServerHandler({ port: 4173 });
