import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import {
  createExperiment,
  saveExperiment,
  getExperiment,
  generateMVTVariants,
} from '../services/experiment'
import { storage } from '../services/storage'
import type {
  Experiment,
  Variant,
  TargetingRule,
  MVTFactor,
  FormField,
} from '../types'
import './ExperimentForm.css'

export default function ExperimentForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)

  const [formData, setFormData] = useState<Experiment | null>(null)

  useEffect(() => {
    if (id) {
      const exp = getExperiment(id)
      if (exp) {
        setFormData(exp)
      } else {
        navigate('/')
      }
    } else {
      const newExp = createExperiment({})
      setFormData(newExp)
    }
  }, [id, navigate])

  if (!formData) return <div className="loading">加载中...</div>

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData) return
    const toSave = formData.mvtConfig.enabled
      ? { ...formData, variants: generateMVTVariants(formData) }
      : formData
    saveExperiment(toSave)
    navigate(`/experiments/${toSave.id}`)
  }

  const updateField = <K extends keyof Experiment>(key: K, value: Experiment[K]) => {
    setFormData(prev => prev ? { ...prev, [key]: value } : null)
  }

  const addVariant = () => {
    if (!formData || formData.variants.length >= 4) return
    const newVariant: Variant = {
      id: uuidv4(),
      name: `变体 ${String.fromCharCode(64 + formData.variants.length)}`,
      html: formData.variants[0]?.html || '',
      css: formData.variants[0]?.css || '',
      heroImage: formData.variants[0]?.heroImage || '',
      buttonText: '立即行动',
      formFields: formData.variants[0]?.formFields || [],
      weight: 1,
    }
    updateField('variants', [...formData.variants, newVariant])
  }

  const removeVariant = (variantId: string) => {
    if (!formData || formData.variants.length <= 1) return
    updateField(
      'variants',
      formData.variants.filter(v => v.id !== variantId)
    )
  }

  const updateVariant = (variantId: string, updates: Partial<Variant>) => {
    if (!formData) return
    updateField(
      'variants',
      formData.variants.map(v =>
        v.id === variantId ? { ...v, ...updates } : v
      )
    )
  }

  const addTargetingRule = () => {
    if (!formData) return
    const newRule: TargetingRule = {
      type: 'device',
      operator: 'include',
      values: [],
    }
    updateField('targetingRules', [...formData.targetingRules, newRule])
  }

  const updateTargetingRule = (index: number, updates: Partial<TargetingRule>) => {
    if (!formData) return
    const rules = [...formData.targetingRules]
    rules[index] = { ...rules[index], ...updates }
    updateField('targetingRules', rules)
  }

  const removeTargetingRule = (index: number) => {
    if (!formData) return
    updateField(
      'targetingRules',
      formData.targetingRules.filter((_, i) => i !== index)
    )
  }

  const updateRollout = (percentage: number) => {
    if (!formData) return
    updateField('trafficAllocation', {
      ...formData.trafficAllocation,
      rolloutPercentage: percentage,
    })
  }

  const toggleMVT = () => {
    if (!formData) return
    const enabled = !formData.mvtConfig.enabled
    let factors = formData.mvtConfig.factors
    if (enabled && factors.length === 0) {
      factors = [
        { id: uuidv4(), name: '文案', levels: ['方案 A', '方案 B'] },
      ]
    }
    updateField('mvtConfig', { enabled, factors })
  }

  const addMVTFactor = () => {
    if (!formData) return
    const factor: MVTFactor = {
      id: uuidv4(),
      name: `因素 ${formData.mvtConfig.factors.length + 1}`,
      levels: ['水平 1', '水平 2'],
    }
    updateField('mvtConfig', {
      ...formData.mvtConfig,
      factors: [...formData.mvtConfig.factors, factor],
    })
  }

  const removeMVTFactor = (factorId: string) => {
    if (!formData) return
    updateField('mvtConfig', {
      ...formData.mvtConfig,
      factors: formData.mvtConfig.factors.filter(f => f.id !== factorId),
    })
  }

  const updateMVTFactor = (factorId: string, updates: Partial<MVTFactor>) => {
    if (!formData) return
    updateField('mvtConfig', {
      ...formData.mvtConfig,
      factors: formData.mvtConfig.factors.map(f =>
        f.id === factorId ? { ...f, ...updates } : f
      ),
    })
  }

  const layers = storage.getLayers()
  const mutexGroups = storage.getMutexGroups()

  return (
    <div className="experiment-form">
      <div className="form-header">
        <div>
          <Link to="/" className="back-link">← 返回列表</Link>
          <h2 className="page-title">
            {isEditing ? '编辑实验' : '新建实验'}
          </h2>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-section">
          <h3 className="section-title">基本信息</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>实验名称 *</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => updateField('name', e.target.value)}
                required
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>目标转化事件</label>
              <input
                type="text"
                value={formData.goalEvent}
                onChange={e => updateField('goalEvent', e.target.value)}
                className="form-input"
                placeholder="例如: signup, click_cta"
              />
            </div>
            <div className="form-group">
              <label>开始日期</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={e => updateField('startDate', e.target.value)}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>结束日期</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={e => updateField('endDate', e.target.value)}
                className="form-input"
              />
            </div>
            <div className="form-group full-width">
              <label>实验描述</label>
              <textarea
                value={formData.description}
                onChange={e => updateField('description', e.target.value)}
                className="form-textarea"
                rows={3}
                placeholder="描述实验目的、假设、预期效果..."
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="section-header">
            <h3 className="section-title">变体配置</h3>
          </div>
          <div className="variants-list">
            {formData.variants.map((variant, index) => (
              <div key={variant.id} className="variant-item">
                <div className="variant-header">
                <span className="variant-badge">
                  {index === 0 ? '对照组' : `变体 ${String.fromCharCode(64 + index)}`}
                </span>
                <input
                  type="text"
                  value={variant.name}
                  onChange={e => updateVariant(variant.id, { name: e.target.value })}
                  className="variant-name-input"
                />
                <div className="variant-weights">
                  <label>权重</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={variant.weight}
                    onChange={e => updateVariant(variant.id, { weight: Number(e.target.value) })}
                    className="weight-input"
                  />
                </div>
                {formData.variants.length > 1 && index > 0 && (
                  <button
                    type="button"
                    className="btn-icon btn-danger"
                    onClick={() => removeVariant(variant.id)}
                  >
                    删除
                  </button>
                )}
              </div>
              </div>
            ))}
          </div>
          {formData.variants.length < 4 && (
            <button type="button" className="btn btn-secondary" onClick={addVariant}>
              + 添加变体
            </button>
          )}
        </div>

        <div className="form-section">
          <h3 className="section-title">流量配置</h3>
          <div className="form-group">
            <label>放量比例: {formData.trafficAllocation.rolloutPercentage}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={formData.trafficAllocation.rolloutPercentage}
              onChange={e => updateRollout(Number(e.target.value))}
              className="range-slider"
            />
            <div className="range-labels">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3 className="section-title">定向投放</h3>
          {formData.targetingRules.length === 0 ? (
            <p className="hint-text">未设置定向规则，所有用户均可参与实验</p>
          ) : (
            <div className="targeting-list">
              {formData.targetingRules.map((rule, index) => (
                <div key={index} className="targeting-item">
                  <select
                    value={rule.type}
                    onChange={e =>
                      updateTargetingRule(index, {
                        type: e.target.value as TargetingRule['type']
                      })
                    }
                    className="form-input"
                  >
                    <option value="device">设备类型</option>
                    <option value="browser">浏览器</option>
                    <option value="geolocation">地理位置</option>
                  </select>
                  <select
                    value={rule.operator}
                    onChange={e =>
                      updateTargetingRule(index, {
                        operator: e.target.value as 'include' | 'exclude'
                      })
                    }
                    className="form-input"
                  >
                    <option value="include">包含</option>
                    <option value="exclude">排除</option>
                  </select>
                  <input
                    type="text"
                    value={rule.values.join(', ')}
                    placeholder="用逗号分隔，如: iOS, Android"
                    onChange={e =>
                      updateTargetingRule(index, {
                        values: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                      })
                    }
                    className="form-input flex-2"
                  />
                  <button
                    type="button"
                    className="btn-icon btn-danger"
                    onClick={() => removeTargetingRule(index)}
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          )}
          <button type="button" className="btn btn-secondary" onClick={addTargetingRule}>
            + 添加定向规则
          </button>
        </div>

        <div className="form-section">
          <div className="section-header">
            <h3 className="section-title">多变量测试 (MVT)</h3>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={formData.mvtConfig.enabled}
                onChange={toggleMVT}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
          {formData.mvtConfig.enabled && (
            <div className="mvt-config">
              <p className="hint-text">
                启用后，系统将自动组合所有因素的水平，生成完整的测试矩阵。
              </p>
              {formData.mvtConfig.factors.map(factor => (
                <div key={factor.id} className="mvt-factor">
                  <input
                    type="text"
                    value={factor.name}
                    onChange={e =>
                      updateMVTFactor(factor.id, { name: e.target.value })
                    }
                    className="form-input"
                    placeholder="因素名称"
                  />
                  <input
                    type="text"
                    value={factor.levels.join(', ')}
                    onChange={e =>
                      updateMVTFactor(factor.id, {
                        levels: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                      })
                    }
                    className="form-input flex-2"
                    placeholder="水平，用逗号分隔"
                  />
                  <button
                    type="button"
                    className="btn-icon btn-danger"
                    onClick={() => removeMVTFactor(factor.id)}
                  >
                    删除
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn-secondary" onClick={addMVTFactor}>
                + 添加因素
              </button>
            </div>
          )}
        </div>

        <div className="form-section">
          <h3 className="section-title">高级设置</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>分层 (Layer)</label>
              <select
                value={formData.layerId || ''}
                onChange={e => updateField('layerId', e.target.value || undefined)}
                className="form-input"
              >
                <option value="">无分层</option>
                {layers.map(layer => (
                  <option key={layer.id} value={layer.id}>
                    {layer.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>互斥分组</label>
              <select
                value={formData.mutuallyExclusiveGroupId || ''}
                onChange={e =>
                  updateField('mutuallyExclusiveGroupId', e.target.value || undefined)
                }
                className="form-input"
              >
                <option value="">无互斥</option>
                {mutexGroups.map(group => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <Link to="/" className="btn btn-secondary">
            取消
          </Link>
          <button type="submit" className="btn btn-primary">
            {isEditing ? '保存修改' : '创建实验'}
          </button>
        </div>
      </form>
    </div>
  )
}
