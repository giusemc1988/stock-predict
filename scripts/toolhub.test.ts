import assert from 'node:assert/strict'
import { CLUSTERS, TOOLS, fold, graphLayout, searchTools, toolOpen } from '../src/lib/toolHub'
import { VIRALTECH, postCounts } from '../src/data/viraltech'
import { PROJECTS, pageOn, searchHub } from '../src/lib/projects'
import { historyStep, linkedPage } from '../src/lib/pageHistory'
import { crashPlace } from '../src/components/PanelGuard'

// accents and hyphens fold away, so Vietnamese and "wifi" searches match
assert.equal(fold('Tốc độ'), 'toc do')
assert.equal(fold('Đo Wi-Fi'), 'do wifi')
assert.ok(searchTools('toc do').has('speed'))
assert.ok(searchTools('flash').has('flash'))
assert.ok(searchTools('wifi').has('wifi'))
assert.ok(searchTools('ESP32').has('flash'), 'group name is searchable too')
assert.equal(searchTools('').size, TOOLS.length)
assert.equal(searchTools('zzzz-no-match').size, 0)

// ids are unique, every label and note has text in both languages
assert.equal(new Set(TOOLS.map((t) => t.id)).size, TOOLS.length)
for (const t of TOOLS) {
  for (const b of [t.label, t.note]) {
    assert.ok(b.en.trim() && b.vi.trim(), `${t.id} needs EN and VI text`)
  }
  assert.ok(CLUSTERS.some((c) => c.id === t.cluster), `${t.id} has a known cluster`)
}

// soon tools never open; a page switched off in Settings stays closed
const on = { net: true, ruview: true }
assert.equal(toolOpen(TOOLS.find((t) => t.id === 'apps')!, on), false)
assert.equal(toolOpen(TOOLS.find((t) => t.id === 'wifi')!, { net: false, ruview: true }), false)
assert.equal(toolOpen(TOOLS.find((t) => t.id === 'desk')!, { net: false, ruview: false }), true)

// Viraltech opens its page, lists the 4 channels once each, and counts posts by status
assert.ok(searchTools('viraltech').has('viraltech'))
assert.equal(toolOpen(TOOLS.find((t) => t.id === 'viraltech')!, { net: false, ruview: false }), true)
assert.deepEqual(VIRALTECH.channels.map((c) => c.platform).sort(), ['facebook', 'instagram', 'tiktok', 'youtube'])
assert.ok(!Number.isNaN(Date.parse(VIRALTECH.asOf)), 'snapshot has a real time')
assert.deepEqual(postCounts([{ id: 'a', platform: 'instagram', text: '', status: 'scheduled', at: null, views: null, engagement: null }]), { draft: 0, scheduled: 1, published: 0, failed: 0 })

// layout: every group and tool has a point, all inside the 720 x 440 box
const lay = graphLayout()
assert.equal(lay.groups.size, CLUSTERS.length)
assert.equal(lay.nodes.size, TOOLS.length)
for (const p of [...lay.groups.values(), ...lay.nodes.values()]) {
  assert.ok(p.x >= 0 && p.x <= lay.W && p.y >= 0 && p.y <= lay.H, `point ${p.x},${p.y} inside the box`)
}
// Jarvis Hub: every project has a unique id, both languages, and only known tools
assert.equal(new Set(PROJECTS.map((p) => p.id)).size, PROJECTS.length)
for (const p of PROJECTS) {
  assert.ok(p.what.en.trim() && p.what.vi.trim(), `${p.id} needs EN and VI text`)
  for (const id of p.tools) assert.ok(TOOLS.some((t) => t.id === id), `${p.id} tool ${id} exists`)
}
// a tool belongs to one project at most
const owned = PROJECTS.flatMap((p) => p.tools)
assert.equal(new Set(owned).size, owned.length)
// search: a project name comes first, tools are found in either language, accents ignored
assert.equal(searchHub('nova')[0].project.id, 'nova')
assert.equal(searchHub('nova')[0].tool, undefined)
assert.ok(searchHub('wifi').some((h) => h.project.id === 'nexus' && h.tool?.id === 'wifi'))
assert.ok(searchHub('nap firmware').some((h) => h.tool?.id === 'flash'))
assert.ok(searchHub('toc do').some((h) => h.tool?.id === 'speed'))
assert.deepEqual(searchHub('  '), [])
// a page switched off in Settings does not open
const allOn = { net: true, ruview: true, godseye: true, studio: true }
assert.equal(pageOn('net', { ...allOn, net: false }), false)
assert.equal(pageOn('ruview-flash', { ...allOn, ruview: false }), false)
assert.equal(pageOn('brief', allOn), true)
assert.equal(pageOn(null, allOn), false)
// swipe-back: a project opened from the Hub is one step; going home walks back; Atlas tabs don't stack
assert.deepEqual(historyStep('home', 'net', 'home', 0), { kind: 'push' })
// short links: /#nova opens Nova, any case, unknown names do nothing
assert.equal(linkedPage('#nova'), 'studio')
assert.equal(linkedPage('#/Atlas'), 'trade')
assert.equal(linkedPage('#argus'), 'godseye')
assert.equal(linkedPage(''), null)
assert.equal(linkedPage('#toString'), null)
assert.equal(linkedPage('#iris'), 'godseye')
// a crash names the innermost components (Chrome and Safari stacks)
assert.equal(crashPlace('\n    at StudioRenderPanel (https://x/a.js:1:2)\n    at section\n    at VideoStudioPage (https://x/a.js:3:4)'), 'StudioRenderPanel < section < VideoStudioPage')
assert.equal(crashPlace('Hub@https://x/a.js:1:2\nApp@https://x/a.js:3:4'), 'Hub < App')
assert.equal(crashPlace(undefined), '')
assert.deepEqual(historyStep('net', 'home', 'home', 1), { kind: 'back', steps: 1 })
assert.deepEqual(historyStep('brief', 'trade', 'home', 1), { kind: 'replace' })
assert.deepEqual(historyStep('portfolio', 'home', 'home', 1), { kind: 'back', steps: 1 })
assert.deepEqual(historyStep('home', 'home', 'home', 0), { kind: 'none' })
assert.deepEqual(historyStep('brief', 'trade', 'brief', 0), { kind: 'push' }, 'Hub off: Atlas first page is home')
assert.deepEqual(historyStep('home', 'home', 'home', 0), { kind: 'none' })
console.log('toolhub ok')
