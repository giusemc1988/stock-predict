// Runs every live CCTV pack of the pinned upstream once, in Node on the build runner, and saves the
// raw camera lists. The Worker serves its catalog from this file (build.mjs bundles it): loading
// all packs live takes ~15 s and more subrequests than one Worker request may make.
// usage: node cctv-snapshot.mjs <upstream checkout> <out file>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [up, out] = process.argv.slice(2).map((p) => path.resolve(p));
const catalog = path.join(up, 'server/providers/cctv/catalog.js');
// LIVE_PACKS is module-private: load a copy that exports it, next to the original so its imports resolve
const copy = path.join(path.dirname(catalog), '.iris-catalog.mjs');
fs.writeFileSync(copy, `${fs.readFileSync(catalog, 'utf8')}\nexport { LIVE_PACKS as __LIVE_PACKS };\n`);
const { __LIVE_PACKS } = await import(pathToFileURL(copy).href);
fs.rmSync(copy);

const packs = {};
await Promise.all(
  __LIVE_PACKS.map(async (pack) => {
    if (!pack.enabled()) return;
    try {
      const items = await pack.load({ sourceRoot: up });
      packs[pack.name] = { items: [...items], available: items.available ?? null, region: items.region ?? null };
    } catch (e) {
      console.warn(`[cctv] ${pack.name}: ${e?.message || e}`);
    }
  }),
);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ at: Date.now(), packs }));
console.log('cctv packs:', Object.entries(packs).map(([n, p]) => `${n} ${p.items.length}`).join(', '));
