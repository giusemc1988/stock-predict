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
    // a mirror that never answers must not hold the "fetching mapped sites" banner forever: 8 s each
    const within = (ms) => {
      const c = new AbortController()
      const stop = () => c.abort()
      init.signal?.addEventListener('abort', stop)
      const t = setTimeout(stop, ms)
      return { signal: c.signal, done: () => (clearTimeout(t), init.signal?.removeEventListener('abort', stop)) }
    }
    for (const m of MIRRORS) {
      const w = within(8000)
      try {
        const r = await appFetch(m, { method: 'POST', body: init.body, headers: { 'content-type': 'application/x-www-form-urlencoded' }, signal: w.signal })
        if (r.ok) return r
      } catch (e) {
        if (init.signal?.aborted) throw e
      } finally {
        w.done()
      }
    }
    return appFetch(input, init)
  }

  // Safety net: if the loading banner keeps saying the same "mapped sites" line for 25 s, hide it (the data keeps loading)
  const SITES = /MAPPED SITES|SITIOS MAPEADOS/i
  let since = 0
  setInterval(() => {
    const el = document.getElementById('global-loading-status')
    const stuck = el && SITES.test(el.textContent || '') && getComputedStyle(el).display !== 'none'
    if (!stuck) {
      since = 0
      el?.classList.remove('iris-hide')
      return
    }
    since = since || Date.now()
    if (Date.now() - since > 25000) el.classList.add('iris-hide')
  }, 3000)
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

  const vi = () => (window.irisLang ? window.irisLang.get() === 'vi' : !/^en/i.test(root.lang || ''))
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

  // "My location": ask the browser for the position and fly the globe camera there
  const msg = {
    label: () => (vi() ? 'Vị trí' : 'My location'),
    wait: () => (vi() ? 'Đang lấy vị trí…' : 'Finding your location…'),
    denied: () => (vi() ? 'Chưa cho phép vị trí. Hãy bật quyền Vị trí cho trang này trong cài đặt trình duyệt.' : 'Location permission denied. Allow location for this site in the browser settings.'),
    unavailable: () => (vi() ? 'Không lấy được vị trí. Thử lại ở chỗ có sóng tốt hơn.' : 'Could not get your location. Try again with a better signal.'),
    noMap: () => (vi() ? 'Bản đồ chưa sẵn sàng, thử lại sau vài giây.' : 'The map is not ready yet, try again in a few seconds.'),
  }
  const pin = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/></svg>'

  function toast(text) {
    let t = document.getElementById('iris-toast')
    if (!t) {
      t = document.createElement('div')
      t.id = 'iris-toast'
      t.setAttribute('role', 'status')
      document.body.append(t)
    }
    t.textContent = text
    t.hidden = !text
    clearTimeout(toast.timer)
    if (text) toast.timer = setTimeout(() => (t.hidden = true), 6000)
  }

  function flightButton() {
    const b = document.createElement('button')
    b.type = 'button'
    b.id = 'iris-flightbtn'
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg><span></span>'
    const relabel = () => (b.querySelector('span').textContent = vi() ? 'Chuyến bay' : 'Flight')
    relabel()
    document.addEventListener('iris-lang', relabel)
    b.addEventListener('click', () => b.setAttribute('aria-pressed', String(!!window.irisFlightSearch?.toggle())))
    return b
  }

  function eventsButton() {
    const b = document.createElement('button')
    b.type = 'button'
    b.id = 'iris-eventsbtn'
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 12h4l2-6 4 12 2-6h6"/></svg><span></span>'
    const relabel = () => (b.querySelector('span').textContent = vi() ? 'Sự kiện' : 'Events')
    relabel()
    document.addEventListener('iris-lang', relabel)
    b.addEventListener('click', () => b.setAttribute('aria-pressed', String(!!window.irisEvents?.toggle())))
    return b
  }

  // VI / EN switch for the Iris text (vi.js holds the dictionary)
  function langButton() {
    const b = document.createElement('button')
    b.type = 'button'
    b.id = 'iris-lang'
    b.setAttribute('aria-label', 'Tiếng Việt / English')
    const paint = () => (b.textContent = vi() ? 'VI' : 'EN')
    paint()
    b.addEventListener('click', () => window.irisLang?.toggle())
    document.addEventListener('iris-lang', paint)
    return b
  }

  function locateButton() {
    const b = document.createElement('button')
    b.type = 'button'
    b.id = 'iris-locate'
    b.innerHTML = `${pin}<span>${msg.label()}</span>`
    b.addEventListener('click', () => {
      if (b.dataset.busy) return
      if (!navigator.geolocation) return toast(msg.unavailable())
      b.dataset.busy = '1'
      b.setAttribute('aria-busy', 'true')
      toast(msg.wait())
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          delete b.dataset.busy
          b.removeAttribute('aria-busy')
          const viewer = window.__godsEyeView?.viewer
          const Cart = viewer?.camera?.position?.constructor
          if (!Cart?.fromDegrees) return toast(msg.noMap())
          toast('')
          window.irisPos = { lat: pos.coords.latitude, lon: pos.coords.longitude }
          viewer.camera.flyTo({
            destination: Cart.fromDegrees(pos.coords.longitude, pos.coords.latitude, 3000),
            orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 },
            duration: 3,
          })
        },
        (err) => {
          delete b.dataset.busy
          b.removeAttribute('aria-busy')
          toast(err?.code === 1 ? msg.denied() : msg.unavailable())
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
      )
    })
    const relabel = () => (b.querySelector('span').textContent = msg.label())
    new MutationObserver(relabel).observe(root, { attributes: true, attributeFilter: ['lang'] })
    document.addEventListener('iris-lang', relabel)
    return b
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
    bar.append(locateButton(), flightButton(), eventsButton(), langButton())
    document.body.append(bar)
    // the bar wraps to 1-3 rows depending on the screen: keep the camera buttons just below it
    const fit = () => root.style.setProperty('--iris-bar-h', `${Math.ceil(bar.getBoundingClientRect().height)}px`)
    fit()
    if (window.ResizeObserver) new ResizeObserver(fit).observe(bar)
    // relabel when the app switches language
    const relabel = () => {
      for (const b of bar.querySelectorAll('button[data-side]')) b.querySelector('span').textContent = label[b.dataset.side]()
    }
    new MutationObserver(relabel).observe(root, { attributes: true, attributeFilter: ['lang'] })
    document.addEventListener('iris-lang', relabel)
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

// Quick layers: big toggles for what is used most, grouped, at the top of the Layers drawer. Each chip clicks the
// upstream layer's own toggle button, so upstream stays the owner of the state. The choice is remembered; flights,
// earthquakes and rain radar are on the first time.
;(() => {
  const root = document.documentElement
  const KEY = 'iris:layers:v1'
  const DEFAULT_ON = ['flights', 'earthquakes', 'weather-radar']
  const vi = () => (window.irisLang ? window.irisLang.get() === 'vi' : !/^en/i.test(root.lang || ''))
  const GROUPS = [
    { vi: 'Máy bay', en: 'Aircraft', items: [['flights', '✈️', 'Máy bay', 'Flights'], ['military', '🎖️', 'Quân sự', 'Military']] },
    { vi: 'Giao thông và camera', en: 'Traffic and cameras', items: [['cctv', '📹', 'Camera CCTV', 'CCTV cameras'], ['traffic', '🚗', 'Giao thông', 'Traffic'], ['transit', '🚌', 'Xe buýt, tàu', 'Transit vehicles'], ['ais-live-vessels', '🚢', 'Tàu thuyền', 'Ships']] },
    { vi: 'Thời tiết', en: 'Weather', items: [['weather-radar', '🌧️', 'Radar mưa', 'Rain radar'], ['weather-satellite', '☁️', 'Mây', 'Clouds'], ['wind', '💨', 'Gió', 'Wind'], ['weather-cyclones', '🌀', 'Bão', 'Storms'], ['weather-lightning', '⚡', 'Sét', 'Lightning'], ['air-quality', '😷', 'Không khí', 'Air quality']] },
    { vi: 'Thiên tai', en: 'Disasters', items: [['earthquakes', '🌍', 'Động đất', 'Earthquakes'], ['local-firms', '🔥', 'Cháy rừng', 'Wildfires'], ['satellites', '🛰️', 'Vệ tinh', 'Satellites']] },
  ]
  const btnOf = (id) => document.querySelector(`#data-toggles [data-layer-id="${CSS.escape(id)}"] .data-toggle-btn`)
  const rowOf = (id) => document.querySelector(`#data-toggles [data-layer-id="${CSS.escape(id)}"]`)
  const all = GROUPS.flatMap((g) => g.items.map((i) => i[0]))

  function read() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || 'null')
      return Array.isArray(v) ? v : null
    } catch {
      return null
    }
  }
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(all.filter((id) => btnOf(id)?.classList.contains('active'))))
    } catch {
      /* private window: the choice lasts until reload */
    }
  }

  let box
  let ready = false // set once the remembered layers are on, so the defaults are never saved over the choice
  function sync() {
    if (!box) return
    if (ready) save()
    let busy = 0
    for (const chip of box.querySelectorAll('button[data-id]')) {
      const b = btnOf(chip.dataset.id)
      const on = !!b?.classList.contains('active')
      const wait = !!b && (b.getAttribute('aria-busy') === 'true' || b.classList.contains('transitioning'))
      chip.classList.toggle('on', on)
      chip.classList.toggle('wait', wait)
      chip.setAttribute('aria-pressed', String(on))
      chip.disabled = !b
      if (wait) busy++
      const n = rowOf(chip.dataset.id)?.querySelector('.data-count')?.textContent?.trim()
      chip.querySelector('em').textContent = on && n && n !== '—' ? n : ''
    }
    let bar = document.getElementById('iris-loadbar')
    if (busy && !bar) {
      bar = document.createElement('div')
      bar.id = 'iris-loadbar'
      bar.setAttribute('role', 'progressbar')
      bar.innerHTML = '<i></i>'
      document.body.append(bar)
    } else if (!busy && bar) bar.remove()
  }

  function labels() {
    if (!box) return
    for (const h of box.querySelectorAll('h4[data-g]')) h.textContent = GROUPS[h.dataset.g][vi() ? 'vi' : 'en']
    for (const chip of box.querySelectorAll('button[data-id]')) chip.querySelector('b').textContent = chip.dataset[vi() ? 'vi' : 'en']
  }

  function build() {
    const stack = document.getElementById('left-panel-stack')
    if (!stack || box || !document.querySelector('#data-toggles .data-toggle-row')) return false
    box = document.createElement('div')
    box.id = 'iris-quick'
    GROUPS.forEach((g, gi) => {
      const h = document.createElement('h4')
      h.dataset.g = String(gi)
      const grid = document.createElement('div')
      for (const [id, icon, v, e] of g.items) {
        const c = document.createElement('button')
        c.type = 'button'
        c.dataset.id = id
        c.dataset.vi = v
        c.dataset.en = e
        c.innerHTML = `<span aria-hidden="true">${icon}</span><b></b><em></em><i class="bar"></i>`
        c.addEventListener('click', () => {
          btnOf(id)?.click()
        })
        grid.append(c)
      }
      box.append(h, grid)
    })
    stack.prepend(box)
    labels()
    sync()
    // layers on: what was left on last time, else the defaults
    const want = read() ?? DEFAULT_ON
    const todo = want.filter((id) => all.includes(id))
    setTimeout(() => (ready = true), 1500 + todo.length * 500)
    todo.forEach((id, i) =>
      setTimeout(() => {
        const b = btnOf(id)
        if (b && !b.classList.contains('active')) b.click()
      }, 600 + i * 500),
    )
    new MutationObserver(sync).observe(document.getElementById('data-toggles'), { subtree: true, attributes: true, childList: true, characterData: true })
    document.addEventListener('iris-lang', labels)
    return true
  }

  const poll = new MutationObserver(() => build() && poll.disconnect())
  const start = () => (build() ? 0 : poll.observe(document.body, { childList: true, subtree: true }))
  if (document.body) start()
  else addEventListener('DOMContentLoaded', start)
})()

// Flight search: type a flight number (VJ123, VN456, HVN456) and see where it is, how high and fast, and its route.
// Live position comes from the argus Worker (/api/flight-lookup: adsb.lol, then the GitHub snapshot); the route
// (origin, destination, airline) from adsbdb.com, which answers browsers directly. Free, no keys.
// What free data cannot give: delay or schedule status, and aircraft nobody's receiver hears.
;(() => {
  const root = document.documentElement
  const vi = () => (window.irisLang ? window.irisLang.get() === 'vi' : !/^en/i.test(root.lang || ''))
  const T = (v, e) => (vi() ? v : e)
  // airline IATA code → ICAO code, the callsign prefix ADS-B uses
  const ICAO = { VN: 'HVN', VJ: 'VJC', QH: 'BAV', VU: 'VAG', BL: 'PIC', '0V': 'VFC', SQ: 'SIA', TR: 'TGW', TG: 'THA', FD: 'AIQ', AK: 'AXM', D7: 'XAX', QZ: 'AWQ', SL: 'TLM', DD: 'NOK', GA: 'GIA', MH: 'MAS', PR: 'PAL', '5J': 'CEB', CX: 'CPA', KA: 'HDA', HX: 'CRK', CI: 'CAL', BR: 'EVA', KE: 'KAL', OZ: 'AAR', '7C': 'JJA', LJ: 'JNA', JL: 'JAL', NH: 'ANA', MU: 'CES', CA: 'CCA', CZ: 'CSN', MF: 'CXA', HU: 'CHH', EK: 'UAE', QR: 'QTR', EY: 'ETD', TK: 'THY', SV: 'SVA', AI: 'AIC', '6E': 'IGO', QF: 'QFA', NZ: 'ANZ', LH: 'DLH', BA: 'BAW', AF: 'AFR', KL: 'KLM', LX: 'SWR', OS: 'AUA', SK: 'SAS', AY: 'FIN', IB: 'IBE', AZ: 'ITY', TP: 'TAP', SU: 'AFL', FR: 'RYR', U2: 'EZY', W6: 'WZZ', AA: 'AAL', UA: 'UAL', DL: 'DAL', WN: 'SWA', AS: 'ASA', B6: 'JBU', NK: 'NKS', F9: 'FFT', AC: 'ACA', WS: 'WJA', AM: 'AMX', LA: 'LAN', AV: 'AVA', CM: 'CMP', ET: 'ETH', MS: 'MSR', SA: 'SAA' }
  const callsign = (raw) => {
    const q = raw.replace(/[\s-]+/g, '').toUpperCase()
    const m = q.match(/^([A-Z0-9]{2})(\d{1,4}[A-Z]?)$/)
    if (m && ICAO[m[1]]) return ICAO[m[1]] + m[2] // VJ123 → VJC123
    return q
  }
  const getJson = async (url, ms = 9000) => {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(ms) })
      return r.ok ? await r.json() : null
    } catch {
      return null
    }
  }
  const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const place = (a) => (a ? `${esc(a.municipality || a.name)} (${esc(a.iata_code || a.icao_code)})` : '?')

  let card
  function ensure() {
    if (card) return card
    card = document.createElement('div')
    card.id = 'iris-flight'
    card.hidden = true
    card.innerHTML = `<form><input type="search" inputmode="text" autocapitalize="characters" autocomplete="off" enterkeyhint="search" /><button type="submit"></button></form><div class="bar" hidden><i></i></div><div class="out" role="status"></div>`
    card.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault()
      look(card.querySelector('input').value)
    })
    document.body.append(card)
    paint()
    return card
  }
  function paint() {
    if (!card) return
    card.querySelector('input').placeholder = T('Số hiệu: VJ123, VN456…', 'Flight no.: VJ123, VN456…')
    card.querySelector('button').textContent = T('Tra', 'Search')
  }

  async function look(raw) {
    const q = raw.trim()
    const out = card.querySelector('.out')
    const bar = card.querySelector('.bar')
    if (!q) return
    const cs = callsign(q)
    bar.hidden = false
    out.textContent = T('Đang tìm chuyến bay…', 'Looking for the flight…')
    const [live, route] = await Promise.all([getJson(`/api/flight-lookup?cs=${encodeURIComponent(cs)}`), getJson(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(cs)}`)])
    bar.hidden = true
    const fr = route?.response?.flightroute
    const head = `<b>${esc(fr?.callsign_iata || q.toUpperCase())}</b>${fr?.airline ? ` · ${esc(fr.airline.name)}` : ''}`
    const path = fr ? `<p>${place(fr.origin)} → ${place(fr.destination)}</p>` : ''
    if (!live?.found) {
      out.innerHTML = `${head}${path}<p>${T('Chưa thấy tín hiệu máy bay này (đang chưa bay, hoặc không có trạm thu sóng ADS-B gần). Giờ trễ/đúng giờ thì dữ liệu miễn phí chưa có.', 'No signal from this aircraft right now (not flying, or no ADS-B receiver nearby). Delay and schedule status is not available from free data.')}</p>`
      return
    }
    const state = live.onGround ? T('Đang ở mặt đất', 'On the ground') : (live.vrateFpm ?? 0) > 500 ? T('Đang bay lên', 'Climbing') : (live.vrateFpm ?? 0) < -500 ? T('Đang hạ độ cao', 'Descending') : T('Đang bay', 'Cruising')
    const age = live.source === 'snapshot' ? ` · ${T('dữ liệu cách đây', 'data from')} ${Math.round(live.ageSec / 60)} ${T('phút', 'min ago')}` : ''
    out.innerHTML = `${head}${path}<p><strong>${state}</strong>${age}</p><p>${T('Độ cao', 'Altitude')} ${live.altFt ?? '?'} ft · ${T('Tốc độ', 'Speed')} ${live.speedKt ?? '?'} kt · ${T('Hướng', 'Heading')} ${live.track ?? '?'}°</p><button type="button" class="go">${T('Bay tới máy bay', 'Fly to the aircraft')}</button>`
    out.querySelector('.go').addEventListener('click', () => {
      const viewer = window.__godsEyeView?.viewer
      const Cart = viewer?.camera?.position?.constructor
      if (!Cart?.fromDegrees) return
      viewer.camera.flyTo({ destination: Cart.fromDegrees(live.lon, live.lat, 40000), orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 }, duration: 3 })
    })
  }

  window.irisFlightSearch = {
    toggle() {
      const c = ensure()
      c.hidden = !c.hidden
      if (!c.hidden) c.querySelector('input').focus()
      return !c.hidden
    },
  }
  document.addEventListener('iris-lang', paint)
  new MutationObserver(paint).observe(root, { attributes: true, attributeFilter: ['lang'] })
})()

// Recent events list: quakes (USGS), wildfires, storms, floods and volcanoes (NASA EONET). Tap a row, the globe flies there.
;(() => {
  const root = document.documentElement
  const vi = () => (window.irisLang ? window.irisLang.get() === 'vi' : !/^en/i.test(root.lang || ''))
  const T = (a, b) => (vi() ? a : b)
  const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const KINDS = {
    quake: { icon: '🌍', vi: 'Động đất', en: 'Earthquakes', alt: 400000 },
    fire: { icon: '🔥', vi: 'Cháy rừng', en: 'Wildfires', alt: 120000 },
    storm: { icon: '🌀', vi: 'Bão, lũ, núi lửa', en: 'Storms, floods, volcanoes', alt: 600000 },
  }
  const EONET = { wildfires: 'fire', severeStorms: 'storm', floods: 'storm', volcanoes: 'storm' }
  const km = (a, b, c, d) => {
    const r = Math.PI / 180
    const h = Math.sin(((c - a) * r) / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2
    return 12742 * Math.asin(Math.sqrt(h))
  }
  const ago = (t) => {
    const m = Math.max(1, Math.round((Date.now() - t) / 60000))
    return m < 90 ? `${m} ${T('phút trước', 'min ago')}` : m < 2880 ? `${Math.round(m / 60)} ${T('giờ trước', 'h ago')}` : `${Math.round(m / 1440)} ${T('ngày trước', 'd ago')}`
  }
  const getJson = (u) => fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null)

  let card
  let items = null
  let kind = 'all'
  let sortNear = false

  async function load() {
    const [q, e] = await Promise.all([getJson('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson'), getJson('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=80&category=wildfires,severeStorms,floods,volcanoes')])
    const out = []
    for (const f of q?.features || []) {
      const coords = f.geometry.coordinates
      const [lon, lat] = coords
      out.push({ kind: 'quake', lat, lon, t: f.properties.time, title: `M${(f.properties.mag ?? 0).toFixed(1)} · ${f.properties.place || ''}`, weight: f.properties.mag, depth: coords[2], felt: f.properties.felt, tsunami: f.properties.tsunami, link: f.properties.url })
    }
    for (const ev of e?.events || []) {
      const g = ev.geometry?.[ev.geometry.length - 1]
      if (!g || g.type !== 'Point') continue
      out.push({ kind: EONET[ev.categories?.[0]?.id] || 'storm', lat: g.coordinates[1], lon: g.coordinates[0], t: Date.parse(g.date), title: ev.title, weight: 0, cat: ev.categories?.[0]?.title, size: g.magnitudeValue, unit: g.magnitudeUnit, link: ev.sources?.[0]?.url || ev.link })
    }
    return out.length ? out : null
  }

  function near() {
    return new Promise((ok) => {
      if (window.irisPos) return ok(window.irisPos)
      if (!navigator.geolocation) return ok(null)
      navigator.geolocation.getCurrentPosition(
        (p) => ok((window.irisPos = { lat: p.coords.latitude, lon: p.coords.longitude })),
        () => ok(null),
        { timeout: 12000, maximumAge: 600000 },
      )
    })
  }

  function fly(it) {
    const viewer = window.__godsEyeView?.viewer
    const Cart = viewer?.camera?.position?.constructor
    if (!Cart?.fromDegrees) return
    viewer.camera.flyTo({ destination: Cart.fromDegrees(it.lon, it.lat, KINDS[it.kind].alt), orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 }, duration: 3 })
    card.hidden = true
    document.getElementById('iris-eventsbtn')?.setAttribute('aria-pressed', 'false')
  }

  function paint() {
    if (!card) return
    const tabs = ['all', ...Object.keys(KINDS)]
    card.querySelector('.tabs').innerHTML =
      tabs.map((k) => `<button type="button" data-k="${k}" aria-pressed="${k === kind}">${k === 'all' ? T('Tất cả', 'All') : `${KINDS[k].icon} ${KINDS[k][vi() ? 'vi' : 'en']}`}</button>`).join('') +
      `<button type="button" data-near="1" aria-pressed="${sortNear}">📍 ${T('Gần tôi', 'Near me')}</button>`
    const out = card.querySelector('.list')
    if (!items) return
    const me = window.irisPos
    let rows = items.filter((i) => kind === 'all' || i.kind === kind)
    if (me) rows.forEach((i) => (i.d = km(me.lat, me.lon, i.lat, i.lon)))
    rows = rows.sort((a, b) => (sortNear && me ? a.d - b.d : b.t - a.t)).slice(0, 40)
    out.innerHTML = rows.length
      ? rows.map((i, n) => `<button type="button" class="row" data-n="${n}"><span>${KINDS[i.kind].icon}</span><span><b>${esc(i.title)}</b><small>${ago(i.t)}${me && i.d != null ? ` · ${Math.round(i.d).toLocaleString()} km ${T('từ anh', 'from you')}` : ''}</small></span></button>`).join('')
      : `<p>${T('Chưa có sự kiện nào trong mục này.', 'No events in this list.')}</p>`
    out.querySelectorAll('.row').forEach((r) => r.addEventListener('click', () => detail(r, rows[+r.dataset.n])))
  }

  const aqiText = (v) => (v <= 50 ? T('Tốt', 'Good') : v <= 100 ? T('Trung bình', 'Moderate') : v <= 150 ? T('Không tốt cho người nhạy cảm', 'Unhealthy for sensitive groups') : v <= 200 ? T('Xấu', 'Unhealthy') : v <= 300 ? T('Rất xấu', 'Very unhealthy') : T('Nguy hại', 'Hazardous'))
  // tap a row: facts about the event, air quality and weather there (Open-Meteo, free), and a button to fly there
  async function detail(row, it) {
    const open = row.nextElementSibling?.classList.contains('detail')
    card.querySelectorAll('.detail').forEach((d) => d.remove())
    if (open) return
    const d = document.createElement('div')
    d.className = 'detail'
    const facts = []
    if (it.kind === 'quake') {
      facts.push(`${T('Cấp độ', 'Magnitude')} <b>M${(it.weight ?? 0).toFixed(1)}</b>${it.weight >= 7 ? ` (${T('rất mạnh', 'major')})` : it.weight >= 6 ? ` (${T('mạnh', 'strong')})` : it.weight >= 5 ? ` (${T('khá mạnh', 'moderate')})` : ` (${T('nhẹ', 'light')})`}`)
      if (it.depth != null) facts.push(`${T('Độ sâu', 'Depth')} ${Math.round(it.depth)} km`)
      if (it.felt) facts.push(`${it.felt} ${T('người báo cảm nhận được', 'people felt it')}`)
      facts.push(it.tsunami ? `⚠️ ${T('Có cảnh báo sóng thần', 'Tsunami warning issued')}` : T('Không có cảnh báo sóng thần', 'No tsunami warning'))
    } else {
      if (it.cat) facts.push(`${T('Loại', 'Type')}: ${esc(it.cat)}`)
      if (it.size) facts.push(`${T('Quy mô', 'Size')}: ${esc(it.size)} ${esc(it.unit || '')}`)
    }
    facts.push(ago(it.t))
    d.innerHTML = `<p>${facts.join(' · ')}</p><p class="env">${T('Đang lấy không khí và thời tiết…', 'Loading air quality and weather…')}</p><div class="acts"><button type="button" class="go">${T('Bay tới đây', 'Fly here')}</button>${it.link ? `<a href="${esc(it.link)}" target="_blank" rel="noopener">${T('Nguồn', 'Source')}</a>` : ''}</div>`
    d.querySelector('.go').addEventListener('click', () => fly(it))
    row.after(d)
    const [air, wx] = await Promise.all([
      getJson(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${it.lat}&longitude=${it.lon}&current=us_aqi,pm2_5,pm10`),
      getJson(`https://api.open-meteo.com/v1/forecast?latitude=${it.lat}&longitude=${it.lon}&current=temperature_2m,wind_speed_10m,precipitation`),
    ])
    const env = d.querySelector('.env')
    if (!env) return
    const parts = []
    const a = air?.current
    if (a?.us_aqi != null) parts.push(`${T('Không khí', 'Air')}: <b>AQI ${Math.round(a.us_aqi)}</b> (${aqiText(a.us_aqi)})${a.pm2_5 != null ? ` · PM2.5 ${a.pm2_5}` : ''}${a.pm10 != null ? ` · PM10 ${a.pm10}` : ''} µg/m³`)
    const w = wx?.current
    if (w?.temperature_2m != null) parts.push(`${T('Thời tiết', 'Weather')}: ${Math.round(w.temperature_2m)}°C · ${T('gió', 'wind')} ${Math.round(w.wind_speed_10m)} km/h${w.precipitation ? ` · ${T('mưa', 'rain')} ${w.precipitation} mm` : ''}`)
    env.innerHTML = parts.length ? parts.join('<br>') : T('Chưa có dữ liệu không khí cho chỗ này.', 'No air data for this spot.')
  }

  async function open() {
    if (!card) {
      card = document.createElement('div')
      card.id = 'iris-events'
      card.innerHTML = '<div class="tabs"></div><div class="bar"><i></i></div><div class="list" role="status"></div>'
      card.addEventListener('click', async (e) => {
        const t = e.target.closest('.tabs button')
        if (!t) return
        if (t.dataset.near) {
          sortNear = !sortNear
          if (sortNear) {
            card.querySelector('.bar').hidden = false
            const p = await near()
            card.querySelector('.bar').hidden = true
            if (!p) sortNear = false
          }
        } else kind = t.dataset.k
        paint()
      })
      document.body.append(card)
      document.addEventListener('iris-lang', paint)
      paint()
    }
    if (!items) {
      card.querySelector('.bar').hidden = false
      card.querySelector('.list').textContent = T('Đang tải sự kiện…', 'Loading events…')
      items = await load()
      card.querySelector('.bar').hidden = true
      if (!items) card.querySelector('.list').textContent = T('Không tải được dữ liệu. Thử lại sau.', 'Could not load the data. Try again later.')
      else paint()
    }
  }

  window.irisEvents = {
    toggle() {
      if (card?.hidden === false) return (card.hidden = true), false
      open()
      if (card) card.hidden = false
      return true
    },
  }
})()
