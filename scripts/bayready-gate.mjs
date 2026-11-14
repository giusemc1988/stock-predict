// BayReady gate: the automatic check every BayReady change must pass before it goes to the reviewer.
// No AI, no network. Usage: node bayready-gate.mjs <extension folder> [--prev <manifest.json of the version now released>]
// Prints "GATE: green" or "GATE: red" then one reason per line. Exit code 1 when red.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { execFileSync } from 'node:child_process'
import vm from 'node:vm'

const SKIP = new Set(['.git', 'node_modules', 'backup', 'backups', '__MACOSX'])
const walk = (dir, out = []) => {
  for (const n of readdirSync(dir)) {
    if (SKIP.has(n)) continue
    const p = join(dir, n)
    statSync(p).isDirectory() ? walk(p, out) : out.push(p)
  }
  return out
}
/** Plain version compare: 3.19.2 vs 3.20 */
export const cmpVersion = (a, b) => {
  const x = String(a).split('.').map(Number)
  const y = String(b).split('.').map(Number)
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0) ? -1 : 1
  return 0
}
function jsOk(file, src) {
  try {
    new vm.Script(src, { filename: file })
    return null
  } catch (e) {
    if (!/import|export/.test(String(e.message))) return e.message
    // an ES module file: let node check it as a module
    const d = mkdtempSync(join(tmpdir(), 'gate-'))
    try {
      const f = join(d, 'm.mjs')
      writeFileSync(f, src)
      execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' })
      return null
    } catch (e2) {
      return String(e2.stderr || e2.message).split('\n').find((l) => /Error/.test(l)) || 'syntax error'
    } finally {
      rmSync(d, { recursive: true, force: true })
    }
  }
}
/** Returns the list of problems (empty = green). */
export function gate(dir, prevManifest) {
  const bad = []
  if (!existsSync(join(dir, 'manifest.json'))) return ['no manifest.json in ' + dir]
  const files = walk(dir)
  const rel = (f) => relative(dir, f).replace(/\\/g, '/')
  let mf = null
  try {
    mf = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
  } catch (e) {
    bad.push(`manifest.json is not valid JSON: ${e.message}`)
  }
  for (const f of files) {
    if (!/\.(js|mjs|json|html|css)$/i.test(f) || statSync(f).size > 5e6) continue
    const src = readFileSync(f, 'utf8')
    if (/^(<{7}|={7}|>{7})( |$)/m.test(src)) bad.push(`${rel(f)}: merge conflict marker`)
    // only JSON the extension itself loads must parse: a helper's own config in the same folder (com.bayready.updater.json) is not extension code
    if (/\.json$/i.test(f) && (rel(f) === 'manifest.json' || /(^|\/)_locales\//.test(rel(f)) || /(^|\/)rules[^/]*\.json$/i.test(rel(f)))) {
      try {
        JSON.parse(src)
      } catch (e) {
        bad.push(`${rel(f)}: invalid JSON`)
      }
    }
    if (/\.m?js$/i.test(f)) {
      const m = jsOk(f, src)
      if (m) bad.push(`${rel(f)}: ${m}`)
    }
  }
  if (mf) {
    if (!mf.version) bad.push('manifest.json has no version')
    if (prevManifest?.version && mf.version && cmpVersion(mf.version, prevManifest.version) <= 0) bad.push(`version ${mf.version} is not newer than the released ${prevManifest.version}`)
    const refs = [mf.background?.service_worker, mf.action?.default_popup, mf.options_page, mf.side_panel?.default_path, ...(mf.content_scripts ?? []).flatMap((c) => [...(c.js ?? []), ...(c.css ?? [])]), ...Object.values(mf.icons ?? {}), ...Object.values(mf.action?.default_icon ?? {})].filter((x) => typeof x === 'string')
    for (const r of refs) if (!existsSync(join(dir, r))) bad.push(`manifest points to a missing file: ${r}`)
  }
  return bad
}

if (/bayready-gate\.mjs$/.test(process.argv[1] ?? '')) {
  const dir = process.argv[2]
  const pi = process.argv.indexOf('--prev')
  let prev = null
  try {
    if (pi > 0) prev = JSON.parse(readFileSync(process.argv[pi + 1], 'utf8'))
  } catch {
    /* no previous manifest: version check skipped */
  }
  const bad = dir ? gate(dir, prev) : ['usage: node bayready-gate.mjs <folder>']
  console.log(`GATE: ${bad.length ? 'red' : 'green'}`)
  for (const b of bad.slice(0, 20)) console.log(`- ${b}`)
  process.exit(bad.length ? 1 : 0)
}
