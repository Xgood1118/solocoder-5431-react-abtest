import { v4 as uuidv4 } from 'uuid'

const STORAGE_KEYS = {
  EXPERIMENTS: 'abtest_experiments',
  EVENTS: 'abtest_events',
  VISITORS: 'abtest_visitors',
  VISITOR_ID: 'abtest_visitor_id',
  MUTEX_GROUPS: 'abtest_mutex_groups',
  LAYERS: 'abtest_layers',
}

const MAX_STORAGE_BYTES = 5 * 1024 * 1024
const STORAGE_USAGE_THRESHOLD = 0.8

function getStorageUsage(): number {
  let total = 0
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key) {
      const value = localStorage.getItem(key) || ''
      total += key.length + value.length
    }
  }
  return total
}

function getAbtestStorageSize(): number {
  let total = 0
  for (const key of Object.values(STORAGE_KEYS)) {
    const value = localStorage.getItem(key)
    if (value) {
      total += key.length + value.length
    }
  }
  return total
}

function cleanupOldData(): void {
  const usage = getStorageUsage()
  if (usage < MAX_STORAGE_BYTES * STORAGE_USAGE_THRESHOLD) return

  const eventsStr = localStorage.getItem(STORAGE_KEYS.EVENTS)
  if (eventsStr) {
    try {
      const events = JSON.parse(eventsStr) as Array<{ timestamp: number }>
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
      const filtered = events.filter(e => e.timestamp > cutoff)
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(filtered))
    } catch {
      localStorage.removeItem(STORAGE_KEYS.EVENTS)
    }
  }

  const visitorsStr = localStorage.getItem(STORAGE_KEYS.VISITORS)
  if (visitorsStr) {
    try {
      const visitors = JSON.parse(visitorsStr) as Array<{ assignedAt: number }>
      const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000
      const filtered = visitors.filter(v => v.assignedAt > cutoff)
      localStorage.setItem(STORAGE_KEYS.VISITORS, JSON.stringify(filtered))
    } catch {
      localStorage.removeItem(STORAGE_KEYS.VISITORS)
    }
  }
}

function safeSetItem(key: string, value: string): boolean {
  try {
    cleanupOldData()
    localStorage.setItem(key, value)
    return true
  } catch (e) {
    if (e instanceof Error && e.name === 'QuotaExceededError') {
      cleanupOldData()
      try {
        localStorage.setItem(key, value)
        return true
      } catch {
        return false
      }
    }
    return false
  }
}

function safeGetItem<T>(key: string, defaultValue: T): T {
  try {
    const value = localStorage.getItem(key)
    if (value === null) return defaultValue
    return JSON.parse(value) as T
  } catch {
    return defaultValue
  }
}

export function getVisitorId(): string {
  let visitorId = localStorage.getItem(STORAGE_KEYS.VISITOR_ID)
  if (!visitorId) {
    visitorId = uuidv4()
    safeSetItem(STORAGE_KEYS.VISITOR_ID, visitorId)
  }
  return visitorId
}

export const storage = {
  getExperiments: () => safeGetItem<Experiment[]>(STORAGE_KEYS.EXPERIMENTS, []),
  setExperiments: (experiments: Experiment[]) =>
    safeSetItem(STORAGE_KEYS.EXPERIMENTS, JSON.stringify(experiments)),

  getEvents: () => safeGetItem<TrackedEvent[]>(STORAGE_KEYS.EVENTS, []),
  setEvents: (events: TrackedEvent[]) =>
    safeSetItem(STORAGE_KEYS.EVENTS, JSON.stringify(events)),

  getVisitors: () => safeGetItem<VisitorRecord[]>(STORAGE_KEYS.VISITORS, []),
  setVisitors: (visitors: VisitorRecord[]) =>
    safeSetItem(STORAGE_KEYS.VISITORS, JSON.stringify(visitors)),

  getMutexGroups: () =>
    safeGetItem<MutuallyExclusiveGroup[]>(STORAGE_KEYS.MUTEX_GROUPS, []),
  setMutexGroups: (groups: MutuallyExclusiveGroup[]) =>
    safeSetItem(STORAGE_KEYS.MUTEX_GROUPS, JSON.stringify(groups)),

  getLayers: () => safeGetItem<ExperimentLayer[]>(STORAGE_KEYS.LAYERS, []),
  setLayers: (layers: ExperimentLayer[]) =>
    safeSetItem(STORAGE_KEYS.LAYERS, JSON.stringify(layers)),

  getUsage: getStorageUsage,
  getAbtestSize: getAbtestStorageSize,
  cleanup: cleanupOldData,
}

import type {
  Experiment,
  TrackedEvent,
  VisitorRecord,
  MutuallyExclusiveGroup,
  ExperimentLayer,
} from '../types'
