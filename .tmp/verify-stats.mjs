// Compile TS sources on the fly and run pure-function tests
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'url'
import { writeFileSync, mkdirSync, rmSync } from 'fs'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, '_build')
rmSync(distDir, { recursive: true, force: true })
mkdirSync(distDir, { recursive: true })

// Bundle stats.ts (and its dep storage.ts) as a single ESM file
await build({
  entryPoints: [path.join(__dirname, '..', 'src', 'services', 'stats.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: path.join(distDir, 'stats.mjs'),
  external: ['uuid'],
})

// Set up localStorage stub
const lsStore = {}
const localStorage = {
  getItem: k => lsStore[k] ?? null,
  setItem: (k, v) => { lsStore[k] = String(v) },
  removeItem: k => { delete lsStore[k] },
  get length() { return Object.keys(lsStore).length },
  key: i => Object.keys(lsStore)[i] || null,
}

// Provide browser globals that storage.ts reads at import time
Object.defineProperty(globalThis, 'localStorage', { value: localStorage, writable: true, configurable: true })
Object.defineProperty(globalThis, 'crypto', {
  value: { randomUUID: () => 'uuid-' + Math.random() },
  writable: true, configurable: true,
})

const { calculateZTest, calculateSampleSize, generateRecommendation, storage } =
  await import(pathToFileURL(path.join(distDir, 'stats.mjs')).href)

const results = []
const assert = (cond, label) => { results.push({ pass: !!cond, label }); if (!cond) console.error('FAIL:', label) }

// ----- Test 1: z-test p1=0.10 vs p2=0.12 each n=1000 -----
// Expected: z ≈ 1.429, p ≈ 0.153
const z1 = calculateZTest(100, 1000, 120, 1000, 0.95)
console.log('T1: z=', z1.zScore.toFixed(4), 'p=', z1.pValue.toFixed(4), 'sig=', z1.isSignificant, 'warn=', z1.sampleSizeWarning)
assert(!z1.sampleSizeWarning, 'T1: no sample warning at 1000')
assert(Math.abs(z1.zScore - 1.4292) < 0.01, 'T1: z-score within 0.01 of expected 1.429')
assert(Math.abs(z1.pValue - 0.153) < 0.02, 'T1: p-value within 0.02 of expected 0.153')
assert(z1.isSignificant === false, 'T1: not significant')

// ----- Test 2: z-test p1=0.10 vs p2=0.20 each n=1000 -----
// z ≈ 6.26, p ≈ 3.8e-10
const z2 = calculateZTest(100, 1000, 200, 1000, 0.95)
console.log('T2: z=', z2.zScore.toFixed(4), 'p=', z2.pValue.toExponential(2), 'sig=', z2.isSignificant)
assert(z2.isSignificant === true, 'T2: significant')
assert(z2.pValue < 1e-6, 'T2: p-value < 1e-6')

// ----- Test 3: small samples warn -----
const z3 = calculateZTest(5, 50, 10, 50, 0.95)
console.log('T3: warning=', z3.sampleSizeWarning)
assert(z3.sampleSizeWarning === true, 'T3: should warn at n=50')

// ----- Test 4: zero-sample guard -----
const z4 = calculateZTest(0, 0, 0, 0, 0.95)
console.log('T4: p=', z4.pValue, 'sig=', z4.isSignificant)
assert(z4.pValue === 1 && z4.isSignificant === false, 'T4: zero samples returns p=1')

// ----- Test 5: Sample size for p1=0.10, MDE=20%, α=0.05, power=0.80 -----
// Reference: ~3623 per variant (Evan Miller) up to ~3834 (textbook)
const ss1 = calculateSampleSize(0.10, 0.20, 0.95, 0.80)
console.log('T5: perVariant=', ss1.requiredSamplesPerVariant, 'total=', ss1.totalRequiredSamples)
assert(ss1.requiredSamplesPerVariant > 3000 && ss1.requiredSamplesPerVariant < 5000,
       `T5: per-variant sample in [3000, 5000], got ${ss1.requiredSamplesPerVariant}`)

// ----- Test 6: Larger MDE → smaller sample -----
const ss2 = calculateSampleSize(0.10, 0.50, 0.95, 0.80)
console.log('T6: MDE=50% perVariant=', ss2.requiredSamplesPerVariant)
assert(ss2.requiredSamplesPerVariant < ss1.requiredSamplesPerVariant,
       `T6: MDE=50% should be smaller than MDE=20% (got ${ss2.requiredSamplesPerVariant} vs ${ss1.requiredSamplesPerVariant})`)

// ----- Test 7: Higher confidence → larger sample -----
const ss3 = calculateSampleSize(0.10, 0.20, 0.99, 0.80)
console.log('T7: 99% perVariant=', ss3.requiredSamplesPerVariant)
assert(ss3.requiredSamplesPerVariant > ss1.requiredSamplesPerVariant,
       `T7: 99% should be larger than 95% (got ${ss3.requiredSamplesPerVariant} vs ${ss1.requiredSamplesPerVariant})`)

// ----- Test 8: MDE=0 → division by zero (BUG) -----
const ss5 = calculateSampleSize(0.10, 0, 0.95, 0.80)
console.log('T8: MDE=0 perVariant=', ss5.requiredSamplesPerVariant, 'isNaN=', isNaN(ss5.requiredSamplesPerVariant), 'isFinite=', isFinite(ss5.requiredSamplesPerVariant))
assert(isFinite(ss5.requiredSamplesPerVariant),
       `T8: BUG: MDE=0 should not return NaN/Infinity, got ${ss5.requiredSamplesPerVariant}`)

// ----- Test 9: Very rare event + small MDE -----
const ss6 = calculateSampleSize(0.0001, 1.0, 0.95, 0.80)
console.log('T9: p1=0.01%, MDE=100% perVariant=', ss6.requiredSamplesPerVariant)
assert(isFinite(ss6.requiredSamplesPerVariant) && ss6.requiredSamplesPerVariant > 0,
       'T9: positive finite sample for rare event')

// ----- Test 10: Recommendation: insufficient samples -----
const exp = {
  id: 'e1', name: 't', description: '', status: 'running',
  startDate: '2024-01-01', endDate: '', goalEvent: 'signup',
  variants: [
    { id: 'v1', name: 'A', html: '', css: '', buttonText: 'a', formFields: [], weight: 1 },
    { id: 'v2', name: 'B', html: '', css: '', buttonText: 'b', formFields: [], weight: 1 },
  ],
  trafficAllocation: { totalTraffic: 100, rolloutPercentage: 100, rolloutHistory: [] },
  targetingRules: [], mvtConfig: { enabled: false, factors: [] },
  createdAt: 0, updatedAt: 0,
}
const rec1 = generateRecommendation(exp, { experimentId: 'e1', variantStats: [
  { variantId: 'v1', variantName: 'A', visits: 5, uniqueVisitors: 5, conversions: 1, conversionRate: 0.2, conversionRateDelta: 0 },
  { variantId: 'v2', variantName: 'B', visits: 5, uniqueVisitors: 5, conversions: 2, conversionRate: 0.4, conversionRateDelta: 100 },
]}, { isSignificant: true, pValue: 0.01, zScore: 2.5, confidenceLevel: 0.95, sampleSizeWarning: true })
console.log('T10: rec first line:', rec1.split('\n')[0])
assert(rec1.includes('样本量不足') || rec1.includes('不稳定'),
       'T10: should warn insufficient samples')

// ----- Test 11: Recommendation: significant + winner -----
const rec2 = generateRecommendation(exp, { experimentId: 'e1', variantStats: [
  { variantId: 'v1', variantName: 'A', visits: 1000, uniqueVisitors: 1000, conversions: 100, conversionRate: 0.10, conversionRateDelta: 0 },
  { variantId: 'v2', variantName: 'B', visits: 1000, uniqueVisitors: 1000, conversions: 200, conversionRate: 0.20, conversionRateDelta: 100 },
]}, { isSignificant: true, pValue: 0.0001, zScore: 6.0, confidenceLevel: 0.95, sampleSizeWarning: false })
console.log('T11: rec first line:', rec2.split('\n')[0])
assert(rec2.includes('显著') && rec2.includes('胜出'),
       'T11: significant result should call out winner')

// ----- Test 12: Recommendation: single variant -----
const rec3 = generateRecommendation(exp, { experimentId: 'e1', variantStats: [
  { variantId: 'v1', variantName: 'A', visits: 0, uniqueVisitors: 0, conversions: 0, conversionRate: 0 },
]}, null)
console.log('T12: rec:', rec3)
assert(rec3.includes('至少需要两个变体'),
       'T12: should require 2+ variants')

// ----- Summary -----
const passed = results.filter(r => r.pass).length
const failed = results.filter(r => !r.pass).length
console.log(`\n=== Stats verification: ${passed} passed, ${failed} failed ===`)
if (failed > 0) {
  console.log('FAILED:')
  for (const r of results) if (!r.pass) console.log(' -', r.label)
  process.exit(1)
}
