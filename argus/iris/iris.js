// Iris: compact mode for phone/tablet over the upstream God's Eye View build (see iris.css).
// Adds one small bar with two buttons that open the data-layer stack or the context rail in a drawer.
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
