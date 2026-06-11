import { storage } from './storage'
import type {
  Experiment,
  VariantStats,
  ExperimentStats,
  SignificanceResult,
  SampleSizeCalculation,
} from '../types'

export function calculateExperimentStats(
  experiment: Experiment
): ExperimentStats {
  const events = storage.getEvents()
  const visitors = storage.getVisitors()

  const experimentEvents = events.filter(e => e.experimentId === experiment.id)
  const experimentVisitors = visitors.filter(v => v.experimentId === experiment.id)

  const variantStats: VariantStats[] = experiment.variants.map(variant => {
    const variantEvents = experimentEvents.filter(e => e.variantId === variant.id)
    const variantVisitors = experimentVisitors.filter(v => v.variantId === variant.id)

    const visitEvents = variantEvents.filter(e => e.eventName === 'page_view' || e.eventName === 'visit')
    const conversions = variantEvents.filter(e => e.eventName === experiment.goalEvent)

    const uniqueVisitorIdsFromRecords = new Set(variantVisitors.map(v => v.visitorId))
    const uniqueVisitorIdsFromEvents = new Set(variantEvents.map(e => e.visitorId))
    const uniqueVisitorIds = new Set([
      ...uniqueVisitorIdsFromRecords,
      ...uniqueVisitorIdsFromEvents,
    ])

    const uniqueConversionIds = new Set(conversions.map(c => c.visitorId))

    const visits = visitEvents.length || variantVisitors.length
    const uniqueVisitors = uniqueVisitorIds.size
    const conversionCount = uniqueConversionIds.size || conversions.length

    const conversionRate = uniqueVisitors > 0 ? conversionCount / uniqueVisitors : 0

    return {
      variantId: variant.id,
      variantName: variant.name,
      visits,
      uniqueVisitors,
      conversions: conversionCount,
      conversionRate,
    }
  })

  const controlRate = variantStats[0]?.conversionRate || 0
  variantStats.forEach((stat, index) => {
    if (index === 0) {
      stat.conversionRateDelta = 0
    } else {
      stat.conversionRateDelta = controlRate > 0
        ? ((stat.conversionRate - controlRate) / controlRate) * 100
        : 0
    }
  })

  return {
    experimentId: experiment.id,
    variantStats,
  }
}

function erf(x: number): number {
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911

  const sign = x < 0 ? -1 : 1
  x = Math.abs(x)

  const t = 1.0 / (1.0 + p * x)
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)

  return sign * y
}

function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.sqrt(2)))
}

export function calculateZTest(
  controlConversions: number,
  controlSampleSize: number,
  variantConversions: number,
  variantSampleSize: number,
  confidenceLevel: number = 0.95
): SignificanceResult {
  const sampleSizeWarning = controlSampleSize < 100 || variantSampleSize < 100

  if (controlSampleSize === 0 || variantSampleSize === 0) {
    return {
      isSignificant: false,
      pValue: 1,
      zScore: 0,
      confidenceLevel,
      sampleSizeWarning,
    }
  }

  const p1 = controlConversions / controlSampleSize
  const p2 = variantConversions / variantSampleSize

  const pPooled = (controlConversions + variantConversions) / (controlSampleSize + variantSampleSize)
  const sePooled = Math.sqrt(
    pPooled * (1 - pPooled) * (1 / controlSampleSize + 1 / variantSampleSize)
  )

  const zScore = sePooled === 0 ? 0 : (p2 - p1) / sePooled

  const pValue = 2 * (1 - normalCdf(Math.abs(zScore)))

  const alpha = 1 - confidenceLevel
  const isSignificant = pValue < alpha

  return {
    isSignificant,
    pValue,
    zScore,
    confidenceLevel,
    sampleSizeWarning,
  }
}

export function calculateSampleSize(
  baselineRate: number,
  minimumDetectableEffect: number,
  confidenceLevel: number = 0.95,
  statisticalPower: number = 0.8
): SampleSizeCalculation {
  function inverseNormalCdf(p: number): number {
    if (p <= 0 || p >= 1) return 0
    const a = [ -3.969683028665376e+01, 2.209460984245205e+02,
      -2.759285104469687e+02, 1.383577518672690e+02,
      -3.066479806614716e+01, 2.506628277459239e+00 ]
    const b = [ -5.447609879822406e+01, 1.615858368580409e+02,
      -1.556989798598866e+02, 6.680131188771972e+01,
      -1.328068155288572e+01 ]
    const c = [ -7.784894002430293e-03, -3.223964580411365e-01,
      -2.400758277161838e+00, -2.549732539343734e+00,
      4.374664141464968e+00, 2.938163982698783e+00 ]
    const d = [ 7.784695709041462e-03, 3.224671290700398e-01,
      2.445134137142996e+00, 3.754408661907416e+00 ]

    const pLow = 0.02425
    const pHigh = 1 - pLow
    let q = 0, r = 0

    if (p < pLow) {
      q = Math.sqrt(-2 * Math.log(p))
      return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
             ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)
    }
    if (p <= pHigh) {
      q = p - 0.5
      r = q * q
      return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5]) * q /
             (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1)
    }
    q = Math.sqrt(-2 * Math.log(1 - p))
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
           ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)
  }

  const zAlpha = inverseNormalCdf(1 - (1 - confidenceLevel) / 2)
  const zBeta = inverseNormalCdf(statisticalPower)

  const p1 = baselineRate
  const p2 = baselineRate * (1 + minimumDetectableEffect)

  const pPooled = (p1 + p2) / 2
  const numerator = (zAlpha * Math.sqrt(2 * pPooled * (1 - pPooled)) +
                     zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2)))
  const denominator = p2 - p1

  const requiredSamplesPerVariant = Math.ceil(Math.pow(numerator / denominator, 2))
  const totalRequiredSamples = requiredSamplesPerVariant * 2

  return {
    requiredSamplesPerVariant,
    totalRequiredSamples,
    baselineRate,
    minimumDetectableEffect,
    confidenceLevel,
    statisticalPower,
  }
}

export function generateRecommendation(
  experiment: Experiment,
  stats: ExperimentStats,
  significance: SignificanceResult | null
): string {
  if (!significance) {
    return '数据不足，无法生成建议。请继续收集更多样本数据。'
  }

  const { variantStats } = stats
  if (variantStats.length < 2) {
    return '至少需要两个变体才能进行对比分析。'
  }

  const control = variantStats[0]
  const bestVariant = variantStats.slice(1).reduce(
    (best, current) =>
      current.conversionRate > best.conversionRate ? current : best,
    variantStats[1]
  )

  if (significance.sampleSizeWarning) {
    return `样本量不足，结果可能不稳定。建议继续收集数据直到每个变体至少有 100 名独立访客。\n当前趋势：${bestVariant.variantName} 转化率最高 (${(bestVariant.conversionRate * 100).toFixed(2)}%)，较对照组提升 ${bestVariant.conversionRateDelta?.toFixed(2) || '0'}%。`
  }

  if (significance.isSignificant) {
    return `🎉 实验结果显著！${bestVariant.variantName} 以 ${(bestVariant.conversionRate * 100).toFixed(2)}% 的转化率胜出，较对照组提升 ${bestVariant.conversionRateDelta?.toFixed(2) || '0'}% (p=${significance.pValue.toFixed(4)})。\n\n建议：可以将 ${bestVariant.variantName} 全量推送至所有用户。如果还有其他想法，可以开展下一轮迭代测试进一步优化。`
  } else {
    return `📊 实验结果不显著 (p=${significance.pValue.toFixed(4)})，各变体之间没有统计上的显著差异。\n\n建议：1) 继续运行实验收集更多数据；2) 考虑增大变体之间的差异以提高检测灵敏度；3) 如果效果差异确实很小，可选择任意变体全量发布。`
  }
}
