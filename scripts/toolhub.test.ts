import assert from 'node:assert/strict'
import { CLUSTERS, TOOLS, fold, graphLayout, searchTools, toolOpen } from '../src/lib/toolHub'

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

// layout: every group and tool has a point, all inside the 720 x 440 box
const lay = graphLayout()
assert.equal(lay.groups.size, CLUSTERS.length)
assert.equal(lay.nodes.size, TOOLS.length)
for (const p of [...lay.groups.values(), ...lay.nodes.values()]) {
  assert.ok(p.x >= 0 && p.x <= lay.W && p.y >= 0 && p.y <= lay.H, `point ${p.x},${p.y} inside the box`)
}
console.log('toolhub ok')
