// In-memory node:fs for the bundled upstream providers (build.mjs aliases node:fs here): the
// config files are embedded at build time, cache writes live as long as the isolate.
import seed from 'virtual:seed';
import path from 'node:path';
const files = new Map();
const dirs = new Set(['/']);
const norm = (p) => path.resolve(String(p instanceof URL ? p.pathname : p));
const enoent = (p) => Object.assign(new Error(`ENOENT: no such file or directory, '${p}'`), { code: 'ENOENT' });
const addDirs = (p) => { for (let d = path.dirname(p); !dirs.has(d); d = path.dirname(d)) dirs.add(d) };
for (const [k, v] of Object.entries(seed)) { const p = norm('/bundle/' + k); files.set(p, v); addDirs(p) }
const enc = (v, o) => { const e = typeof o === 'string' ? o : o?.encoding; return e ? (typeof v === 'string' ? v : new TextDecoder().decode(v)) : typeof v === 'string' ? Buffer.from(v) : Buffer.from(v) };
const stat = (p) => { p = norm(p); if (files.has(p)) { const v = files.get(p); return { isFile: () => true, isDirectory: () => false, size: v.length, mtimeMs: 0, mtime: new Date(0) } } if (dirs.has(p)) return { isFile: () => false, isDirectory: () => true, size: 0, mtimeMs: 0, mtime: new Date(0) }; throw enoent(p) };
export const existsSync = (p) => { p = norm(p); return files.has(p) || dirs.has(p) };
export const readFileSync = (p, o) => { p = norm(p); if (!files.has(p)) throw enoent(p); return enc(files.get(p), o) };
export const writeFileSync = (p, d) => { p = norm(p); addDirs(p); files.set(p, typeof d === 'string' ? d : new Uint8Array(d)) };
export const appendFileSync = (p, d) => { p = norm(p); writeFileSync(p, (files.has(p) ? enc(files.get(p), 'utf8') : '') + String(d)) };
export const mkdirSync = (p) => { p = norm(p); addDirs(p + '/x'); return p };
export const statSync = stat;
export const readdirSync = (p) => { p = norm(p); const out = new Set(); for (const k of [...files.keys(), ...dirs]) if (path.dirname(k) === p && k !== p) out.add(path.basename(k)); return [...out] };
export const rmSync = (p) => { p = norm(p); for (const k of [...files.keys()]) if (k === p || k.startsWith(p + '/')) files.delete(k) };
export const unlinkSync = rmSync;
export const renameSync = (a, b) => { a = norm(a); b = norm(b); if (!files.has(a)) throw enoent(a); writeFileSync(b, files.get(a)); files.delete(a) };
let tmp = 0;
export const mkdtempSync = (prefix) => { const p = norm(prefix + (++tmp)); mkdirSync(p); return p };
export const accessSync = (p) => { if (!existsSync(p)) throw enoent(p) };
export const copyFileSync = (a, b) => writeFileSync(b, readFileSync(a));
const wrap = (f) => async (...a) => f(...a);
export const promises = {
  readFile: wrap(readFileSync), writeFile: wrap(writeFileSync), appendFile: wrap(appendFileSync), mkdir: wrap(mkdirSync),
  stat: wrap(stat), rm: wrap(rmSync), unlink: wrap(rmSync), rename: wrap(renameSync), readdir: wrap(readdirSync),
  mkdtemp: wrap(mkdtempSync), access: wrap(accessSync), copyFile: wrap(copyFileSync), realpath: wrap(norm),
}
const cb = (f) => (...a) => { const done = typeof a.at(-1) === 'function' ? a.pop() : null; try { const r = f(...a); done?.(null, r) } catch (e) { done?.(e) } };
export const readFile = cb(readFileSync), writeFile = cb(writeFileSync), mkdir = cb(mkdirSync), access = cb(accessSync), rm = cb(rmSync), mkdtemp = cb(mkdtempSync), copyFile = cb(copyFileSync);
export const createReadStream = () => { throw new Error('createReadStream unsupported') };
export const createWriteStream = () => { throw new Error('createWriteStream unsupported') };
export const constants = { F_OK: 0, R_OK: 4, W_OK: 2, X_OK: 1 };
export default { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync, statSync, readdirSync, rmSync, unlinkSync, renameSync, mkdtempSync, accessSync, copyFileSync, promises, readFile, writeFile, mkdir, access, rm, mkdtemp, copyFile, createReadStream, createWriteStream, constants };
