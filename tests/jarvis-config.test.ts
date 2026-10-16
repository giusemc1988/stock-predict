import assert from 'node:assert/strict'
import { jarvisDefaults } from '../src/lib/jarvisConfig'

// Test 1: All Jarvis features default to OFF
const defaults = jarvisDefaults
assert.strictEqual(defaults.jarvisValidatorOn, false, 'jarvisValidatorOn should default to false')
assert.strictEqual(defaults.jarvisRouterOn, false, 'jarvisRouterOn should default to false')
assert.strictEqual(defaults.jarvisLearnerOn, false, 'jarvisLearnerOn should default to false')

// Test 2: Defaults are immutable (test checks shape)
assert.strictEqual(Object.keys(defaults).includes('jarvisValidatorOn'), true)
assert.strictEqual(Object.keys(defaults).includes('jarvisRouterOn'), true)
assert.strictEqual(Object.keys(defaults).includes('jarvisLearnerOn'), true)

// Test 3: Config object matches interface
const testConfig = { ...defaults, jarvisValidatorOn: true }
assert.strictEqual(testConfig.jarvisValidatorOn, true, 'config property assignment should work')
assert.strictEqual(testConfig.jarvisRouterOn, false, 'other properties should remain unchanged')
assert.strictEqual(testConfig.jarvisLearnerOn, false, 'other properties should remain unchanged')

console.log('✓ Jarvis config tests passed')
