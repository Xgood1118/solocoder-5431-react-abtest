import { useState, useRef, useEffect } from 'react'
import type { Variant, FormField } from '../types'
import './VariantEditor.css'

interface VariantEditorProps {
  variant: Variant
  onChange: (updates: Partial<Variant>) => void
}

export default function VariantEditor({ variant, onChange }: VariantEditorProps) {
  const [activeTab, setActiveTab] = useState<'visual' | 'html' | 'css'>('visual')
  const [localVariant, setLocalVariant] = useState<Variant>(variant)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    setLocalVariant(variant)
  }, [variant])

  const updateLocal = (updates: Partial<Variant>) => {
    setLocalVariant(prev => {
      const next = { ...prev, ...updates }
      return next
    })
    onChange(updates)
  }

  const buildPreviewHtml = (): string => {
    return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <style>${localVariant.css}</style>
  </head>
  <body>
    ${localVariant.html}
  </body>
</html>
    `.trim()
  }

  const handleHeroImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      const updatedHtml = localVariant.html.replace(
        /(<img[^>]*id="hero-image"[^>]*src=")[^"]*(")/,
        `$1${dataUrl}$2`
      )
      updateLocal({ heroImage: dataUrl, html: updatedHtml })
    }
    reader.readAsDataURL(file)
  }

  const handleButtonTextChange = (text: string) => {
    const updatedHtml = localVariant.html.replace(
      /(id="cta-button"[^>]*>)[^<]*(<\/button>)/,
      `$1${text}$2`
    )
    updateLocal({ buttonText: text, html: updatedHtml })
  }

  const handleHeadlineChange = (text: string) => {
    const updatedHtml = localVariant.html.replace(
      /(<h1[^>]*class="headline"[^>]*>)[^<]*(<\/h1>)/,
      `$1${text}$2`
    )
    updateLocal({ html: updatedHtml })
  }

  const handleSubheadlineChange = (text: string) => {
    const updatedHtml = localVariant.html.replace(
      /(<p[^>]*class="subheadline"[^>]*>)[^<]*(<\/p>)/,
      `$1${text}$2`
    )
    updateLocal({ html: updatedHtml })
  }

  const addFormField = () => {
    const newField: FormField = {
      id: `f${Date.now()}`,
      label: '新字段',
      type: 'text',
      required: false,
      placeholder: '请输入',
    }
    updateLocal({ formFields: [...localVariant.formFields, newField] })
  }

  const updateFormField = (fieldId: string, updates: Partial<FormField>) => {
    const fields = localVariant.formFields.map(f =>
      f.id === fieldId ? { ...f, ...updates } : f
    )
    updateLocal({ formFields: fields })
  }

  const removeFormField = (fieldId: string) => {
    const fields = localVariant.formFields.filter(f => f.id !== fieldId)
    updateLocal({ formFields: fields })
  }

  const headlineMatch = localVariant.html.match(/<h1[^>]*class="headline"[^>]*>([^<]*)<\/h1>/)
  const headline = headlineMatch ? headlineMatch[1] : ''

  const subheadlineMatch = localVariant.html.match(/<p[^>]*class="subheadline"[^>]*>([^<]*)<\/p>/)
  const subheadline = subheadlineMatch ? subheadlineMatch[1] : ''

  const previewSrcDoc = buildPreviewHtml()

  return (
    <div className="variant-editor">
      <div className="editor-tabs">
        <button
          className={`tab-btn ${activeTab === 'visual' ? 'active' : ''}`}
          onClick={() => setActiveTab('visual')}
        >
          🎨 可视化编辑
        </button>
        <button
          className={`tab-btn ${activeTab === 'html' ? 'active' : ''}`}
          onClick={() => setActiveTab('html')}
        >
          📝 HTML
        </button>
        <button
          className={`tab-btn ${activeTab === 'css' ? 'active' : ''}`}
          onClick={() => setActiveTab('css')}
        >
          🎯 CSS
        </button>
      </div>

      <div className="editor-content">
        <div className="editor-panel">
          {activeTab === 'visual' && (
            <div className="visual-editor">
              <div className="form-group">
                <label>变体名称</label>
                <input
                  type="text"
                  value={localVariant.name}
                  onChange={e => updateLocal({ name: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>权重</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={localVariant.weight}
                  onChange={e => updateLocal({ weight: Number(e.target.value) })}
                  className="form-input"
                />
              </div>

              <hr className="divider" />

              <h4 className="panel-subtitle">Hero 区域</h4>

              <div className="form-group">
                <label>标题文案</label>
                <input
                  type="text"
                  value={headline}
                  onChange={e => handleHeadlineChange(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>副标题文案</label>
                <input
                  type="text"
                  value={subheadline}
                  onChange={e => handleSubheadlineChange(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Hero 图片</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleHeroImageUpload}
                  className="file-input"
                />
                {localVariant.heroImage && (
                  <div className="image-preview-small">
                    <img src={localVariant.heroImage} alt="preview" />
                  </div>
                )}
              </div>

              <hr className="divider" />

              <h4 className="panel-subtitle">CTA 按钮</h4>

              <div className="form-group">
                <label>按钮文案</label>
                <input
                  type="text"
                  value={localVariant.buttonText}
                  onChange={e => handleButtonTextChange(e.target.value)}
                  className="form-input"
                />
              </div>

              <hr className="divider" />

              <h4 className="panel-subtitle">表单字段</h4>
              <div className="fields-list">
                {localVariant.formFields.map((field, index) => (
                  <div key={field.id} className="field-item">
                    <div className="field-header">
                      <span className="field-index">{index + 1}</span>
                      <input
                        type="text"
                        value={field.label}
                        onChange={e => updateFormField(field.id, { label: e.target.value })}
                        className="field-name-input"
                        placeholder="字段标签"
                      />
                      <button
                        className="btn-icon btn-danger"
                        onClick={() => removeFormField(field.id)}
                      >
                        删除
                      </button>
                    </div>
                    <div className="field-options">
                      <select
                        value={field.type}
                        onChange={e => updateFormField(field.id, { type: e.target.value as FormField['type'] })}
                        className="form-input"
                      >
                        <option value="text">文本</option>
                        <option value="email">邮箱</option>
                        <option value="password">密码</option>
                        <option value="number">数字</option>
                        <option value="textarea">多行文本</option>
                      </select>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={e => updateFormField(field.id, { required: e.target.checked })}
                        />
                        必填
                      </label>
                    </div>
                  </div>
                ))}
              </div>
              <button className="btn btn-secondary" onClick={addFormField}>
                + 添加字段
              </button>
            </div>
          )}

          {activeTab === 'html' && (
            <textarea
              className="code-editor"
              value={localVariant.html}
              onChange={e => updateLocal({ html: e.target.value })}
              spellCheck={false}
            />
          )}

          {activeTab === 'css' && (
            <textarea
              className="code-editor"
              value={localVariant.css}
              onChange={e => updateLocal({ css: e.target.value })}
              spellCheck={false}
            />
          )}
        </div>

        <div className="preview-panel">
          <div className="preview-header">
            <span className="preview-title">🔍 实时预览</span>
            <span className="sandbox-badge" title="沙箱隔离，禁止脚本和父页面访问">
              ⛨ 严格沙箱
            </span>
          </div>
          <div className="preview-frame-wrapper">
            <iframe
              ref={iframeRef}
              className="preview-iframe"
              sandbox=""
              srcDoc={previewSrcDoc}
              title="variant preview"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
