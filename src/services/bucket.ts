import { storage, getVisitorId } from './storage'
import type {
  Experiment,
  Variant,
  VisitorRecord,
  MutuallyExclusiveGroup,
  ExperimentLayer,
} from '../types'

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

function normalizeHash(hash: number): number {
  return hash / 2147483647
}

function weightedHashSelect(
  variants: Variant[],
  visitorId: string,
  experimentId: string
): Variant {
  const hashKey = `${visitorId}-${experimentId}`
  const hash = hashString(hashKey)
  const random = normalizeHash(hash)

  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0)
  let cumulative = 0
  const target = random * totalWeight

  for (const variant of variants) {
    cumulative += variant.weight
    if (target <= cumulative) return variant
  }

  return variants[variants.length - 1]
}

function checkTargeting(experiment: Experiment): boolean {
  if (!experiment.targetingRules || experiment.targetingRules.length === 0) {
    return true
  }

  const ua = navigator.userAgent.toLowerCase()
  const isIOS = /iphone|ipad|ipod/.test(ua)
  const isAndroid = /android/.test(ua)
  const isMobile = isIOS || isAndroid

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  const language = navigator.language.toLowerCase()

  for (const rule of experiment.targetingRules) {
    let matches = false

    switch (rule.type) {
      case 'device':
        matches = rule.values.some(v => {
          const val = v.toLowerCase()
          if (val === 'ios') return isIOS
          if (val === 'android') return isAndroid
          if (val === 'mobile') return isMobile
          if (val === 'desktop') return !isMobile
          return false
        })
        break
      case 'browser':
        matches = rule.values.some(v => ua.includes(v.toLowerCase()))
        break
      case 'geolocation':
        matches = rule.values.some(v => {
          const val = v.toLowerCase()
          const tzLower = timezone.toLowerCase()
          if (val === 'beijing' || val === 'beijing' || val === '北京') {
            return tzLower.includes('asia/shanghai') || tzLower.includes('asia/chongqing')
          }
          if (val === 'shanghai' || val === '上海') {
            return tzLower.includes('asia/shanghai')
          }
          if (val === 'china' || val === '中国' || val === 'cn') {
            return tzLower.includes('asia/') && (
              tzLower.includes('shanghai') ||
              tzLower.includes('chongqing') ||
              tzLower.includes('urumqi') ||
              language.startsWith('zh')
            )
          }
          return false
        })
        break
      default:
        matches = false
    }

    if (rule.operator === 'include' && !matches) return false
    if (rule.operator === 'exclude' && matches) return false
  }

  return true
}

function checkRollout(experiment: Experiment): boolean {
  const rolloutPct = experiment.trafficAllocation.rolloutPercentage
  if (rolloutPct >= 100) return true
  if (rolloutPct <= 0) return false

  const visitorId = getVisitorId()
  const hash = hashString(`${visitorId}-rollout-${experiment.id}`)
  const normalized = normalizeHash(hash)
  return normalized * 100 < rolloutPct
}

function checkMutualExclusion(
  experiment: Experiment,
  visitorId: string,
  mutexGroups: MutuallyExclusiveGroup[]
): boolean {
  if (!experiment.mutuallyExclusiveGroupId) return true

  const group = mutexGroups.find(g => g.id === experiment.mutuallyExclusiveGroupId)
  if (!group) return true

  const visitors = storage.getVisitors()
  const assignedExperiments = visitors
    .filter(v => v.visitorId === visitorId)
    .map(v => v.experimentId)

  const otherExperimentsInGroup = group.experimentIds.filter(
    id => id !== experiment.id
  )

  return !otherExperimentsInGroup.some(id => assignedExperiments.includes(id))
}

function checkLayerAssignment(
  experiment: Experiment,
  visitorId: string
): boolean {
  if (!experiment.layerId) return true

  const layers = storage.getLayers()
  const layer = layers.find(l => l.id === experiment.layerId)
  if (!layer) return true

  const visitors = storage.getVisitors()
  const assignedInLayer = visitors.filter(v =>
    v.visitorId === visitorId &&
    layer.experimentIds.includes(v.experimentId) &&
    v.experimentId !== experiment.id
  )

  return assignedInLayer.length === 0
}

export function assignVariant(experiment: Experiment): Variant | null {
  const visitorId = getVisitorId()

  if (experiment.status !== 'running') return null

  if (!checkTargeting(experiment)) return null

  if (!checkRollout(experiment)) return null

  const mutexGroups = storage.getMutexGroups()
  if (!checkMutualExclusion(experiment, visitorId, mutexGroups)) return null

  if (!checkLayerAssignment(experiment, visitorId)) return null

  const visitors = storage.getVisitors()
  const existingAssignment = visitors.find(
    v => v.visitorId === visitorId && v.experimentId === experiment.id
  )

  if (existingAssignment) {
    const variant = experiment.variants.find(
      v => v.id === existingAssignment.variantId
    )
    if (variant) return variant
  }

  const assignedVariant = weightedHashSelect(
    experiment.variants,
    visitorId,
    experiment.id
  )

  const newRecord: VisitorRecord = {
    visitorId,
    experimentId: experiment.id,
    variantId: assignedVariant.id,
    assignedAt: Date.now(),
    firstSeen: Date.now(),
  }

  const updatedVisitors = [...visitors, newRecord]
  storage.setVisitors(updatedVisitors)

  return assignedVariant
}

export function getAssignedVariant(experiment: Experiment): Variant | null {
  const visitorId = getVisitorId()
  const visitors = storage.getVisitors()
  const assignment = visitors.find(
    v => v.visitorId === visitorId && v.experimentId === experiment.id
  )

  if (!assignment) return null

  return experiment.variants.find(v => v.id === assignment.variantId) || null
}
