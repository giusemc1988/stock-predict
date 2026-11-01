import assert from 'node:assert/strict'
import { detectFirmware, nexusBoard, parseVitalsLine, roomChange, roomState } from '../src/lib/s3Kit'

// firmware detection from boot/log lines
assert.equal(detectFirmware('NEXUS-SCOUT v0.1.0 board=esp32-s3 ready'), 'nexus-scout')
assert.equal(detectFirmware('I (4210) edge_proc: Vitals: br=14.0 hr=70.0 motion=0.0100 pres=YES fall=no persons=1 frames=200 drops=0'), 'ruview')
assert.equal(detectFirmware('RUVIEW_HELLO_OK_V1 nonce=ab chip=esp32s3'), 'ruview')
assert.equal(detectFirmware('rst:0x1 (POWERON)'), 'unknown')
assert.deepEqual(nexusBoard('NEXUS-SCOUT v0.1.0 board=esp32-s3 ready'), { version: '0.1.0', board: 'esp32-s3' })
assert.equal(nexusBoard('hello'), null)

// vitals line, with the ESP-IDF log prefix in front
const line = '\u001b[0;32mI (91234) edge_proc: Vitals: br=14.2 hr=0.0 motion=0.0731 pres=YES fall=no persons=2 frames=400 drops=0\u001b[0m'
const v = parseVitalsLine(line)!
assert.deepEqual(v, { breathing: 14.2, heart: null, motion: 0.0731, present: true, fall: false, persons: 2, frames: 400 })
assert.equal(parseVitalsLine('csi_collector: CSI cb #3'), null)
assert.equal(roomState(v), 'moving')
assert.equal(roomState({ ...v, motion: 0.01 }), 'still')
assert.equal(roomState({ ...v, present: false }), 'empty')

// changes worth an alert
const empty = { ...v, present: false }
assert.equal(roomChange(null, v), null)
assert.equal(roomChange(empty, v), 'enter')
assert.equal(roomChange(v, empty), 'leave')
assert.equal(roomChange(v, v), null)
assert.equal(roomChange(v, { ...v, fall: true }), 'fall')
assert.equal(roomChange({ ...v, fall: true }, { ...v, fall: true }), null)
console.log('s3kit ok')
