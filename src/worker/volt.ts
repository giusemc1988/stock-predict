/**
 * /api/volt/release and /api/volt/asset: Volt lets Chanh paste any GitHub repo/release link and flash
 * straight from it. The browser never talks to GitHub directly (release asset downloads have no CORS,
 * same reason /api/firmware/ exists for RuView) — this Worker fetches on its behalf, GitHub hosts only,
 * one named asset at a time, capped at 16 MiB.
 */
import { allowedReleaseHost, parseRepo } from '../lib/voltFlash'

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
const UA = { 'user-agent': 'neo-hub-volt (github.com/giusemc1988/stock-predict)' }
const MAX_ASSET_BYTES = 16 * 1024 * 1024

interface GithubAsset {
  name: string
  size: number
  browser_download_url: string
}
interface GithubRelease {
  tag_name: string
  assets: GithubAsset[]
}

/** Fallback listing: file names from the public release page's download links (size unknown, reported as 0). */
async function assetsFromReleasePage(owner: string, repo: string, tag: string): Promise<{ name: string; size: number }[]> {
  const r = await fetch(`https://github.com/${owner}/${repo}/releases/expanded_assets/${encodeURIComponent(tag)}`, { headers: UA, signal: AbortSignal.timeout(10000) }).catch(() => null)
  if (!r?.ok) return []
  const html = await r.text()
  const names = new Set<string>()
  const re = /\/releases\/download\/[^"/]+\/([^"?]+)"/g
  for (const m of html.matchAll(re)) {
    const name = decodeURIComponent(m[1])
    if (/\.(bin|json|zip|txt)$/i.test(name)) names.add(name)
  }
  return [...names].map((name) => ({ name, size: 0 }))
}

export async function voltRoute(req: Request, pathname: string): Promise<Response | null> {
  if (pathname === '/api/volt/release') {
    if (req.method !== 'GET') return json({ error: 'GET only' }, 405)
    const url = new URL(req.url)
    const repo = parseRepo(url.searchParams.get('repo') ?? '')
    if (!repo) return json({ error: 'Không đọc được repo. Dán dạng owner/repo hoặc link GitHub.' }, 400)
    const tag = url.searchParams.get('tag')
    const api = `https://api.github.com/repos/${repo.owner}/${repo.repo}/releases/${tag && tag !== 'latest' ? `tags/${encodeURIComponent(tag)}` : 'latest'}`
    const r = await fetch(api, { headers: { ...UA, accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(10000) }).catch(() => null)
    let tagName = tag && tag !== 'latest' ? tag : ''
    let assets: { name: string; size: number }[] = []
    if (r?.ok) {
      const rel = (await r.json()) as GithubRelease
      tagName = rel.tag_name
      assets = (rel.assets ?? []).filter((a) => /\.(bin|json|zip|txt)$/i.test(a.name)).map((a) => ({ name: a.name, size: a.size }))
    } else if ((r?.status === 403 || r?.status === 429) && tagName) {
      // Unauthenticated api.github.com calls from shared Worker IPs get rate-limited (403); the public release page has no such limit.
      assets = await assetsFromReleasePage(repo.owner, repo.repo, tagName)
    } else {
      return json({ error: `GitHub trả lỗi ${r?.status ?? 'network'}. Repo có bản release công khai không?` }, 502)
    }
    if (!assets.length) return json({ error: r?.ok ? 'Bản release này không có file .bin/.json để nạp.' : `GitHub trả lỗi ${r?.status}, và không đọc được trang release.` }, r?.ok ? 404 : 502)
    return json({ repo: `${repo.owner}/${repo.repo}`, tag: tagName, assets })
  }
  if (pathname === '/api/volt/asset') {
    if (req.method !== 'GET') return json({ error: 'GET only' }, 405)
    const url = new URL(req.url)
    const repo = parseRepo(url.searchParams.get('repo') ?? '')
    const tag = url.searchParams.get('tag')
    const name = url.searchParams.get('name')
    if (!repo || !tag || !name || /[/\\]/.test(name)) return json({ error: 'Thiếu repo/tag/tên file' }, 400)
    const src = `https://github.com/${repo.owner}/${repo.repo}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(name)}`
    if (!allowedReleaseHost(src)) return json({ error: 'Chỉ cho phép link GitHub' }, 400)
    const r = await fetch(src, { redirect: 'follow', headers: UA, signal: AbortSignal.timeout(20000) }).catch(() => null)
    if (!r?.ok) return json({ error: `Tải thất bại (${r?.status ?? 'network'})` }, 502)
    const len = Number(r.headers.get('content-length') ?? '0')
    if (len > MAX_ASSET_BYTES) return json({ error: `File ${name} lớn hơn 16 MB, Volt không tải.` }, 413)
    return new Response(r.body, { headers: { 'content-type': 'application/octet-stream', 'cache-control': 'private, max-age=3600' } })
  }
  return null
}
