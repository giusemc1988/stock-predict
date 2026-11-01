import { useCallback, useEffect, useRef, useState } from 'react'
import type { Bi } from '../lib/hubText'
import { useLang } from '../lib/i18n'
import { VOLT_PRESETS, canFlash, checkParts, describePart, guessOffset, partsFromManifest, type CheckResult, type FlashPart, type WebToolsManifest } from '../lib/voltFlash'
import { backupFlash, connect, flashParts, probe, VoltError, type BoardProbe } from '../lib/voltFlashRun'
import { pushRecent, type RecentFlash } from '../lib/voltNews'
import { AgentShell } from './AgentShell'
import { VoltNews } from './VoltNews'
import { NovaProgress } from './NovaProgress'

const T = {
  back: { en: '← Hub', vi: '← Hub' },
  title: { en: 'Volt · ESP32 Lab', vi: 'Volt · Phòng ESP32' },
  sub: { en: 'Flash any ESP32 board from a GitHub repo link or a dropped .bin file — Volt checks the file matches the chip before it writes anything.', vi: 'Nạp firmware cho board ESP32 bất kỳ từ link repo GitHub hoặc file .bin thả vào — Volt kiểm tra file khớp chip trước khi ghi bất cứ gì.' },
  s1: { en: 'STEP 1 · CONNECT', vi: 'BƯỚC 1 · KẾT NỐI' },
  connect: { en: 'Connect over USB', vi: 'Kết nối qua USB' },
  connecting: { en: 'Connecting…', vi: 'Đang kết nối…' },
  noSupport: { en: 'This browser has no Web Serial. Use Chrome or Edge on a computer.', vi: 'Trình duyệt này không có Web Serial. Dùng Chrome hoặc Edge trên máy tính.' },
  chip: { en: 'Chip', vi: 'Chip' },
  flash: { en: 'Real flash', vi: 'Flash thật' },
  mac: { en: 'MAC', vi: 'MAC' },
  features: { en: 'Features', vi: 'Tính năng' },
  s2: { en: 'STEP 2 · FIRMWARE', vi: 'BƯỚC 2 · FIRMWARE' },
  repoLabel: { en: 'GitHub repo or release link', vi: 'Link repo hay bản release GitHub' },
  repoPlaceholder: { en: 'e.g. ruvnet/ruview or a github.com link', vi: 'ví dụ ruvnet/ruview hoặc link github.com' },
  tag: { en: 'Release tag (blank = latest)', vi: 'Tag bản release (để trống = mới nhất)' },
  presetsLabel: { en: 'Quick pick', vi: 'Chọn nhanh' },
  loadRepo: { en: 'Find firmware in this repo', vi: 'Tìm firmware trong repo này' },
  loadingRepo: { en: 'Reading the release…', vi: 'Đang đọc bản release…' },
  pickAssets: { en: 'Pick the files to load', vi: 'Chọn file cần nạp' },
  manifestFound: { en: 'Found a flash manifest — offsets set automatically.', vi: 'Có sẵn manifest nạp — offset đã tự đặt.' },
  orDrop: { en: '＋ or drop .bin files here', vi: '＋ hoặc thả file .bin vào đây' },
  offset: { en: 'offset', vi: 'offset' },
  s3: { en: 'STEP 3 · CHECK', vi: 'BƯỚC 3 · KIỂM TRA' },
  noFiles: { en: 'Pick firmware first.', vi: 'Chọn firmware trước đã.' },
  backup: { en: '⤓ Back up the board first (optional)', vi: '⤓ Sao lưu board trước (tùy chọn)' },
  backingUp: { en: 'Reading the whole chip…', vi: 'Đang đọc toàn bộ chip…' },
  flashBtn: { en: '⚡ Flash the board', vi: '⚡ Nạp vào board' },
  flashing: { en: 'Flashing…', vi: 'Đang nạp…' },
  done: { en: 'Done. The board restarted.', vi: 'Xong. Board đã khởi động lại.' },
  safe: { en: 'Normal flashing cannot burn a chip. Volt never calls eFuse / secure-boot write commands.', vi: 'Nạp firmware bình thường không làm cháy chip. Volt không bao giờ dùng lệnh ghi eFuse / secure-boot.' },
  errUnsupported: { en: 'Web Serial needs Chrome or Edge on a computer.', vi: 'Web Serial cần Chrome hoặc Edge trên máy tính.' },
  errConnect: { en: 'Could not connect to the board.', vi: 'Không kết nối được board.' },
} satisfies Record<string, Bi>

type GithubAsset = { name: string; size: number }

/** Guesses which of a release's files to preselect: a flash manifest if there is one, else bootloader+app+partition-table by name. */
function defaultPick(assets: GithubAsset[]): string[] {
  const manifest = assets.find((a) => /manifest.*\.json$/i.test(a.name))
  if (manifest) return [manifest.name]
  return assets.filter((a) => /\.(bin)$/i.test(a.name) && !/sample|demo/i.test(a.name)).map((a) => a.name)
}

export function VoltPage({ onBack, glass = true }: { onBack: () => void; glass?: boolean }) {
  const lang = useLang()
  const L = (k: keyof typeof T) => T[k][lang]

  const [board, setBoard] = useState<BoardProbe | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [connErr, setConnErr] = useState<string | null>(null)
  const loaderRef = useRef<Awaited<ReturnType<typeof connect>> | null>(null)

  const [repo, setRepo] = useState('')
  const [tag, setTag] = useState('')
  const [assets, setAssets] = useState<GithubAsset[] | null>(null)
  const [repoBusy, setRepoBusy] = useState(false)
  const [repoErr, setRepoErr] = useState<string | null>(null)
  const [repoInfo, setRepoInfo] = useState<{ repo: string; tag: string } | null>(null)

  const [parts, setParts] = useState<FlashPart[]>([])
  const [loadingParts, setLoadingParts] = useState(false)

  const [backingUp, setBackingUp] = useState(0)
  const [flashBusy, setFlashBusy] = useState<number | null>(null)
  const [flashDone, setFlashDone] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const doConnect = useCallback(async () => {
    setConnErr(null)
    setConnecting(true)
    try {
      const c = await connect(() => {})
      loaderRef.current = c
      setBoard(await probe(c.loader))
    } catch (e) {
      setConnErr(e instanceof VoltError && e.code === 'unsupported' ? L('errUnsupported') : L('errConnect'))
    } finally {
      setConnecting(false)
    }
  }, [lang])

  const findRelease = useCallback(async () => {
    setRepoErr(null)
    setRepoBusy(true)
    setAssets(null)
    setParts([])
    try {
      const q = new URLSearchParams({ repo })
      if (tag.trim()) q.set('tag', tag.trim())
      const r = await fetch(`/api/volt/release?${q}`)
      const j = (await r.json()) as { error?: string; repo?: string; tag?: string; assets?: GithubAsset[] }
      if (!r.ok || !j.assets) {
        setRepoErr(j.error ?? 'HTTP error')
        return
      }
      setAssets(j.assets)
      setRepoInfo({ repo: j.repo!, tag: j.tag! })
    } catch {
      setRepoErr('Network error')
    } finally {
      setRepoBusy(false)
    }
  }, [repo, tag])

  const [recent, setRecent] = useState<RecentFlash[]>(() => {
    try {
      const j = JSON.parse(localStorage.getItem('neo.volt.recent') ?? '[]') as RecentFlash[]
      return Array.isArray(j) ? j.filter((r) => typeof r?.repo === 'string' && typeof r?.tag === 'string') : []
    } catch {
      return []
    }
  })
  const [autoFind, setAutoFind] = useState(false)
  useEffect(() => {
    if (autoFind && repo.trim()) {
      setAutoFind(false)
      void findRelease()
    }
  }, [autoFind, repo, findRelease])

  const downloadAsset = useCallback(
    async (name: string): Promise<Uint8Array> => {
      if (!repoInfo) throw new Error('no repo')
      const q = new URLSearchParams({ repo: repoInfo.repo, tag: repoInfo.tag, name })
      const r = await fetch(`/api/volt/asset?${q}`)
      if (!r.ok) throw new Error(`asset ${name}: ${r.status}`)
      return new Uint8Array(await r.arrayBuffer())
    },
    [repoInfo],
  )

  const loadFromRepo = useCallback(
    async (names: string[]) => {
      if (!assets || !repoInfo) return
      setLoadingParts(true)
      setFlashDone(false)
      try {
        const manifestName = names.find((n) => /manifest.*\.json$/i.test(n))
        if (manifestName) {
          const raw = await downloadAsset(manifestName)
          const manifest = JSON.parse(new TextDecoder().decode(raw)) as WebToolsManifest
          const planned = partsFromManifest(manifest)
          if (planned) {
            const files = await Promise.all(planned.map((p) => downloadAsset(p.path.split('/').pop() ?? p.path)))
            setParts(planned.map((p, i) => describePart(p.path, p.offset, files[i])))
            return
          }
        }
        const picked = names.filter((n) => /\.bin$/i.test(n))
        const files = await Promise.all(picked.map((n) => downloadAsset(n)))
        setParts(picked.map((n, i) => describePart(n, guessOffset(n, board?.chipName ?? null), files[i])))
      } catch (e) {
        setRepoErr(e instanceof Error ? e.message : 'download failed')
      } finally {
        setLoadingParts(false)
      }
    },
    [assets, repoInfo, downloadAsset, board],
  )

  const onDropFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return
      setFlashDone(false)
      const next: FlashPart[] = []
      for (const f of Array.from(files)) {
        const data = new Uint8Array(await f.arrayBuffer())
        next.push(describePart(f.name, guessOffset(f.name, board?.chipName ?? null), data))
      }
      setParts((p) => [...p, ...next])
    },
    [board],
  )

  const checks: CheckResult[] = checkParts(parts, board ? { chipName: board.chipName, flashSizeMB: board.flashSizeMB } : null)
  const ready = parts.length > 0 && canFlash(checks)

  const doBackup = useCallback(async () => {
    const c = loaderRef.current
    if (!c || !board?.flashSizeMB) return
    setBackingUp(1)
    try {
      const data = await backupFlash(c.loader, board.flashSizeMB, (pct) => setBackingUp(Math.max(1, pct)))
      const blob = new Blob([data as Uint8Array<ArrayBuffer>])
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `volt-backup-${board.chipName}-${Date.now()}.bin`
      a.click()
      URL.revokeObjectURL(a.href)
    } finally {
      setBackingUp(0)
    }
  }, [board])

  const doFlash = useCallback(async () => {
    const c = loaderRef.current
    if (!c || !ready) return
    setFlashBusy(0)
    setFlashDone(false)
    try {
      await flashParts(c.loader, parts, { step: () => {}, progress: (pct) => setFlashBusy(pct), log: () => {} })
      setFlashDone(true)
      if (repoInfo) {
        const next = pushRecent(recent, { repo: repoInfo.repo, tag: repoInfo.tag, label: repoInfo.repo.split('/')[1] ?? repoInfo.repo, at: Date.now() })
        setRecent(next)
        try {
          localStorage.setItem('neo.volt.recent', JSON.stringify(next))
        } catch {
          // storage full or blocked: the list just won't persist
        }
      }
    } finally {
      setFlashBusy(null)
    }
  }, [parts, ready, repoInfo, recent])

  return (
    <AgentShell id="volt" glass={glass} onBack={onBack} backLabel={L('back')} title={L('title')} sub={L('sub')}>
      <section className="bf-card">
        <header><h3>{L('s1')}</h3></header>
        {!board ? (
          <>
            <button className="btn primary" disabled={connecting} onClick={() => void doConnect()}>{connecting ? L('connecting') : L('connect')}</button>
            {connErr && <p className="small" role="alert">{connErr}</p>}
          </>
        ) : (
          <div className="rv-kv">
            <div><span>{L('chip')}</span><b>{board.chipName}</b></div>
            <div><span>{L('flash')}</span><b>{board.flashSizeMB ? `${board.flashSizeMB} MB` : '—'}</b></div>
            <div><span>{L('mac')}</span><b className="mono">{board.mac ?? '—'}</b></div>
            {board.features && <div><span>{L('features')}</span><b>{board.features}</b></div>}
          </div>
        )}
      </section>

      <VoltNews chipName={board?.chipName ?? null} recent={recent} onPick={(r, t) => { setRepo(r); setTag(t); setAutoFind(true) }} />

      <section className="bf-card">
        <header><h3>{L('s2')}</h3></header>
        <div className="ag-acts" role="group" aria-label={L('presetsLabel')}>
          {VOLT_PRESETS.map((p) => (
            <button key={p.id} className="btn" onClick={() => { setRepo(p.repo); setTag(p.tag); setAutoFind(true) }}>{lang === 'vi' ? p.vi : p.en}</button>
          ))}
        </div>
        <label className="small">{L('repoLabel')}</label>
        <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder={L('repoPlaceholder')} />
        <label className="small">{L('tag')}</label>
        <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="latest" />
        <div className="ag-acts">
          <button className="btn" disabled={!repo.trim() || repoBusy} onClick={() => void findRelease()}>{repoBusy ? L('loadingRepo') : L('loadRepo')}</button>
        </div>
        {repoErr && <p className="small" role="alert">{repoErr}</p>}
        {assets && (
          <div className="volt-assets">
            <p className="small">{L('pickAssets')}</p>
            {assets.some((a) => /manifest.*\.json$/i.test(a.name)) && <p className="small ok">{L('manifestFound')}</p>}
            <button className="btn primary" disabled={loadingParts} onClick={() => void loadFromRepo(defaultPick(assets))}>
              {loadingParts ? L('loadingRepo') : `⬇ ${defaultPick(assets).join(', ')}`}
            </button>
          </div>
        )}
        <div
          className="volt-drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            void onDropFiles(e.dataTransfer.files)
          }}
          onClick={() => fileInput.current?.click()}
        >
          {L('orDrop')}
        </div>
        <input ref={fileInput} type="file" multiple accept=".bin" hidden onChange={(e) => void onDropFiles(e.target.files)} />
        {parts.length > 0 && (
          <div className="rv-kv">
            {parts.map((p, i) => (
              <div key={`${p.name}-${i}`}>
                <span>{p.name}</span>
                <b className="mono">0x{p.address.toString(16)} <small>{(p.data.length / 1024).toFixed(0)} KB</small></b>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bf-card">
        <header><h3>{L('s3')}</h3></header>
        {!parts.length ? (
          <p className="muted small">{L('noFiles')}</p>
        ) : (
          <div className="volt-tags">
            {checks.map((c) => (
              <span key={c.key} className={`tag tag-${c.level}`}>{c.level === 'ok' ? '✓' : c.level === 'warn' ? '⚠' : '✕'} {c.detail}</span>
            ))}
          </div>
        )}

        {board?.flashSizeMB && (
          <button className="btn" disabled={backingUp > 0} onClick={() => void doBackup()}>{L('backup')}</button>
        )}
        {backingUp > 0 && <NovaProgress label={L('backingUp')} value={backingUp / 100} />}

        <button className="btn primary volt-flash-btn" disabled={!ready || !board || flashBusy !== null} onClick={() => void doFlash()}>
          {flashBusy !== null ? L('flashing') : L('flashBtn')}
        </button>
        {flashBusy !== null && <NovaProgress label={L('flashing')} value={flashBusy / 100} />}
        {flashDone && <p className="small ok" role="status">{L('done')}</p>}

        <p className="small muted">{L('safe')}</p>
      </section>
    </AgentShell>
  )
}
