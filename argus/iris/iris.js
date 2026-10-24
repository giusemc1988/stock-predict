// Iris: compact mode for phone/tablet over the upstream God's Eye View build (see iris.css).
// Adds one small bar with two buttons that open the data-layer stack or the context rail in a drawer.
// Loaded without defer, before the app, so the Overpass detour below is in place for its first query.
;(() => {
  // Overpass mirrors refuse Cloudflare's IPs, so the browser asks them itself (they allow CORS)
  // and only falls back to the Worker's /api/overpass when every mirror fails.
  const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.private.coffee/api/interpreter']
  const appFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url
    const method = (init?.method || (typeof input === 'object' && input?.method) || 'GET').toUpperCase()
    if (method !== 'POST' || !url || new URL(url, location.href).href !== new URL('/api/overpass', location.href).href || typeof init?.body !== 'string') return appFetch(input, init)
    for (const m of MIRRORS) {
      try {
        const r = await appFetch(m, { method: 'POST', body: init.body, headers: { 'content-type': 'application/x-www-form-urlencoded' }, signal: init.signal })
        if (r.ok) return r
      } catch (e) {
        if (init.signal?.aborted) throw e
      }
    }
    return appFetch(input, init)
  }
})()

;(() => {
  const root = document.documentElement
  const compact = matchMedia('(max-width: 1100px), (hover: none)')
  const sync = () => root.classList.toggle('iris-compact', compact.matches)
  sync()
  compact.addEventListener?.('change', sync)

  // the Hub passes its theme accent (?accent=#rrggbb) so the bar matches the page around the globe
  const accent = new URLSearchParams(location.search).get('accent')
  if (accent && /^#[0-9a-f]{3,8}$/i.test(accent)) root.style.setProperty('--iris-acc', accent)

  const vi = () => /^vi/i.test(root.lang || navigator.language || '')
  const icon = {
    left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M14 4v16"/></svg>',
  }
  const label = { left: () => (vi() ? 'Lớp dữ liệu' : 'Layers'), right: () => (vi() ? 'Bảng' : 'Panels') }

  function open(side) {
    const next = root.dataset.irisOpen === side ? '' : side
    if (next) root.dataset.irisOpen = next
    else delete root.dataset.irisOpen
    for (const b of document.querySelectorAll('#iris-bar button')) b.setAttribute('aria-pressed', String(b.dataset.side === next))
  }

  function mount() {
    if (document.getElementById('iris-bar')) return
    const bar = document.createElement('div')
    bar.id = 'iris-bar'
    for (const side of ['left', 'right']) {
      const b = document.createElement('button')
      b.type = 'button'
      b.dataset.side = side
      b.setAttribute('aria-pressed', 'false')
      b.innerHTML = `${icon[side]}<span>${label[side]()}</span>`
      b.addEventListener('click', () => open(side))
      bar.append(b)
    }
    document.body.append(bar)
    // relabel when the app switches language
    new MutationObserver(() => {
      for (const b of bar.querySelectorAll('button')) b.querySelector('span').textContent = label[b.dataset.side]()
    }).observe(root, { attributes: true, attributeFilter: ['lang'] })
  }

  // a tap on the globe closes the drawer
  addEventListener('pointerdown', (e) => {
    if (!root.dataset.irisOpen) return
    if (e.target.closest?.('#iris-bar, #left-panel-stack, #right-context-rail')) return
    if (e.target.closest?.('#cesiumContainer')) open('')
  })

  if (document.body) mount()
  else addEventListener('DOMContentLoaded', mount)
})()
