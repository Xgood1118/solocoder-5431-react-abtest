import { ReactNode, useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { storage } from '../services/storage'
import './Layout.css'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()

  const navItems = [
    { path: '/', label: '实验列表', icon: '📊' },
    { path: '/sample-size-calculator', label: '样本量计算器', icon: '🧮' },
  ]

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="logo">A/B Test</h1>
          <span className="logo-sub">纯前端测试平台</span>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${
                location.pathname === item.path ? 'active' : ''
              }`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <StorageUsage />
        </div>
      </aside>
      <main className="main-content">
        {children}
      </main>
    </div>
  )
}

function StorageUsage() {
  const [usageKB, setUsageKB] = useState(0)

  useEffect(() => {
    const updateUsage = () => {
      const bytes = storage.getAbtestSize()
      setUsageKB(Math.round(bytes / 1024))
    }
    updateUsage()
    const interval = setInterval(updateUsage, 3000)
    return () => clearInterval(interval)
  }, [])

  const maxKB = 5 * 1024
  const percentage = Math.min((usageKB / maxKB) * 100, 100)
  const isWarning = percentage > 80

  return (
    <div className="storage-info">
      <div className="storage-label-row">
        <span className="storage-label">本地存储</span>
        <span className={`storage-value ${isWarning ? 'warning' : ''}`}>
          {usageKB} KB / 5 MB
        </span>
      </div>
      <div className="storage-bar">
        <div
          className={`storage-bar-fill ${isWarning ? 'warning' : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
