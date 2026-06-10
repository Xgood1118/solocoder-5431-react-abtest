import { useState, useMemo } from 'react'
import { calculateSampleSize } from '../services/stats'
import type { SampleSizeCalculation } from '../types'
import './SampleSizeCalculator.css'

export default function SampleSizeCalculator() {
  const [baselineRate, setBaselineRate] = useState(5)
  const [mde, setMde] = useState(20)
  const [confidenceLevel, setConfidenceLevel] = useState(95)
  const [statisticalPower, setStatisticalPower] = useState(80)

  const result: SampleSizeCalculation = useMemo(() => {
    return calculateSampleSize(
      baselineRate / 100,
      mde / 100,
      confidenceLevel / 100,
      statisticalPower / 100
    )
  }, [baselineRate, mde, confidenceLevel, statisticalPower])

  const targetRate = baselineRate * (1 + mde / 100)

  return (
    <div className="sample-size-calculator">
      <div className="calc-header">
        <h2 className="page-title">样本量计算器</h2>
        <p className="page-subtitle">
          计算达到统计显著性所需的最少样本量
        </p>
      </div>

      <div className="calc-container">
        <div className="calc-inputs">
          <div className="form-section">
            <h3 className="section-title">参数设置</h3>

            <div className="form-group">
              <label>基准转化率: {baselineRate}%</label>
              <input
                type="range"
                min="1"
                max="50"
                value={baselineRate}
                onChange={e => setBaselineRate(Number(e.target.value))}
                className="range-slider"
              />
              <div className="range-value">
                <input
                  type="number"
                  min="0.1"
                  max="100"
                  step="0.1"
                  value={baselineRate}
                  onChange={e => setBaselineRate(Number(e.target.value))}
                  className="number-input"
                />
                <span>%</span>
              </div>
            </div>

            <div className="form-group">
              <label>最小可检测效应 (MDE): {mde}%</label>
              <input
                type="range"
                min="1"
                max="100"
                value={mde}
                onChange={e => setMde(Number(e.target.value))}
                className="range-slider"
              />
              <div className="range-hint">
                目标转化率: {targetRate.toFixed(2)}%
                (相对提升 {mde}%)
              </div>
            </div>

            <div className="form-group">
              <label>置信水平: {confidenceLevel}%</label>
              <div className="preset-buttons">
                {[90, 95, 99].map(val => (
                  <button
                    key={val}
                    className={`preset-btn ${confidenceLevel === val ? 'active' : ''}`}
                    onClick={() => setConfidenceLevel(val)}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>统计功效: {statisticalPower}%</label>
              <div className="preset-buttons">
                {[70, 80, 90].map(val => (
                  <button
                    key={val}
                    className={`preset-btn ${statisticalPower === val ? 'active' : ''}`}
                    onClick={() => setStatisticalPower(val)}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="form-section explanation">
            <h4 className="section-subtitle">参数说明</h4>
            <ul className="explanation-list">
              <li>
                <strong>基准转化率:</strong> 现有版本的预期转化率
              </li>
              <li>
                <strong>最小可检测效应:</strong>
                你希望检测到的最小相对变化幅度。越小的效应需要越大的样本量
              </li>
              <li>
                <strong>置信水平:</strong>
                统计显著性的置信度。越高越严格，需要更多样本。行业标准 95%
              </li>
              <li>
                <strong>统计功效:</strong>
                当真实效应存在时成功检测到的概率。行业标准 80%
              </li>
            </ul>
          </div>
        </div>

        <div className="calc-results">
          <div className="result-card main">
            <div className="result-icon">👥</div>
            <div className="result-main">
              <span className="result-value">
                {result.requiredSamplesPerVariant.toLocaleString()}
              </span>
              <span className="result-label">每个变体所需样本</span>
            </div>
          </div>

          <div className="result-grid">
            <div className="result-card">
              <span className="result-value-sm">
                {result.totalRequiredSamples.toLocaleString()}
              </span>
              <span className="result-label">总样本量 (2 组)</span>
            </div>
            <div className="result-card">
              <span className="result-value-sm">
                {(result.baselineRate * 100).toFixed(1)}%
              </span>
              <span className="result-label">基准转化率</span>
            </div>
            <div className="result-card">
              <span className="result-value-sm">
                {(result.minimumDetectableEffect * 100).toFixed(1)}%
              </span>
              <span className="result-label">最小可检测效应</span>
            </div>
            <div className="result-card">
              <span className="result-value-sm">
                {(result.confidenceLevel * 100).toFixed(0)}%
              </span>
              <span className="result-label">置信水平</span>
            </div>
          </div>

          <div className="result-tips">
            <h4 className="tips-title">💡 小贴士</h4>
            <ul className="tips-list">
              <li>
                如果日均流量充足，可以缩短实验周期；反之需要延长实验时间
              </li>
              <li>
                建议至少运行 7 天，以覆盖完整的周内行为模式差异
              </li>
              <li>
                如果检测到效应比预期更大，可以提前结束实验
              </li>
              <li>
                注意避免「偷看问题」：不要在中途频繁查看结果并做决策
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
