import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getExperiments, setExperimentStatus } from '../services/experiment'
import type { Experiment } from '../types'
import './ExperimentList.css'

export default function ExperimentList() {
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadExperiments()
  }, [])

  const loadExperiments = () => {
    const exps = getExperiments()
    setExperiments(exps)
  }

  const filteredExperiments = experiments.filter(exp => {
    const matchesFilter = filter === 'all' || exp.status === filter
    const matchesSearch = exp.name.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const handleStatusChange = (id: string, status: Experiment['status']) => {
    setExperimentStatus(id, status)
    loadExperiments()
  }

  const statusOptions: { value: string; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'draft', label: '草稿' },
    { value: 'running', label: '运行中' },
    { value: 'paused', label: '已暂停' },
    { value: 'completed', label: '已完成' },
    { value: 'archived', label: '已归档' },
  ]

  return (
    <div className="experiment-list">
      <div className="list-header">
        <div>
          <h2 className="page-title">实验管理</h2>
          <p className="page-subtitle">共 {experiments.length} 个实验</p>
        </div>
        <Link to="/experiments/new" className="btn btn-primary">
          + 新建实验
        </Link>
      </div>

      <div className="list-toolbar">
        <div className="filter-tabs">
          {statusOptions.map(opt => (
            <button
              key={opt.value}
              className={`filter-tab ${filter === opt.value ? 'active' : ''}`}
              onClick={() => setFilter(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          className="search-input"
          placeholder="搜索实验..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {filteredExperiments.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h3>暂无实验</h3>
          <p>点击上方「新建实验」按钮开始创建第一个 A/B 测试</p>
          <Link to="/experiments/new" className="btn btn-primary">
            创建实验
          </Link>
        </div>
      ) : (
        <div className="experiment-grid">
          {filteredExperiments.map(exp => (
            <Link
              key={exp.id}
              to={`/experiments/${exp.id}`}
              className="experiment-card"
            >
              <div className="card-header">
                <h3 className="experiment-name">{exp.name}</h3>
                <span className={`status-badge status-${exp.status}`}>
                  {getStatusText(exp.status)}
                </span>
              </div>
              <p className="experiment-desc">
                {exp.description || '暂无描述'}
              </p>
              <div className="experiment-meta">
                <span className="meta-item">
                  🎯 目标: {exp.goalEvent}
                </span>
                <span className="meta-item">
                  🧪 {exp.variants.length} 个变体
                </span>
                <span className="meta-item">
                  📊 {exp.trafficAllocation.rolloutPercentage}% 流量
                </span>
              </div>
              <div className="card-footer">
                <span className="date-text">
                  {new Date(exp.updatedAt).toLocaleDateString('zh-CN')}
                </span>
                {exp.status === 'draft' && (
                  <button
                    className="btn btn-sm btn-success"
                    onClick={e => {
                      e.preventDefault()
                      handleStatusChange(exp.id, 'running')
                    }}
                  >
                    启动
                  </button>
                )}
                {exp.status === 'running' && (
                  <button
                    className="btn btn-sm btn-warning"
                    onClick={e => {
                      e.preventDefault()
                      handleStatusChange(exp.id, 'paused')
                    }}
                  >
                    暂停
                  </button>
                )}
                {(exp.status === 'paused' || exp.status === 'draft') && (
                  <button
                    className="btn btn-sm btn-info"
                    onClick={e => {
                      e.preventDefault()
                      handleStatusChange(exp.id, 'running')
                    }}
                  >
                    {exp.status === 'draft' ? '启动' : '继续'}
                  </button>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
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
