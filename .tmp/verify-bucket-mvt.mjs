// Deep verification of bucket.ts, event.ts, experiment.ts (MVT)
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'url'
import { mkdirSync, rmSync } from 'fs'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, '_build2')
rmSync(distDir, { recursive: true, force: true })
mkdirSync(distDir, { recursive: true })

// Bundle all the services we want
await build({
  entryPoints: [path.join(__dirname, '..', 'src', 'services', 'bucket.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: path.join(distDir, 'bucket.mjs'),
  external: ['uuid'],
})
await build({
  entryPoints: [path.join(__dirname, '..', 'src', 'services', 'experiment.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: path.join(distDir, 'experiment.mjs'),
  external: ['uuid'],
})
await build({
  entryPoints: [path.join(__dirname, '..', 'src', 'services', 'event.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: path.join(distDir, 'event.mjs'),
  external: ['uuid'],
})
await build({
  entryPoints: [path.join(__dirname, '..', 'src', 'services', 'stats.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: path.join(distDir, 'stats.mjs'),
  external: ['uuid'],
})

// Stubs
const lsStore = {}
const localStorage = {
  getItem: k => lsStore[k] ?? null,
  setItem: (k, v) => { lsStore[k] = String(v) },
  removeItem: k => { delete lsStore[k] },
  get length() { return Object.keys(lsStore).length },
  key: i => Object.keys(lsStore)[i] || null,
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorage, writable: true, configurable: true })
Object.defineProperty(globalThis, 'crypto', { value: { randomUUID: () => 'uuid-' + Math.random() }, writable: true, configurable: true })
Object.defineProperty(globalThis, 'navigator', {
  value: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15' },
  writable: true, configurable: true,
})

const mod = await import(pathToFileURL(path.join(distDir, 'bucket.mjs')).href)
const { assignVariant, getAssignedVariant, storage } = mod
const eventMod = await import(pathToFileURL(path.join(distDir, 'event.mjs')).href)
const { trackEvent, getEventsByExperiment } = eventMod
const expMod = await import(pathToFileURL(path.join(distDir, 'experiment.mjs')).href)
const { generateMVTVariants } = expMod
const statsMod = await import(pathToFileURL(path.join(distDir, 'stats.mjs')).href)
const { calculateExperimentStats } = statsMod

const results = []
const assert = (cond, label) => { results.push({ pass: !!cond, label }); if (!cond) console.error('FAIL:', label) }

const makeExp = (overrides = {}) => ({
  id: 'exp-1',
  name: 'Test',
  description: '',
  status: 'running',
  startDate: '2024-01-01',
  endDate: '',
  goalEvent: 'signup',
  variants: [
    { id: 'v1', name: 'A', html: '', css: '', buttonText: 'a', formFields: [], weight: 1 },
    { id: 'v2', name: 'B', html: '', css: '', buttonText: 'b', formFields: [], weight: 1 },
  ],
  trafficAllocation: { totalTraffic: 100, rolloutPercentage: 100, rolloutHistory: [] },
  targetingRules: [],
  mvtConfig: { enabled: false, factors: [] },
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
})

// ---------- Test 1: Assign on first visit ----------
const exp1 = makeExp()
const v1 = assignVariant(exp1)
console.log('T1: assigned variant:', v1?.id)
assert(v1 !== null, 'T1: should assign a variant for running experiment')
assert(['v1', 'v2'].includes(v1.id), 'T1: assigned variant is one of the two')

// ---------- Test 2: Same visitor gets same variant on repeat ----------
const v1again = getAssignedVariant(exp1)
console.log('T2: same visitor, same variant:', v1again?.id === v1.id)
assert(v1again?.id === v1.id, 'T2: same visitor gets same variant')

// ---------- Test 3: Draft experiment returns null ----------
const draftExp = makeExp({ status: 'draft' })
const dv = assignVariant(draftExp)
console.log('T3: draft returns null:', dv === null)
assert(dv === null, 'T3: draft experiment should not assign')

// ---------- Test 4: Completed experiment returns null ----------
const compExp = makeExp({ status: 'completed' })
const cv = assignVariant(compExp)
console.log('T4: completed returns null:', cv === null)
assert(cv === null, 'T4: completed experiment should not assign')

// ---------- Test 5: Paused experiment returns null ----------
const pausedExp = makeExp({ status: 'paused' })
const pv = assignVariant(pausedExp)
console.log('T5: paused returns null:', pv === null)
assert(pv === null, 'T5: paused experiment should not assign')

// ---------- Test 6: 0% rollout returns null ----------
const zeroExp = makeExp({
  trafficAllocation: { totalTraffic: 100, rolloutPercentage: 0, rolloutHistory: [] },
})
const zv = assignVariant(zeroExp)
console.log('T6: 0% rollout returns null:', zv === null)
assert(zv === null, 'T6: 0% rollout should not assign')

// ---------- Test 7: Distribution check — many visitors, ~50/50 ----------
lsStore['abtest_visitor_id'] = undefined
lsStore['abtest_visitors'] = undefined
const distExp = makeExp()
// Force same visitorId so we don't run out of slots; use fresh visitor per call
const counts = { v1: 0, v2: 0 }
for (let i = 0; i < 1000; i++) {
  // Clear visitor to force new assignment
  lsStore['abtest_visitor_id'] = `vid-${i}`
  lsStore['abtest_visitors'] = '[]'
  const v = assignVariant(distExp)
  if (v) counts[v.id]++
}
console.log('T7: distribution over 1000 runs:', counts)
const ratio = counts.v1 / (counts.v1 + counts.v2)
console.log('T7: v1 ratio:', ratio.toFixed(3), '(expected ~0.5)')
assert(ratio > 0.45 && ratio < 0.55, `T7: distribution should be near 50/50, got v1=${ratio.toFixed(3)}`)

// ---------- Test 8: Weighted distribution (3:1) ----------
lsStore['abtest_visitors'] = '[]'
const weightedExp = makeExp({
  variants: [
    { id: 'v1', name: 'A', html: '', css: '', buttonText: 'a', formFields: [], weight: 3 },
    { id: 'v2', name: 'B', html: '', css: '', buttonText: 'b', formFields: [], weight: 1 },
  ],
})
const wCounts = { v1: 0, v2: 0 }
for (let i = 0; i < 2000; i++) {
  lsStore['abtest_visitor_id'] = `vid-${i}`
  lsStore['abtest_visitors'] = '[]'
  const v = assignVariant(weightedExp)
  if (v) wCounts[v.id]++
}
console.log('T8: weighted (3:1) distribution:', wCounts, 'ratio v1=', (wCounts.v1 / 2000).toFixed(3))
const wRatio = wCounts.v1 / 2000
assert(wRatio > 0.70 && wRatio < 0.80, `T8: 3:1 weight should yield ~75% v1, got ${wRatio.toFixed(3)}`)

// ---------- Test 9: Targeting rule — iOS-only ----------
lsStore['abtest_visitors'] = '[]'
const iosExp = makeExp({
  targetingRules: [{ type: 'device', operator: 'include', values: ['iOS'] }],
})
// Current UA is iPhone → should match
const iosV = assignVariant(iosExp)
console.log('T9: iOS UA on iOS-only exp:', iosV?.id)
assert(iosV !== null, 'T9: iOS user should be included in iOS-only experiment')

// ---------- Test 10: Targeting rule — exclude iOS ----------
lsStore['abtest_visitors'] = '[]'
const excludeIos = makeExp({
  targetingRules: [{ type: 'device', operator: 'exclude', values: ['iOS'] }],
})
const exV = assignVariant(excludeIos)
console.log('T10: iOS UA on exclude-iOS exp:', exV === null ? 'excluded' : exV.id)
assert(exV === null, 'T10: iOS user should be excluded from exclude-iOS experiment')

// ---------- Test 11: MVT 2x2 (2 factors × 2 levels → 4 variants) ----------
const mvtExp = makeExp({
  mvtConfig: {
    enabled: true,
    factors: [
      { id: 'f1', name: '文案', levels: ['A', 'B'] },
      { id: 'f2', name: '配色', levels: ['红', '蓝'] },
    ],
  },
})
const mvtVariants = generateMVTVariants(mvtExp)
console.log('T11: MVT 2x2 generated', mvtVariants.length, 'variants:',
            mvtVariants.map(v => v.name).join(', '))
assert(mvtVariants.length === 4, `T11: should generate 4 variants, got ${mvtVariants.length}`)
const mvtNames = mvtVariants.map(v => v.name).sort()
assert(mvtNames.includes('A / 红') || mvtNames.includes('A 红'),
       'T11: should have A+红 combination')

// ---------- Test 12: MVT 2x3 → 6 variants ----------
const mvt2 = makeExp({
  mvtConfig: {
    enabled: true,
    factors: [
      { id: 'f1', name: 'X', levels: ['1', '2'] },
      { id: 'f2', name: 'Y', levels: ['a', 'b', 'c'] },
    ],
  },
})
const mvt2v = generateMVTVariants(mvt2)
console.log('T12: MVT 2x3 generated', mvt2v.length, 'variants')
assert(mvt2v.length === 6, `T12: should generate 6, got ${mvt2v.length}`)

// ---------- Test 13: MVT disabled → return original variants ----------
const mvtOff = makeExp({ mvtConfig: { enabled: false, factors: [] } })
const mvtOffV = generateMVTVariants(mvtOff)
console.log('T13: MVT disabled, returns', mvtOffV.length, 'variants (should be 2)')
assert(mvtOffV.length === 2, 'T13: disabled MVT returns original variants')

// ---------- Test 14: trackEvent stores events correctly ----------
lsStore['abtest_events'] = undefined
trackEvent('signup', 'exp-1', 'v1', { plan: 'pro' })
const evts = getEventsByExperiment('exp-1')
console.log('T14: tracked event:', evts.length, 'event(s)')
assert(evts.length === 1, 'T14: should have 1 event')
assert(evts[0].eventName === 'signup', 'T14: event name correct')
assert(evts[0].variantId === 'v1', 'T14: variant id correct')
assert(evts[0].properties?.plan === 'pro', 'T14: properties correct')

// ---------- Test 15: Mutex exclusion ----------
lsStore['abtest_visitors'] = JSON.stringify([{
  visitorId: 'shared-vid', experimentId: 'exp-other', variantId: 'vx', assignedAt: 0, firstSeen: 0,
}])
lsStore['abtest_visitor_id'] = 'shared-vid'
lsStore['abtest_mutex_groups'] = JSON.stringify([{
  id: 'mg-1', name: 'Group 1', experimentIds: ['exp-1', 'exp-other'],
}])
const mutexExp = makeExp({ mutuallyExclusiveGroupId: 'mg-1' })
const mxv = assignVariant(mutexExp)
console.log('T15: mutex violation returns:', mxv === null ? 'null (excluded)' : mxv.id)
assert(mxv === null, 'T15: visitor already in mutex group should be excluded')

// ---------- Test 16: Rollout 100% always included, 0% never ----------
lsStore['abtest_visitors'] = '[]'
const r100 = makeExp({
  trafficAllocation: { totalTraffic: 100, rolloutPercentage: 100, rolloutHistory: [] },
})
lsStore['abtest_visitor_id'] = 'vid-rollout-100'
const rh = assignVariant(r100)
assert(rh !== null, 'T16a: 100% rollout should always include')

lsStore['abtest_visitors'] = '[]'
const r0 = makeExp({
  trafficAllocation: { totalTraffic: 100, rolloutPercentage: 0, rolloutHistory: [] },
})
lsStore['abtest_visitor_id'] = 'vid-rollout-0'
const rl = assignVariant(r0)
assert(rl === null, 'T16b: 0% rollout should always exclude')

// ---------- Test 17: Stats — visits count = visitor records -----
lsStore['abtest_events'] = undefined
lsStore['abtest_visitors'] = undefined
// Use bucket mod's storage (already imported as `mod.storage`)
// But for clarity, use `storage` from statsMod's bundle
const _storage = mod.storage
const _calcStats = statsMod.calculateExperimentStats
// Create a fresh experiment for stats
const sExp = makeExp({ id: 'stats-exp' })
// Add 5 visitors to v1, 5 to v2
const visitors = []
for (let i = 0; i < 5; i++) {
  visitors.push({ visitorId: `v1-vis-${i}`, experimentId: 'stats-exp', variantId: 'v1', assignedAt: 0, firstSeen: 0 })
  visitors.push({ visitorId: `v2-vis-${i}`, experimentId: 'stats-exp', variantId: 'v2', assignedAt: 0, firstSeen: 0 })
}
_storage.setVisitors(visitors)
// Add 2 conversions on v1, 3 on v2
const events = [
  { id: 'e1', experimentId: 'stats-exp', variantId: 'v1', eventName: 'signup', timestamp: 0, visitorId: 'v1-vis-0' },
  { id: 'e2', experimentId: 'stats-exp', variantId: 'v1', eventName: 'signup', timestamp: 0, visitorId: 'v1-vis-1' },
  { id: 'e3', experimentId: 'stats-exp', variantId: 'v2', eventName: 'signup', timestamp: 0, visitorId: 'v2-vis-0' },
  { id: 'e4', experimentId: 'stats-exp', variantId: 'v2', eventName: 'signup', timestamp: 0, visitorId: 'v2-vis-1' },
  { id: 'e5', experimentId: 'stats-exp', variantId: 'v2', eventName: 'signup', timestamp: 0, visitorId: 'v2-vis-2' },
]
_storage.setEvents(events)

const sStats = _calcStats(sExp)
console.log('T17: stats:', JSON.stringify(sStats.variantStats, null, 2))
const v1s = sStats.variantStats.find(v => v.variantId === 'v1')
const v2s = sStats.variantStats.find(v => v.variantId === 'v2')
console.log('T17: v1 uniqueVisitors=', v1s.uniqueVisitors, 'conversions=', v1s.conversions, 'rate=', v1s.conversionRate)
console.log('T17: v2 uniqueVisitors=', v2s.uniqueVisitors, 'conversions=', v2s.conversions, 'rate=', v2s.conversionRate)
assert(v1s.uniqueVisitors === 5, 'T17: v1 should have 5 unique visitors')
assert(v2s.uniqueVisitors === 5, 'T17: v2 should have 5 unique visitors')
assert(v1s.conversions === 2, 'T17: v1 should have 2 conversions')
assert(v2s.conversions === 3, 'T17: v2 should have 3 conversions')
assert(Math.abs(v1s.conversionRate - 0.4) < 0.001, `T17: v1 rate 0.4, got ${v1s.conversionRate}`)
assert(Math.abs(v2s.conversionRate - 0.6) < 0.001, `T17: v2 rate 0.6, got ${v2s.conversionRate}`)

// ---------- Test 18: Empty events / no visitors ----------
lsStore['abtest_events'] = undefined
lsStore['abtest_visitors'] = undefined
const emptyExp = makeExp({ id: 'empty-exp' })
const eStats = _calcStats(emptyExp)
console.log('T18: empty stats:', eStats.variantStats.map(v => `${v.variantId}: visitors=${v.uniqueVisitors}, rate=${v.conversionRate}`))
const ev0 = eStats.variantStats.find(v => v.variantId === 'v1')
assert(ev0.uniqueVisitors === 0, 'T18: v1 should have 0 visitors')
assert(ev0.conversionRate === 0, 'T18: v1 conversion rate should be 0 (no division by zero)')

// ---------- Summary ----------
const passed = results.filter(r => r.pass).length
const failed = results.filter(r => !r.pass).length
console.log(`\n=== Bucket/MVT verification: ${passed} passed, ${failed} failed ===`)
if (failed > 0) {
  console.log('FAILED:')
  for (const r of results) if (!r.pass) console.log(' -', r.label)
  process.exit(1)
}
