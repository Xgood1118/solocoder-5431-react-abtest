import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getExperiment, saveExperiment } from '../services/experiment'
import {
  calculateExperimentStats,
  calculateZTest,
  generateRecommendation,
} from '../services/stats'
import { exportReportPDF, generateReportData } from '../services/report'
import { trackEvent } from '../services/event'
import type { Experiment, Variant, ExperimentStats, SignificanceResult } from '../types'
import VariantEditor from '../components/VariantEditor'
import StatsDashboard from '../components/StatsDashboard'
import './ExperimentDetail.css'

export default function ExperimentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [experiment, setExperiment] = useState<Experiment | null>(null)
  const [activeTab, setActiveTab] = useState<'variants' | 'dashboard' | 'settings'>('dashboard')
  const [selectedVariantId, setSelectedVariantId] = useState<string>('')
  const [stats, setStats] = useState<ExperimentStats | null>(null)
  const [significance, setSignificance] = useState<SignificanceResult | null>(null)

  useEffect(() => {
    if (!id) return
    const exp = getExperiment(id)
    if (exp) {
      setExperiment(exp)
      setSelectedVariantId(exp.variants[0]?.id || '')
      refreshStats(exp)
    } else {
      navigate('/')
    }
  }, [id, navigate])

  const refreshStats = (exp: Experiment) => {
    const expStats = calculateExperimentStats(exp)
    setStats(expStats)

    if (expStats.variantStats.length >= 2) {
      const control = expStats.variantStats[0]
      const bestVariant = expStats.variantStats.slice(1).reduce(
        (best, curr) => (curr.conversionRate > best.conversionRate ? curr : best),
        expStats.variantStats[1]
      )
      const sig = calculateZTest(
        control.conversions,
        control.uniqueVisitors,
        bestVariant.conversions,
        bestVariant.uniqueVisitors,
        0.95
      )
      setSignificance(sig)
    }
  }

  if (!experiment) {
    return <div className="loading">加载中...</div>
  }

  const handleVariantChange = (variantId: string, updates: Partial<Variant>) => {
    if (!experiment) return
    const updatedVariants = experiment.variants.map(v =>
      v.id === variantId ? { ...v, ...updates } : v
    )
    const updated = { ...experiment, variants: updatedVariants }
    setExperiment(updated)
    saveExperiment(updated)
  }

  const handleExportReport = async () => {
    if (!experiment || !stats) return
    const reportData = generateReportData(experiment, stats, significance)
    await exportReportPDF(reportData)
  }

  const handleSimulateData = () => {
    if (!experiment) return
    const goalEvent = experiment.goalEvent

    experiment.variants.forEach(variant => {
      const visits = Math.floor(Math.random() * 50) + 20
      for (let i = 0; i < visits; i++) {
        const visitorId = `sim-${variant.id}-${i}-${Date.now()}`
        trackEvent('page_view', experiment.id, variant.id, { simulated: true })

        const conversionRate = 0.1 + Math.random() * 0.2
        if (Math.random() < conversionRate) {
          trackEvent(goalEvent, experiment.id, variant.id, { simulated: true })
        }
      }
    })

    refreshStats(experiment)
  }

  const handleStatusChange = (status: Experiment['status']) => {
    if (!experiment) return
    const updated = { ...experiment, status, updatedAt: Date.now() }
    setExperiment(updated)
    saveExperiment(updated)
  }

  const handleRolloutChange = (percentage: number) => {
    if (!experiment) return
    const updated = {
      ...experiment,
      trafficAllocation: {
        ...experiment.trafficAllocation,
        rolloutPercentage: percentage,
        rolloutHistory: [
          ...experiment.trafficAllocation.rolloutHistory,
          { timestamp: Date.now(), percentage, note: '手动调整' },
        ],
      },
      updatedAt: Date.now(),
    }
    setExperiment(updated)
    saveExperiment(updated)
  }

  const recommendation = stats ? generateRecommendation(experiment, stats, significance) : ''

  const selectedVariant = experiment.variants.find(v => v.id === selectedVariantId)

  return (
    <div className="experiment-detail">
      <div className="detail-header">
        <div>
          <Link to="/" className="back-link">← 返回列表</Link>
          <div className="header-main">
            <h2 className="page-title">{experiment.name}</h2>
            <span className={`status-badge status-${experiment.status}`}>
              {getStatusText(experiment.status)}
            </span>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={handleSimulateData}>
            🎲 模拟数据
          </button>
          <button className="btn btn-secondary" onClick={handleExportReport}>
            📄 导出报告
          </button>
          <Link to={`/experiments/${experiment.id}/edit`} className="btn btn-primary">
            ⚙️ 编辑设置
          </Link>
        </div>
      </div>

      {experiment.description && (
        <p className="experiment-desc">{experiment.description}</p>
      )}

      <div className="detail-meta">
        <div className="meta-row">
          <span className="meta-label">目标事件:</span>
          <span className="meta-value">{experiment.goalEvent}</span>
        </div>
        <div className="meta-row">
          <span className="meta-label">放量比例:</span>
          <span className="meta-value">
            {experiment.trafficAllocation.rolloutPercentage}%
          </span>
        </div>
        <div className="meta-row">
          <span className="meta-label">开始日期:</span>
          <span className="meta-value">{experiment.startDate}</span>
        </div>
        {experiment.endDate && (
          <div className="meta-row">
            <span className="meta-label">结束日期:</span>
            <span className="meta-value">{experiment.endDate}</span>
          </div>
        )}
      </div>

      <div className="quick-actions">
        <div className="action-item">
          <span className="action-label">状态控制</span>
          <div className="action-buttons">
            {experiment.status === 'draft' && (
              <button
                className="btn btn-sm btn-success"
                onClick={() => handleStatusChange('running')}
              >
                启动实验
              </button>
            )}
            {experiment.status === 'running' && (
              <button
                className="btn btn-sm btn-warning"
                onClick={() => handleStatusChange('paused')}
              >
                暂停实验
              </button>
            )}
            {experiment.status === 'paused' && (
              <button
                className="btn btn-sm btn-info"
                onClick={() => handleStatusChange('running')}
              >
                继续实验
              </button>
            )}
            {experiment.status !== 'completed' && experiment.status !== 'archived' && (
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => handleStatusChange('completed')}
              >
                结束实验
              </button>
            )}
          </div>
        </div>
        <div className="action-item">
          <span className="action-label">快速放量</span>
          <div className="action-buttons">
            {[10, 30, 50, 100].map(pct => (
              <button
                key={pct}
                className={`btn btn-sm ${
                  experiment.trafficAllocation.rolloutPercentage === pct
                    ? 'btn-primary'
                    : 'btn-secondary'
                }`}
                onClick={() => handleRolloutChange(pct)}
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="detail-tabs">
        <button
          className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          📊 数据看板
        </button>
        <button
          className={`tab-btn ${activeTab === 'variants' ? 'active' : ''}`}
          onClick={() => setActiveTab('variants')}
        >
          🧪 变体编辑
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'dashboard' && stats && (
          <div className="dashboard-tab">
            <StatsDashboard
              stats={stats}
              significance={significance}
              goalEvent={experiment.goalEvent}
            />

            <div className="recommendation-card">
              <h4 className="rec-title">💡 智能建议</h4>
              <p className="rec-text">{recommendation}</p>
            </div>
          </div>
        )}

        {activeTab === 'variants' && selectedVariant && (
          <div className="variants-tab">
            <div className="variant-tabs">
              {experiment.variants.map((variant, index) => (
                <button
                  key={variant.id}
                  className={`variant-tab-btn ${
                    selectedVariantId === variant.id ? 'active' : ''
                  }`}
                  onClick={() => setSelectedVariantId(variant.id)}
                >
                  <span className="tab-index">{index === 0 ? 'A' : String.fromCharCode(65 + index)}</span>
                  <span className="tab-name">{variant.name}</span>
                </button>
              ))}
            </div>
            <VariantEditor
              variant={selectedVariant}
              onChange={updates => handleVariantChange(selectedVariant.id, updates)}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function getStatusText(status: string): string {
  const map: Record<string, string> = {
    draft: '草稿',
    running: '运行中',
    paused: '已暂停',
    completed: '已完成',
    archived: '已归档',
  }
  return map[status] || status
}
