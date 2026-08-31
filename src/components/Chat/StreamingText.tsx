import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import type { ToolCall } from '../../types'
import { useChatEmoji, getAvatarGlow } from '../../hooks/useAvatar'
import ImageViewer from './ImageViewer'

const TOOL_LABELS: Record<string, string> = {
  lever_rule_calculator: '计算杠杆定律',
  cooling_curve_simulator: '模拟冷却曲线',
  phase_diagram_renderer: '生成图片',
  generic_diagram_renderer: '生成图片',
  reaction_checker: '对比反应类型',
}

interface Props { content: string; diagramBase64: string | null; toolCalls: ToolCall[] }

export default function StreamingText({ content, diagramBase64, toolCalls }: Props) {
  const aiEmoji = useChatEmoji()
  const glow = getAvatarGlow(aiEmoji)
  const [viewerSrc, setViewerSrc] = useState<string | null>(null)
  return (
    <div className="flex gap-3 mb-5 justify-start">
      <div className={`w-9 h-9 rounded-2xl bg-white/[0.03] ${glow} flex items-center justify-center text-base shrink-0 mt-0.5 transition-all duration-300`}>{aiEmoji}</div>
      <div className="bg-white/[0.02] border border-white/[0.04] px-4 py-3 rounded-2xl rounded-bl-md max-w-[75%] min-w-[180px]">
        {toolCalls.length > 0 && (
          <div className="mb-2.5 flex items-center gap-2.5 flex-wrap">
            {toolCalls.map((tc, i) => {
              const done = !!tc.result
              return (
                <span key={i} className="inline-flex items-center gap-1.5 text-[10px]"
                  style={{ color: done ? 'var(--text-muted)' : '#fbbf24' }}>
                  <span style={{
                    display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                    background: done ? '#4ade80' : '#fbbf24',
                    boxShadow: done ? '0 0 6px rgba(34,197,94,0.5)' : '0 0 8px rgba(251,191,36,0.6)',
                    animation: done ? 'none' : 'pulse 1.2s ease-in-out infinite'
                  }} />
                  {TOOL_LABELS[tc.tool_name] || tc.tool_name}
                </span>
              )
            })}
          </div>
        )}
        {content ? (
          <div className="prose max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
              {(content + '▍')
                .replace(/!\[.*?\]\(.*?\)/g, '')
                .replace(/\\\(/g, '$').replace(/\\\)/g, '$')
                .replace(/\\\[/g, '$$').replace(/\\\]/g, '$$')}
            </ReactMarkdown>
          </div>
        ) : toolCalls.length === 0 ? (
          <div className="flex items-center gap-2 text-zinc-500 text-sm">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '120ms' }} />
              <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '240ms' }} />
            </div>
            <span>思考中</span>
          </div>
        ) : null}
        {diagramBase64 && (
          <img src={`data:image/png;base64,${diagramBase64}`} alt=""
            onClick={() => setViewerSrc(diagramBase64)}
            className="mt-3 rounded-xl border border-white/[0.04] max-w-full cursor-zoom-in hover:border-white/10 transition-all duration-200" />
        )}
      </div>
      <ImageViewer src={viewerSrc} onClose={() => setViewerSrc(null)} />
    </div>
  )
}
