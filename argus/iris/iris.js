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
    bar.append(locateButton(), flightButton(), langButton())
    document.body.append(bar)
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
