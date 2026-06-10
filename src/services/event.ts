import { storage, getVisitorId } from './storage'
import type { TrackedEvent } from '../types'

export function trackEvent(
  eventName: string,
  experimentId: string,
  variantId: string,
  properties?: Record<string, unknown>
): void {
  try {
    const event: TrackedEvent = {
      id: crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      experimentId,
      variantId,
      eventName,
      properties,
      timestamp: Date.now(),
      visitorId: getVisitorId(),
    }

    const events = storage.getEvents()
    events.push(event)
    storage.setEvents(events)
  } catch (e) {
    console.warn('[ABTest] trackEvent failed:', e)
  }
}

export function getEventsByExperiment(experimentId: string): TrackedEvent[] {
  try {
    const events = storage.getEvents()
    return events.filter(e => e.experimentId === experimentId)
  } catch {
    return []
  }
}

export function getEventsByVariant(
  experimentId: string,
  variantId: string
): TrackedEvent[] {
  try {
    const events = storage.getEvents()
    return events.filter(
      e => e.experimentId === experimentId && e.variantId === variantId
    )
  } catch {
    return []
  }
}

declare global {
  interface Window {
    trackEvent: (
      eventName: string,
      experimentId: string,
      variantId: string,
      properties?: Record<string, unknown>
    ) => void
  }
}

export function initTrackingAPI(): void {
  if (typeof window !== 'undefined') {
    window.trackEvent = function (
      eventName: string,
      experimentId: string,
      variantId: string,
      properties?: Record<string, unknown>
    ): void {
      try {
        trackEvent(eventName, experimentId, variantId, properties)
      } catch (e) {
        console.warn('[ABTest] window.trackEvent error:', e)
      }
    }
  }
}
