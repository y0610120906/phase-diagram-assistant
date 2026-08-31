import { useState, useEffect, useRef } from 'react'
import { X, CheckCircle2, AlertTriangle, Lightbulb, ArrowRight, Download } from 'lucide-react'
import html2canvas from 'html2canvas'
import * as api from '../../services/api'

interface ReceiptData {
  title: string; date: string; duration_min: number; rounds: number
  summary: string
  learned: { topic: string; detail: string }[]
  weak: { topic: string; detail: string }[]
  concepts: { name: string; mastery: string }[]
  path: { step: number; name: string; status: string }[]
  exercises: { question: string; answer: string }[]
  suggestions: string[]
  next: string
}

interface Props { sessionId: string; open: boolean; onClose: () => void }

export default function ReceiptModal({ sessionId, open, onClose }: Props) {
  const [data, setData] = useState<ReceiptData | null>(null)
  const [loading, setLoading] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && sessionId) {
      setLoading(true); setData(null)
      api.generateReceipt(sessionId).then(d => {
        setTimeout(() => { setData(d); setLoading(false) }, 400)
      }).catch(() => {
        setLoading(false)
      })
    }
  }, [open, sessionId])

  function handleCancel() {
    setLoading(false)
    onClose()
  }

  async function handleDownloadImage() {
    if (!contentRef.current) return
    const el = contentRef.current
    const isLight = document.body.classList.contains('light')
    const pageBg = isLight ? '#fdf6ee' : '#0a0a18'
    const cardBg = isLight ? 'rgba(255,251,245,0.95)' : 'rgba(20,20,30,0.95)'
    // Replace CSS variables with actual colors for canvas rendering
    const origBg = el.style.background
    el.style.background = cardBg
    try {
      const canvas = await html2canvas(el, {
        backgroundColor: pageBg,
        scale: 2,
        useCORS: true,
      })
      const link = document.createElement('a')
      link.download = `学习总结_${data?.date || 'summary'}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (e) {
      console.error('Export failed:', e)
    }
    el.style.background = origBg
  }

  if (!open) return null

  const mastered = data?.concepts.filter(c => c.mastery === 'mastered').length || 0
  const total = data?.concepts.length || 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose() }}>
      <div className="w-[600px] max-h-[85vh] overflow-y-auto rounded-2xl"
        style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)', boxShadow: '0 16px 48px rgba(0,0,0,0.4)' }}>

        {loading ? (
          <div className="px-8 py-10">
            <div className="text-center mb-8">
              <div className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>正在生成学习总结</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>AI 正在分析对话并生成总结，请稍候…</div>
            </div>

            {/* Skeleton screen */}
            <div className="space-y-3">
              {/* Summary block */}
              <div className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--border-subtle)' }} />
              {/* Stats row */}
              <div className="flex gap-3">
                <div className="flex-1 h-16 rounded-xl animate-pulse" style={{ background: 'var(--border-subtle)', animationDelay: '0.1s' }} />
                <div className="flex-1 h-16 rounded-xl animate-pulse" style={{ background: 'var(--border-subtle)', animationDelay: '0.2s' }} />
                <div className="flex-1 h-16 rounded-xl animate-pulse" style={{ background: 'var(--border-subtle)', animationDelay: '0.3s' }} />
              </div>
              {/* Learned items */}
              <div className="h-10 w-3/4 rounded-xl animate-pulse" style={{ background: 'var(--border-subtle)', animationDelay: '0.4s' }} />
              <div className="h-20 rounded-xl animate-pulse" style={{ background: 'var(--border-subtle)', animationDelay: '0.5s' }} />
              {/* Suggestions */}
              <div className="h-10 w-2/3 rounded-xl animate-pulse" style={{ background: 'var(--border-subtle)', animationDelay: '0.6s' }} />
              <div className="h-14 rounded-xl animate-pulse" style={{ background: 'var(--border-subtle)', animationDelay: '0.7s' }} />
            </div>

            <div className="flex justify-center mt-8">
              <button onClick={handleCancel}
                className="px-5 py-2 rounded-xl text-sm font-medium transition-colors hover:bg-red-500/10"
                style={{ color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}>
                取消
              </button>
            </div>
          </div>
        ) : data && (data.summary || data.learned?.length || data.weak?.length) ? (
          <div ref={contentRef} className="px-8 py-7" id="receipt-content">
            {/* Header + actions */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>📋 学习总结</h2>
                <div className="flex items-center gap-4 mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span>📅 {data.date}</span>
                  <span>⏱ {data.duration_min} 分钟</span>
                  <span>💬 {data.rounds} 轮对话</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={handleDownloadImage} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/[0.06] transition-colors" title="导出为图片">
                  <Download size={15} style={{ color: 'var(--text-muted)' }} />
                </button>
                <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/[0.06] transition-colors">
                  <X size={17} style={{ color: 'var(--text-muted)' }} />
                </button>
              </div>
            </div>

            {/* Summary */}
            {data.summary && (
              <div className="mb-6 p-4 rounded-xl" style={{ background: 'var(--bg-bubble-ai)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{data.summary}</p>
              </div>
            )}

            {/* Stats */}
            <div className="flex gap-3 mb-6">
              <div className="flex-1 rounded-xl px-4 py-3 text-center" style={{ background: 'rgba(34,197,94,0.08)' }}>
                <div className="text-xl font-bold" style={{ color: '#4ade80' }}>{mastered}</div>
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>已掌握</div>
              </div>
              <div className="flex-1 rounded-xl px-4 py-3 text-center" style={{ background: 'rgba(251,146,60,0.08)' }}>
                <div className="text-xl font-bold" style={{ color: '#fb923c' }}>{data.weak.length}</div>
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>需加强</div>
              </div>
              <div className="flex-1 rounded-xl px-4 py-3 text-center" style={{ background: 'rgba(96,165,250,0.08)' }}>
                <div className="text-xl font-bold" style={{ color: '#60a5fa' }}>{total - mastered}</div>
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>学习中</div>
              </div>
            </div>

            {/* Learned */}
            {data.learned.length > 0 && (
              <div className="mb-5">
                <h3 className="flex items-center gap-2 text-sm font-semibold mb-3" style={{ color: '#4ade80' }}>
                  <CheckCircle2 size={16} /> 已掌握
                </h3>
                <div className="space-y-2">
                  {data.learned.map((item, i) => (
                    <div key={i} className="pl-4 py-2 border-l-2" style={{ borderColor: 'rgba(34,197,94,0.3)' }}>
                      <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.topic}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Weak */}
            {data.weak.length > 0 && (
              <div className="mb-5">
                <h3 className="flex items-center gap-2 text-sm font-semibold mb-3" style={{ color: '#fb923c' }}>
                  <AlertTriangle size={16} /> 需要加强
                </h3>
                <div className="space-y-2">
                  {data.weak.map((item, i) => (
                    <div key={i} className="pl-4 py-2 border-l-2" style={{ borderColor: 'rgba(251,146,60,0.3)' }}>
                      <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.topic}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Knowledge path */}
            {data.path?.length > 0 && (
              <div className="mb-5">
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>🗺️ 学习路径</h3>
                <div className="flex items-center flex-wrap gap-1.5">
                  {data.path.map((p, i) => (
                    <span key={i} className="flex items-center gap-1">
                      {i > 0 && <span className="text-[10px] mx-0.5" style={{ color: 'var(--text-muted)' }}>→</span>}
                      <span className="px-2.5 py-1 rounded-lg text-xs font-medium" style={{
                        background: p.status === 'done' ? 'rgba(34,197,94,0.1)' : p.status === 'current' ? 'rgba(217,119,6,0.12)' : 'rgba(161,161,170,0.06)',
                        color: p.status === 'done' ? '#4ade80' : p.status === 'current' ? '#d97706' : '#a1a1aa',
                        border: `1px solid ${p.status === 'done' ? 'rgba(34,197,94,0.2)' : p.status === 'current' ? 'rgba(217,119,6,0.2)' : 'rgba(161,161,170,0.1)'}`,
                      }}>
                        {p.status === 'done' ? '✓ ' : p.status === 'current' ? '● ' : ''}{p.name}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Practice exercises */}
            {data.exercises?.length > 0 && (
              <div className="mb-5 p-4 rounded-xl" style={{ background: 'var(--bg-bubble-ai)', border: '1px solid var(--border-subtle)' }}>
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>✏️ 推荐练习</h3>
                <div className="space-y-3">
                  {data.exercises.map((ex, i) => (
                    <details key={i} className="group">
                      <summary className="text-sm cursor-pointer font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {i + 1}. {ex.question}
                      </summary>
                      <div className="mt-2 p-3 rounded-lg text-xs leading-relaxed" style={{ background: 'rgba(34,197,94,0.04)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.1)' }}>
                        💡 {ex.answer}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {data.suggestions.length > 0 && (
              <div className="mb-5 p-4 rounded-xl" style={{ background: 'var(--bg-bubble-ai)', border: '1px solid var(--border-subtle)' }}>
                <h3 className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  <Lightbulb size={16} style={{ color: '#fbbf24' }} /> 学习建议
                </h3>
                <ul className="space-y-1.5">
                  {data.suggestions.map((s, i) => (
                    <li key={i} className="text-sm flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
                      <span style={{ color: 'var(--accent)' }}>{i + 1}.</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Next */}
            {data.next && (
              <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'var(--accent-soft)', border: '1px solid rgba(217,119,6,0.15)' }}>
                <ArrowRight size={16} style={{ color: 'var(--accent)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--accent)' }}>{data.next}</span>
              </div>
            )}
          </div>
        ) : data ? (
          <div className="px-8 py-16 text-center">
            <div className="text-4xl mb-4">🤔</div>
            <div className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>生成结果不完整</div>
            <div className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>对话内容太少或 AI 分析异常，换个有实质内容的对话试试</div>
            <button onClick={onClose} className="text-xs underline" style={{ color: 'var(--accent)' }}>关闭</button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
