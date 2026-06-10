import { storage, getVisitorId } from './storage'
import type {
  Experiment,
  Variant,
  VisitorRecord,
  MutuallyExclusiveGroup,
  ExperimentLayer,
} from '../types'

function weightedRandom(variants: Variant[]): Variant {
  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0)
  let random = Math.random() * totalWeight

  for (const variant of variants) {
    random -= variant.weight
    if (random <= 0) return variant
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
      default:
        matches = true
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
  let hash = 0
  for (let i = 0; i < visitorId.length; i++) {
    const char = visitorId.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  const normalized = Math.abs(hash) / 2147483647
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
  return true
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

  const assignedVariant = weightedRandom(experiment.variants)

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
