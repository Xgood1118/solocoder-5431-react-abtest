export interface Variant {
  id: string
  name: string
  html: string
  css: string
  heroImage?: string
  buttonText: string
  formFields: FormField[]
  weight: number
}

export interface FormField {
  id: string
  label: string
  type: 'text' | 'email' | 'password' | 'number' | 'textarea'
  required: boolean
  placeholder?: string
}

export interface TrafficAllocation {
  totalTraffic: number
  rolloutPercentage: number
  rolloutHistory: RolloutRecord[]
}

export interface RolloutRecord {
  timestamp: number
  percentage: number
  note?: string
}

export interface TargetingRule {
  type: 'geolocation' | 'device' | 'browser' | 'custom'
  operator: 'include' | 'exclude'
  values: string[]
}

export interface MutuallyExclusiveGroup {
  id: string
  name: string
  experimentIds: string[]
}

export interface ExperimentLayer {
  id: string
  name: string
  experimentIds: string[]
}

export interface MVTConfig {
  enabled: boolean
  factors: MVTFactor[]
}

export interface MVTFactor {
  id: string
  name: string
  levels: string[]
}

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'archived'

export interface Experiment {
  id: string
  name: string
  description: string
  status: ExperimentStatus
  startDate: string
  endDate: string
  goalEvent: string
  variants: Variant[]
  trafficAllocation: TrafficAllocation
  targetingRules: TargetingRule[]
  mvtConfig: MVTConfig
  layerId?: string
  mutuallyExclusiveGroupId?: string
  createdAt: number
  updatedAt: number
}

export interface TrackedEvent {
  id: string
  experimentId: string
  variantId: string
  eventName: string
  properties?: Record<string, unknown>
  timestamp: number
  visitorId: string
}

export interface VisitorRecord {
  visitorId: string
  experimentId: string
  variantId: string
  assignedAt: number
  firstSeen: number
}

export interface ExperimentStats {
  experimentId: string
  variantStats: VariantStats[]
}

export interface VariantStats {
  variantId: string
  variantName: string
  visits: number
  uniqueVisitors: number
  conversions: number
  conversionRate: number
  conversionRateDelta?: number
}

export interface SignificanceResult {
  isSignificant: boolean
  pValue: number
  zScore: number
  confidenceLevel: number
  sampleSizeWarning: boolean
}

export interface SampleSizeCalculation {
  requiredSamplesPerVariant: number
  totalRequiredSamples: number
  baselineRate: number
  minimumDetectableEffect: number
  confidenceLevel: number
  statisticalPower: number
}

export interface ReportData {
  experiment: Experiment
  stats: ExperimentStats
  significance: SignificanceResult | null
  recommendation: string
  generatedAt: number
}
