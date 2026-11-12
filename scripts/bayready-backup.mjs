// BayReady recovery copies (Chanh 2026-11-12): every machine that is on keeps the two newest BayReady
// versions as zips in a "BayReady-backups" folder on its Desktop. Called by team-bridge.mjs each run;
// it only zips when the version in manifest.json is not saved yet, and only prunes its own zips.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const KEEP = 2
const NAME = /^bayready-v(\d+(?:\.\d+)*)\.zip$/

/** Compare "2.63" and "2.9" as versions (2.63 is newer). */
export const cmpVersion = (a, b) => {
  const x = a.split('.').map(Number)
  const y = b.split('.').map(Number)
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0)
  return 0
}

/** Backup zips to delete so only the `keep` newest versions stay. Other files are never touched. */
export function toPrune(names, keep = KEEP) {
  const zips = names.filter((n) => NAME.test(n)).sort((a, b) => cmpVersion(b.match(NAME)[1], a.match(NAME)[1]))
  return zips.slice(keep)
}

/** The Desktop folder (OneDrive Desktop on Windows when it exists). */
export function backupDir(home = homedir()) {
  const desk = [join(home, 'OneDrive', 'Desktop'), join(home, 'Desktop')].find((d) => existsSync(d)) ?? join(home, 'Desktop')
  return join(desk, 'BayReady-backups')
}

/** Zip the BayReady source `src` (a folder with manifest.json) into the backup folder if its version is new. */
export function backupBayReady(src, dir = backupDir()) {
  if (!src || !existsSync(join(src, 'manifest.json'))) return null
  const version = String(JSON.parse(readFileSync(join(src, 'manifest.json'), 'utf8')).version ?? '').trim()
  if (!/^\d+(\.\d+)*$/.test(version)) return null
  mkdirSync(dir, { recursive: true })
  const zip = join(dir, `bayready-v${version}.zip`)
  if (existsSync(zip)) return null
  const opts = { timeout: 120000, stdio: 'ignore', windowsHide: true }
  if (existsSync(join(src, '.git'))) execFileSync('git', ['archive', '--format=zip', '-o', zip, 'HEAD'], { ...opts, cwd: src })
  else if (process.platform === 'win32') execFileSync('tar', ['-a', '-c', '-f', zip, '-C', src, '.'], opts)
  else execFileSync('python3', ['-m', 'zipfile', '-c', zip, ...readdirSync(src).filter((n) => !n.startsWith('.')).map((n) => join(src, n))], opts)
  const pruned = toPrune(readdirSync(dir))
  for (const n of pruned) unlinkSync(join(dir, n))
  return `saved bayready-v${version}.zip${pruned.length ? `, removed ${pruned.join(', ')}` : ''}`
}
