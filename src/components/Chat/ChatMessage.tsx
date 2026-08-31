import { useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { Copy, CheckCheck } from 'lucide-react'
import type { Message as MessageType } from '../../types'
import { useChatEmoji, getAvatarGlow } from '../../hooks/useAvatar'
import ImageViewer from './ImageViewer'

const TOOL_LABELS: Record<string, string> = {
  lever_rule_calculator: '杠杆定律计算',
  cooling_curve_simulator: '冷却曲线模拟',
  phase_diagram_renderer: '图片生成',
  generic_diagram_renderer: '图片生成',
  reaction_checker: '反应类型对比',
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }, [text])

  if (!text) return null

  return (
    <button onClick={handleCopy}
      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 mb-1"
      style={{ background: copied ? 'rgba(34,197,94,0.15)' : 'var(--bg-hover)', color: copied ? '#4ade80' : 'var(--text-muted)', border: copied ? '1px solid rgba(34,197,94,0.2)' : '1px solid var(--border-subtle)' }}
      title="复制">
      {copied ? <CheckCheck size={13} /> : <Copy size={13} />}
    </button>
  )
}

export default function ChatMessage({ message }: { message: MessageType }) {
  const aiEmoji = useChatEmoji()
  const glow = getAvatarGlow(aiEmoji)
  const isUser = message.role === 'user'
  const isError = message.role === 'assistant' && /^(错误|网络错误)[:：]/.test(message.content)
  const [viewerSrc, setViewerSrc] = useState<string | null>(null)

  return (
    <div className={`flex gap-3 mb-5 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className={`w-9 h-9 rounded-2xl bg-white/[0.03] ${glow} flex items-center justify-center text-base shrink-0 mt-0.5 transition-all duration-300`}>
          {aiEmoji}
        </div>
      )}
      {isUser ? (
        <div className="max-w-[75%] order-first">
          <div className="bg-blue-600/80 text-white px-4 py-2.5 rounded-2xl rounded-br-md shadow-[0_4px_16px_rgba(59,130,246,0.15)]">
            {message.imageBase64 && <img src={`data:image/png;base64,${message.imageBase64}`} alt="" className="max-w-xs rounded-xl mb-2" />}
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{message.content}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-end gap-1 group max-w-[78%]">
          <div className={`flex-1 px-4 py-3 rounded-2xl rounded-bl-md border ${
            isError
              ? 'bg-red-500/5 border-red-500/15 text-red-300'
              : 'bg-white/[0.02] border-white/[0.04] text-zinc-200'
          }`}>
            {message.toolCalls && message.toolCalls.length > 0 && (
              <div className="mb-2.5 flex items-center gap-2.5 flex-wrap">
                {message.toolCalls.map((tc, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    <span style={{
                      display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                      background: '#4ade80',
                      boxShadow: '0 0 6px rgba(34,197,94,0.5)'
                    }} />
                    {TOOL_LABELS[tc.tool_name] || tc.tool_name}
                  </span>
                ))}
              </div>
            )}
            <div className={`prose max-w-none ${isError ? 'text-red-300' : ''}`}>
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                {message.content
                  .replace(/!\[.*?\]\(.*?\)/g, '')  // strip markdown image syntax
                  .replace(/\\\(/g, '$').replace(/\\\)/g, '$')
                  .replace(/\\\[/g, '$$').replace(/\\\]/g, '$$')}
              </ReactMarkdown>
            </div>
            {message.diagramBase64 && (
              <img src={`data:image/png;base64,${message.diagramBase64}`} alt="diagram"
                onClick={() => setViewerSrc(message.diagramBase64!)}
                className="mt-3 rounded-xl border border-white/[0.04] max-w-full cursor-zoom-in hover:border-white/10 transition-all duration-200" />
            )}
          </div>
          {!isError && <CopyButton text={message.content} />}
        </div>
      )}
      {isUser && (
        <div className="w-8 h-8 rounded-xl bg-blue-600/60 border border-blue-500/20 text-white flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">
          Y
        </div>
      )}
      <ImageViewer src={viewerSrc} onClose={() => setViewerSrc(null)} />
    </div>
  )
}
