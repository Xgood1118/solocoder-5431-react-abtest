import { useState, useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'
import type { ExperimentStats, SignificanceResult } from '../types'
import './StatsDashboard.css'

interface StatsDashboardProps {
  stats: ExperimentStats
  significance: SignificanceResult | null
  goalEvent: string
}

export default function StatsDashboard({
  stats,
  significance,
  goalEvent,
}: StatsDashboardProps) {
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar')

  const chartData = useMemo(() => {
    return stats.variantStats.map(stat => ({
      name: stat.variantName.substring(0, 8),
      访问量: stat.visits,
      独立访客: stat.uniqueVisitors,
      转化量: stat.conversions,
      转化率: Number((stat.conversionRate * 100).toFixed(2)),
    }))
  }, [stats])

  return (
    <div className="stats-dashboard">
      <div className="dashboard-header">
        <h3 className="section-title">数据看板</h3>
        <div className="chart-type-toggle">
          <button
            className={`toggle-btn ${chartType === 'bar' ? 'active' : ''}`}
            onClick={() => setChartType('bar')}
          >
            柱状图
          </button>
          <button
            className={`toggle-btn ${chartType === 'line' ? 'active' : ''}`}
            onClick={() => setChartType('line')}
          >
            折线图
          </button>
        </div>
      </div>

      <div className="stats-cards">
        {stats.variantStats.map(stat => (
          <div key={stat.variantId} className="stat-card">
            <div className="card-header">
              <h4 className="variant-name">{stat.variantName}</h4>
              {stat.conversionRateDelta !== undefined && stat.conversionRateDelta !== 0 && (
                <span
                  className={`delta-badge ${
                    stat.conversionRateDelta > 0 ? 'positive' : 'negative'
                  }`}
                >
                  {stat.conversionRateDelta > 0 ? '↑' : '↓'}
                  {Math.abs(stat.conversionRateDelta).toFixed(2)}%
                </span>
              )}
            </div>
            <div className="stat-metrics">
              <div className="metric">
                <span className="metric-value">{stat.visits}</span>
                <span className="metric-label">访问量</span>
              </div>
              <div className="metric">
                <span className="metric-value">{stat.uniqueVisitors}</span>
                <span className="metric-label">独立访客</span>
              </div>
              <div className="metric">
                <span className="metric-value">{stat.conversions}</span>
                <span className="metric-label">转化量</span>
              </div>
              <div className="metric highlight">
                <span className="metric-value">
                  {(stat.conversionRate * 100).toFixed(2)}%
                </span>
                <span className="metric-label">转化率</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="chart-section">
        <h4 className="chart-title">转化率对比</h4>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={280}>
            {chartType === 'bar' ? (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} unit="%" />
                <Tooltip
                  formatter={(value: number) => [`${value}%`, '转化率']}
                />
                <Bar
                  dataKey="转化率"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            ) : (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} unit="%" />
                <Tooltip
                  formatter={(value: number) => [`${value}%`, '转化率']}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="转化率"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      <div className="significance-section">
        <h4 className="chart-title">统计显著性分析</h4>
        {significance ? (
          <div className="significance-card">
            <div className="sig-main">
              <div
                className={`sig-result ${
                  significance.isSignificant ? 'significant' : 'not-significant'
                }`}
              >
                <span className="sig-icon">
                  {significance.isSignificant ? '✓' : '○'}
                </span>
                <span className="sig-label">
                  {significance.isSignificant ? '结果显著' : '结果不显著'}
                </span>
              </div>
              <div className="sig-details">
                <div className="sig-item">
                  <span className="sig-item-label">P 值</span>
                  <span className="sig-item-value">
                    {significance.pValue.toFixed(6)}
                  </span>
                </div>
                <div className="sig-item">
                  <span className="sig-item-label">Z 值</span>
                  <span className="sig-item-value">
                    {significance.zScore.toFixed(4)}
                  </span>
                </div>
                <div className="sig-item">
                  <span className="sig-item-label">置信水平</span>
                  <span className="sig-item-value">
                    {(significance.confidenceLevel * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
            {significance.sampleSizeWarning && (
              <div className="sample-warning">
                <span className="warning-icon">⚠️</span>
                <span className="warning-text">
                  样本量低于 100，结果可能不稳定，建议继续收集数据
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="no-data-hint">
            数据不足，无法计算统计显著性
          </div>
        )}
      </div>
    </div>
  )
}
