import { storage } from './storage'
import { v4 as uuidv4 } from 'uuid'
import type {
  Experiment,
  Variant,
  FormField,
  TrafficAllocation,
  MVTConfig,
  RolloutRecord,
} from '../types'

function generateDefaultVariant(index: number): Variant {
  const names = ['对照组', '变体 A', '变体 B', '变体 C']
  const buttonTexts = ['立即注册', '免费试用', '马上开始', '了解更多']

  const defaultFields: FormField[] = [
    { id: 'f1', label: '姓名', type: 'text', required: true, placeholder: '请输入姓名' },
    { id: 'f2', label: '邮箱', type: 'email', required: true, placeholder: '请输入邮箱' },
  ]

  return {
    id: uuidv4(),
    name: names[index] || `变体 ${index + 1}`,
    html: `
<div class="landing-page">
  <div class="hero">
    <img src="" alt="Hero" class="hero-image" id="hero-image" />
    <h1 class="headline">提升您的业务效率</h1>
    <p class="subheadline">使用我们的解决方案，让工作事半功倍</p>
    <button class="cta-button" id="cta-button">${buttonTexts[index] || '立即行动'}</button>
  </div>
  <form class="signup-form" id="signup-form">
    <div class="form-field">
      <label>姓名</label>
      <input type="text" placeholder="请输入姓名" />
    </div>
    <div class="form-field">
      <label>邮箱</label>
      <input type="email" placeholder="请输入邮箱" />
    </div>
    <button type="submit" class="submit-btn">提交</button>
  </form>
</div>`.trim(),
    css: `
.landing-page {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  max-width: 600px;
  margin: 0 auto;
  padding: 40px 20px;
  text-align: center;
}
.hero { margin-bottom: 40px; }
.hero-image {
  width: 100%;
  max-width: 400px;
  border-radius: 8px;
  margin-bottom: 24px;
}
.headline {
  font-size: 32px;
  color: #1a1a2e;
  margin-bottom: 12px;
}
.subheadline {
  font-size: 18px;
  color: #666;
  margin-bottom: 24px;
}
.cta-button {
  background: #4f46e5;
  color: white;
  border: none;
  padding: 14px 32px;
  font-size: 16px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}
.cta-button:hover { background: #4338ca; }
.signup-form {
  background: #f8fafc;
  padding: 32px;
  border-radius: 12px;
  text-align: left;
}
.form-field { margin-bottom: 16px; }
.form-field label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #374151;
}
.form-field input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  box-sizing: border-box;
}
.submit-btn {
  width: 100%;
  background: #10b981;
  color: white;
  border: none;
  padding: 12px;
  font-size: 16px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}
.submit-btn:hover { background: #059669; }
`.trim(),
    heroImage: '',
    buttonText: buttonTexts[index] || '立即行动',
    formFields: defaultFields,
    weight: 1,
  }
}

export function createExperiment(data: Partial<Experiment>): Experiment {
  const now = Date.now()
  const variantCount = data.variants?.length || 2
  const variants = data.variants && data.variants.length > 0
    ? data.variants
    : Array.from({ length: variantCount }, (_, i) => generateDefaultVariant(i))

  const trafficAllocation: TrafficAllocation = data.trafficAllocation || {
    totalTraffic: 100,
    rolloutPercentage: 100,
    rolloutHistory: [{ timestamp: now, percentage: 100, note: '初始配置' }],
  }

  const mvtConfig: MVTConfig = data.mvtConfig || {
    enabled: false,
    factors: [],
  }

  const experiment: Experiment = {
    id: uuidv4(),
    name: data.name || '新实验',
    description: data.description || '',
    status: data.status || 'draft',
    startDate: data.startDate || new Date().toISOString().split('T')[0],
    endDate: data.endDate || '',
    goalEvent: data.goalEvent || 'signup',
    variants,
    trafficAllocation,
    targetingRules: data.targetingRules || [],
    mvtConfig,
    layerId: data.layerId,
    mutuallyExclusiveGroupId: data.mutuallyExclusiveGroupId,
    createdAt: now,
    updatedAt: now,
  }

  return experiment
}

export function saveExperiment(experiment: Experiment): void {
  const experiments = storage.getExperiments()
  const index = experiments.findIndex(e => e.id === experiment.id)

  if (index >= 0) {
    experiments[index] = { ...experiment, updatedAt: Date.now() }
  } else {
    experiments.push(experiment)
  }

  storage.setExperiments(experiments)
}

export function getExperiment(id: string): Experiment | undefined {
  const experiments = storage.getExperiments()
  return experiments.find(e => e.id === id)
}

export function getExperiments(): Experiment[] {
  return storage.getExperiments()
}

export function deleteExperiment(id: string): void {
  const experiments = storage.getExperiments()
  const filtered = experiments.filter(e => e.id !== id)
  storage.setExperiments(filtered)
}

export function updateRolloutPercentage(
  experimentId: string,
  percentage: number,
  note?: string
): void {
  const experiments = storage.getExperiments()
  const exp = experiments.find(e => e.id === experimentId)
  if (!exp) return

  const record: RolloutRecord = {
    timestamp: Date.now(),
    percentage,
    note,
  }

  exp.trafficAllocation.rolloutPercentage = percentage
  exp.trafficAllocation.rolloutHistory.push(record)
  exp.updatedAt = Date.now()

  storage.setExperiments(experiments)
}

export function setExperimentStatus(
  experimentId: string,
  status: Experiment['status']
): void {
  const experiments = storage.getExperiments()
  const exp = experiments.find(e => e.id === experimentId)
  if (!exp) return

  exp.status = status
  exp.updatedAt = Date.now()

  if (status === 'completed') {
    exp.trafficAllocation.rolloutPercentage = 0
  }

  storage.setExperiments(experiments)
}

export function generateMVTVariants(experiment: Experiment): Variant[] {
  if (!experiment.mvtConfig.enabled || experiment.mvtConfig.factors.length === 0) {
    return experiment.variants
  }

  const { factors } = experiment.mvtConfig

  const combinations: string[][] = [[]]
  for (const factor of factors) {
    const newCombinations: string[][] = []
    for (const combo of combinations) {
      for (const level of factor.levels) {
        newCombinations.push([...combo, level])
      }
    }
    combinations.length = 0
    combinations.push(...newCombinations)
  }

  return combinations.map((combo, index) => {
    const variantName = combo.join(' / ')
    return {
      id: `mvt-${index}`,
      name: variantName,
      html: experiment.variants[0]?.html || '',
      css: experiment.variants[0]?.css || '',
      heroImage: experiment.variants[0]?.heroImage || '',
      buttonText: combo.join(' '),
      formFields: experiment.variants[0]?.formFields || [],
      weight: 1,
    }
  })
}
