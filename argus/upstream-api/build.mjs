// Bundles the upstream API (providers.mjs + the pinned server/providers) into one module for worker.ts.
// usage: node build.mjs <upstream checkout> <out file> [cctv-packs.json from cctv-snapshot.mjs]
// (esbuild comes from the upstream's own install)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const [up, out, cctvPacks] = process.argv.slice(2).map((p) => path.resolve(p));
const here = path.dirname(new URL(import.meta.url).pathname);
const { build } = createRequire(path.join(up, 'package.json'))('esbuild');

// files the providers read from disk (memfs.mjs serves them)
const seed = {};
for (const dir of ['config', 'src/data/local_data/cctv_ground_heights']) {
  const abs = path.join(up, dir);
  if (fs.existsSync(abs)) for (const f of fs.readdirSync(abs)) seed[`${dir}/${f}`] = fs.readFileSync(path.join(abs, f), 'utf8');
}

// small source edits for the Worker runtime; the build fails if upstream moves the code
const PATCHES = {
  // Radio Browser: plain fetch instead of https.request pinned to the resolved IP (no sockets here)
  'server/providers/radio.js': ['createRadioProxyMiddleware()', 'createRadioProxyMiddleware({ fetchImpl: (u, o) => fetch(u, o) })'],
  // CCTV: each live pack comes from the build-time snapshot (cctv-snapshot.mjs) when there is one
  'server/providers/cctv/catalog.js': [
    'pack.enabled() ? pack.load({ sourceRoot }) : []',
    'pack.enabled() ? (__irisPacks()?.[pack.name] ? Object.assign([...__irisPacks()[pack.name].items], { available: __irisPacks()[pack.name].available ?? undefined, region: __irisPacks()[pack.name].region ?? undefined }) : __irisPacks() ? [] : pack.load({ sourceRoot })) : []',
    "import __irisPacks from 'virtual:cctv-packs';\n",
  ],
};

await build({
  entryPoints: [path.join(here, 'providers.mjs')],
  outfile: out,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  mainFields: ['module', 'main'],
  conditions: ['workerd', 'worker', 'import'],
  nodePaths: [path.join(up, 'node_modules')],
  // source-root.js resolves the upstream root three levels up from here: /bundle
  define: { 'import.meta.url': '"file:///bundle/server/providers/common/source-root.js"' },
  logLevel: 'warning',
  plugins: [
    {
      name: 'iris',
      setup(b) {
        b.onResolve({ filter: /^upstream\// }, (a) => ({ path: path.join(up, a.path.slice('upstream/'.length)) }));
        b.onResolve({ filter: /^(node:)?fs(\/promises)?$/ }, (a) => ({ path: path.join(here, a.path.endsWith('promises') ? 'memfsp.mjs' : 'memfs.mjs') }));
        b.onResolve({ filter: /^(node:)?child_process$/ }, () => ({ path: path.join(here, 'child_process.mjs') }));
        b.onLoad({ filter: /\.m?js$/ }, (a) => {
          const rel = path.relative(up, a.path);
          const patch = PATCHES[rel];
          if (!patch) return undefined;
          const src = fs.readFileSync(a.path, 'utf8');
          if (!src.includes(patch[0])) throw new Error(`patch for ${rel} no longer applies`);
          return { contents: (patch[2] ?? '') + src.replace(patch[0], patch[1]), loader: 'js', resolveDir: path.dirname(a.path) };
        });
        // parsed on first use, not at startup
        b.onResolve({ filter: /^virtual:cctv-packs$/ }, () => ({ path: 'cctv-packs', namespace: 'seed' }));
        b.onLoad({ filter: /^cctv-packs$/, namespace: 'seed' }, () => ({
          contents: `const text = ${JSON.stringify(cctvPacks && fs.existsSync(cctvPacks) ? fs.readFileSync(cctvPacks, 'utf8') : '')}; let packs; export default () => (packs ??= text ? JSON.parse(text).packs : null);`,
          loader: 'js',
        }));
        b.onResolve({ filter: /^virtual:seed$/ }, () => ({ path: 'seed', namespace: 'seed' }));
        b.onLoad({ filter: /^seed$/, namespace: 'seed' }, () => ({ contents: `export default ${JSON.stringify(seed)}`, loader: 'js' }));
        b.onResolve({ filter: /^cloudflare:/ }, (a) => ({ path: a.path, external: true }));
        b.onResolve({ filter: /^node:/ }, (a) => ({ path: a.path, external: true }));
        b.onResolve({ filter: /^(path|url|crypto|stream|http|https|os|module|events|util|buffer|zlib|net|tls|dns|dns\/promises|stream\/promises)$/ }, (a) => ({ path: `node:${a.path}`, external: true }));
      },
    },
  ],
});
console.log(`upstream API: ${(fs.statSync(out).size / 1024).toFixed(0)} KiB`);
