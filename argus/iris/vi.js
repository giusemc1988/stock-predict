// Iris: Vietnamese for the upstream God's Eye View UI (see iris.css). Upstream ships es/ru/zh-CN only, so this
// swaps exact English strings (text, title, aria-label, placeholder) in the DOM. Default is Vietnamese; the Iris bar
// has a VI/EN switch. A language picked in the upstream selector (es, ru, zh) turns this off.
;(() => {
  const KEY = 'iris:lang:v2' // v2: everyone starts on Vietnamese again (an old EN choice no longer sticks)
  const root = document.documentElement
  const dict = {
    // first view, buttons, status
    // v0.3.0 phone tab bar (upstream mobile shell)
    'layers': 'Lớp',
    'cameras': 'Camera',
    'search': 'Tìm',
    'more': 'Thêm',
    'panels': 'Bảng',
    'tip: the gev mic button in the dock lets you talk to the map.': 'Mẹo: nút MIC ở thanh dưới cho phép nói chuyện với bản đồ.',
    'mission control · first launch': 'Trung tâm điều khiển · lần đầu',
    'choose your first view': 'Chọn cách xem đầu tiên',
    'it feels like a forbidden cockpit—then you realize the sources are public and the data is real.': 'Nghe như buồng lái bí mật, nhưng nguồn đều công khai và dữ liệu là thật.',
    'live contacts': 'Mục tiêu trực tiếp',
    'aircraft, vessels and nearby intelligence': 'Máy bay, tàu thuyền và thông tin gần đây',
    'space missions': 'Sứ mệnh vũ trụ',
    'launches, spacecraft and orbital context': 'Phóng tên lửa, tàu vũ trụ và quỹ đạo',
    'environmental': 'Môi trường',
    'live earthquakes and active fires, from usgs and nasa': 'Động đất và cháy rừng trực tiếp, từ USGS và NASA',
    'explore manually': 'Tự khám phá',
    'begin with a clean globe': 'Bắt đầu với địa cầu trống',
    "don't show this again": 'Không hiện lại',
    'esc to dismiss': 'ESC để đóng',
    'loading live data': 'Đang tải dữ liệu trực tiếp',
    'load complete': 'Tải xong',
    'load failed': 'Tải lỗi',
    'syncing road network': 'Đang đồng bộ mạng đường',
    'loading frames': 'Đang tải khung hình',
    'flying to austin, tx...': 'Đang bay tới Austin, TX...',
    'initializing photorealistic world...': 'Đang khởi tạo thế giới...',
    'globe actions': 'Thao tác địa cầu',
    'turn off all selected data layers': 'Tắt tất cả lớp đang bật',
    'clear selected data layers': 'Tắt tất cả lớp đang bật',
    'copy share link': 'Sao chép liên kết chia sẻ',
    'toggle straight-down and tilted map views': 'Chuyển giữa nhìn thẳng xuống và nhìn nghiêng',
    'reset map to north up': 'Đặt bản đồ hướng bắc lên trên',
    'reset camera and return to full globe view': 'Zoom ra toàn địa cầu',
    'reset to full globe view': 'Zoom ra toàn địa cầu',
    'collapse panel': 'Thu gọn',
    'search any location...': 'Tìm địa điểm...',
    'search any location': 'Tìm địa điểm',
    'interface language': 'Ngôn ngữ giao diện',
    'no matching languages': 'Không có ngôn ngữ phù hợp',
    // dock
    'location': 'Địa điểm',
    'visual presets': 'Chế độ hình ảnh',
    'normal': 'Bình thường',
    'map source': 'Nguồn bản đồ',
    'style': 'Kiểu',
    'sat': 'Vệ tinh',
    'noir': 'Đen trắng',
    'snow': 'Tuyết',
    'anime': 'Hoạt hình',
    'nvg': 'Nhìn đêm',
    'flir': 'Nhiệt',
    'crt': 'CRT',
    // panels and layers
    'data layers': 'Lớp dữ liệu',
    'movement': 'Di chuyển',
    'satellites': 'Vệ tinh',
    'live flights': 'Máy bay trực tiếp',
    'flights': 'Máy bay',
    'military flights': 'Máy bay quân sự',
    'military aircraft': 'Máy bay quân sự',
    'local ads-b': 'ADS-B tại chỗ',
    'local': 'Tại chỗ',
    'live vessels': 'Tàu thuyền trực tiếp',
    'vessels': 'Tàu thuyền',
    'street traffic': 'Giao thông đường phố',
    'transit': 'Giao thông công cộng',
    'bike share': 'Xe đạp công cộng',
    'cameras': 'Camera',
    'cctv + street view fallback': 'CCTV + Street View dự phòng',
    'cctv': 'CCTV',
    'recent imagery': 'Ảnh vệ tinh mới',
    'street level': 'Ảnh đường phố',
    'infrastructure': 'Hạ tầng',
    'mapped alpr cameras': 'Camera biển số (cộng đồng)',
    'mapped installations': 'Cơ sở trên bản đồ',
    'data centers': 'Trung tâm dữ liệu',
    'submarine cables': 'Cáp ngầm biển',
    'dams': 'Đập nước',
    'events': 'Sự kiện',
    'space missions (30d)': 'Sứ mệnh vũ trụ (30 ngày)',
    'earthquakes (24h)': 'Động đất (24 giờ)',
    'active fires': 'Cháy rừng đang cháy',
    'fire perimeters': 'Ranh giới đám cháy',
    'gnss integrity': 'Nhiễu GPS',
    'weather': 'Thời tiết',
    'air quality': 'Chất lượng không khí',
    'wind': 'Gió',
    'rain radar': 'Radar mưa',
    'satellite clouds': 'Mây vệ tinh',
    'lightning density': 'Mật độ sét',
    'cyclone advisories': 'Bão và xoáy thuận',
    'utilities': 'Tiện ích',
    'directions': 'Chỉ đường',
    'radio': 'Radio',
    'live': 'TRỰC TIẾP',
    'observed': 'QUAN TRẮC',
    'forecast': 'DỰ BÁO',
    'new': 'Mới',
    'scenes': 'Cảnh',
    'display': 'Hiển thị',
    'context': 'Ngữ cảnh',
    'contacts': 'Mục tiêu',
    'select context': 'Chọn ngữ cảnh',
    'search nearby sites': 'Tìm địa điểm gần',
    'imagery': 'Ảnh',
    'select box': 'Chọn vùng',
    'use view': 'Dùng khung nhìn',
    'clear': 'Xóa',
    'zoom in': 'Phóng to',
    'latest': 'Mới nhất',
    'play': 'Phát',
    'observed history': 'Lịch sử quan trắc',
    'enable cctv to load camera intersections': 'Bật lớp Camera để tải camera giao lộ',
    'cctv off': 'CCTV tắt',
    'nearest': 'Gần nhất',
    'focus': 'Tập trung',
    'no cameras available in catalog.': 'Không có camera nào trong danh mục.',
    'acquiring frame': 'Đang lấy khung hình',
    'hud': 'HUD',
    'bloom': 'Phát sáng',
    'sharpen': 'Làm nét',
    'clean ui': 'Ẩn giao diện',
    'draw': 'Vẽ',
    'import': 'Nhập',
    'notes & sources': 'Ghi chú và nguồn',
    'close data attribution': 'Đóng nguồn dữ liệu',
    'data attribution': 'Nguồn dữ liệu',
    'powered by esri': 'Cung cấp bởi Esri',
    'language: english': 'Ngôn ngữ: Tiếng Anh',
    'change the interface language': 'Đổi ngôn ngữ giao diện',
  }
  const store = {
    get: () => {
      try {
        return localStorage.getItem(KEY) || 'vi'
      } catch {
        return 'vi'
      }
    },
    set: (v) => {
      try {
        localStorage.setItem(KEY, v)
      } catch {
        /* private window: the choice lasts until reload */
      }
    },
  }
  let lang = store.get()
  const foreign = () => /^(es|ru|zh)/i.test(root.lang || '')
  const active = () => lang === 'vi' && !foreign()
  const keep = new WeakMap() // node or element → original English
  const ATTRS = ['title', 'aria-label', 'placeholder']

  // same case as the source: "LOCATION" → "ĐỊA ĐIỂM"
  const shape = (src, out) => (src === src.toUpperCase() && /[A-Z]{2}/.test(src) ? out.toUpperCase() : out)
  const look = (s) => {
    const t = s.trim()
    const hit = t && dict[t.toLowerCase()]
    return hit ? s.replace(t, shape(t, hit)) : null
  }

  // keep remembers {src, out} per node, so text the app rewrites later is treated as new English, not as our output
  function text(node) {
    const rec = keep.get(node)
    const src = rec && node.nodeValue === rec.out ? rec.src : node.nodeValue
    const out = active() ? look(src) : null
    if (out != null) {
      if (node.nodeValue !== out) node.nodeValue = out
      keep.set(node, { src, out })
    } else if (rec && node.nodeValue === rec.out) {
      node.nodeValue = rec.src
      keep.delete(node)
    }
  }
  function attrs(el) {
    const recs = keep.get(el) || {}
    for (const a of ATTRS) {
      const cur = el.getAttribute(a)
      if (cur == null) continue
      const rec = recs[a]
      const src = rec && cur === rec.out ? rec.src : cur
      const out = active() ? look(src) : null
      if (out != null) {
        if (cur !== out) el.setAttribute(a, out)
        recs[a] = { src, out }
      } else if (rec && cur === rec.out) {
        el.setAttribute(a, rec.src)
        delete recs[a]
      }
    }
    keep.set(el, recs)
  }
  function sweep(scope) {
    const w = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
    let n
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) {
        if (n.parentElement && !/^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentElement.tagName) && !n.parentElement.closest('.material-symbols-outlined')) text(n) // icon ligatures ("layers", "search") must stay English
      } else attrs(n)
    }
    if (scope.nodeType === 1) attrs(scope)
  }

  let queued = false
  function run() {
    if (queued) return
    queued = true
    requestAnimationFrame(() => {
      queued = false
      sweep(document.body)
    })
  }
  function start() {
    run()
    new MutationObserver(run).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS })
    new MutationObserver(run).observe(root, { attributes: true, attributeFilter: ['lang'] })
  }

  const set = (v) => {
    lang = v
    store.set(lang)
    sweep(document.body)
    document.dispatchEvent(new CustomEvent('iris-lang'))
    return lang
  }
  window.irisLang = {
    get: () => (active() ? 'vi' : 'en'),
    set,
    toggle: () => set(lang === 'vi' ? 'en' : 'vi'),
  }

  // The upstream language list ships en/es/ru/zh only. Add a Vietnamese row on top and keep the corner code in step.
  function pickerRow() {
    const list = document.getElementById('locale-picker-listbox')
    const code = document.querySelector('.locale-picker-code')
    const vi = window.irisLang.get() === 'vi'
    const upstreamEn = root.lang === 'en' || !root.lang
    if (code && upstreamEn && code.textContent !== (vi ? 'VI' : 'EN')) code.textContent = vi ? 'VI' : 'EN'
    if (!list) return
    let row = document.getElementById('iris-vi-option')
    if (!row) {
      row = document.createElement('li')
      row.id = 'iris-vi-option'
      row.className = 'locale-picker-option'
      row.setAttribute('role', 'option')
      row.lang = 'vi'
      row.dataset.irisLocale = 'vi'
      row.innerHTML = '<span class="locale-picker-text"><span class="locale-picker-native">Tiếng Việt</span><span class="locale-picker-meta"><span class="locale-picker-option-code" translate="no">VI</span></span></span>'
      list.prepend(row)
    }
    const en = list.querySelector('[data-locale="en"]')
    const on = vi && upstreamEn
    row.classList.toggle('is-active', on)
    if (row.getAttribute('aria-selected') !== String(on)) row.setAttribute('aria-selected', String(on))
    if (en && on && en.classList.contains('is-active')) {
      en.classList.remove('is-active')
      en.setAttribute('aria-selected', 'false')
    }
  }
  let rowQueued = false
  const queueRow = () => {
    if (rowQueued) return
    rowQueued = true
    requestAnimationFrame(() => {
      rowQueued = false
      pickerRow()
    })
  }
  document.addEventListener(
    'click',
    (e) => {
      const row = e.target.closest?.('.locale-picker-option')
      if (!row) return
      if (row.dataset.irisLocale === 'vi') {
        e.stopPropagation()
        set('vi')
        document.querySelector('.locale-picker-button[aria-expanded="true"]')?.click()
      } else if (row.dataset.locale === 'en') set('en')
    },
    true,
  )
  document.addEventListener('iris-lang', pickerRow)
  new MutationObserver(queueRow).observe(document.documentElement, { childList: true, subtree: true })
  if (document.body) start()
  else addEventListener('DOMContentLoaded', start)
})()
