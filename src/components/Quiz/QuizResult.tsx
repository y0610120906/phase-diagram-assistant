import { useState } from 'react'
import type { GradeResult } from '../../types'

interface Props { results: GradeResult[]; onClose: () => void; onRetry: () => void }

export default function QuizResult({ results, onClose, onRetry }: Props) {
  const [hoveredRing, setHoveredRing] = useState<'green' | 'red' | null>(null)
  const totalScore = results.reduce((s, r) => s + r.score, 0)
  const maxScore = results.reduce((s, r) => s + r.max_score, 0)
  // Scale to 100
  const scaledScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0
  const greenPct = scaledScore
  const redPct = 100 - scaledScore
  const correct = results.filter(r => r.score >= r.max_score * 0.6).length
  const wrong = results.length - correct
  const greenGlow = '0 0 16px rgba(34,197,94,0.5)'
  const redGlow = '0 0 16px rgba(239,68,68,0.5)'

  const circumference = 2 * Math.PI * 50
  const greenDash = (greenPct / 100) * circumference
  const redDash = (redPct / 100) * circumference

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-zinc-200">批改结果</h2>
        <button onClick={onClose} className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">返回</button>
      </div>

      {/* Ring + stats */}
      <div className="flex items-center gap-10 mb-8">
        <div className="relative shrink-0" style={{ width: 130, height: 130 }}
          onMouseLeave={() => setHoveredRing(null)}>
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            {/* Background ring */}
            <circle cx={60} cy={60} r={50} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={9} />
            {/* Green segment */}
            <circle cx={60} cy={60} r={50} fill="none" stroke="#22c55e" strokeWidth={9}
              strokeLinecap="round" strokeDasharray={`${greenDash} ${circumference}`}
              strokeDashoffset={0}
              style={{ filter: hoveredRing === 'red' ? 'none' : `drop-shadow(${greenGlow})`, transition: 'filter 0.2s', cursor: 'pointer' }}
              onMouseEnter={() => setHoveredRing('green')} />
            {/* Red segment */}
            <circle cx={60} cy={60} r={50} fill="none" stroke="#ef4444" strokeWidth={9}
              strokeLinecap="round" strokeDasharray={`${redDash} ${circumference}`}
              strokeDashoffset={-greenDash}
              style={{ filter: hoveredRing === 'green' ? 'none' : `drop-shadow(${redGlow})`, transition: 'filter 0.2s', cursor: 'pointer' }}
              onMouseEnter={() => setHoveredRing('red')} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold tracking-tight">{scaledScore}</span>
            <span className="text-[10px] text-zinc-500">/100</span>
          </div>
          {/* Hover tooltip */}
          {hoveredRing && (
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] px-2.5 py-1 rounded-lg bg-zinc-800/90 border border-white/[0.08] backdrop-blur-sm shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
              style={{ color: hoveredRing === 'green' ? '#4ade80' : '#f87171' }}>
              {hoveredRing === 'green' ? `获得 ${scaledScore} 分` : `丢失 ${100 - scaledScore} 分`}
            </div>
          )}
        </div>

        {/* Stats grid */}
        <div className="flex-1 grid grid-cols-3 gap-3">
          <div className="text-center py-4 px-2 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
            <div className="text-xl font-bold text-emerald-400">{correct}</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">答对</div>
          </div>
          <div className="text-center py-4 px-2 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
            <div className="text-xl font-bold text-red-400">{wrong}</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">答错</div>
          </div>
          <div className="text-center py-4 px-2 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
            <div className="text-xl font-bold text-blue-400">{scaledScore}%</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">正确率</div>
          </div>
        </div>
      </div>

      {/* Per-question cards */}
      {results.map((r, i) => {
        const pct = r.max_score > 0 ? Math.round((r.score / r.max_score) * 100) : 0
        return (
          <div key={r.question_id} className="glow-card mb-3 rounded-2xl border border-white/[0.04] p-4 bg-white/[0.01]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-zinc-300">第 {i + 1} 题</span>
              <div className="flex items-center gap-2">
                {(r.question_type === 'choice' || r.question_type === 'true_false' || r.question_type === 'fill_blank') && r.correct_answer && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.03] text-zinc-500">答案：{r.correct_answer}</span>
                )}
                <span className={`text-sm font-bold ${pct >= 60 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {r.score}/{r.max_score} · {pct}%
                </span>
              </div>
            </div>
            {r.correct_points.length > 0 && (
              <div className="mb-1"><span className="text-[11px] text-emerald-400/80 font-medium">正确</span>
                <ul className="text-[11px] text-emerald-400/60 mt-0.5 space-y-0.5">{r.correct_points.map((p, j) => <li key={j}>· {p}</li>)}</ul>
              </div>
            )}
            {r.errors.length > 0 && (
              <div className="mb-1"><span className="text-[11px] text-red-400/80 font-medium">错误</span>
                <ul className="text-[11px] text-red-400/60 mt-0.5 space-y-0.5">{r.errors.map((e, j) => <li key={j}>· {e}</li>)}</ul>
              </div>
            )}
            <div className="mt-2 p-3 bg-emerald-500/[0.04] rounded-xl text-[11px] leading-relaxed whitespace-pre-wrap">
              <span className="font-medium text-emerald-400/80">📝 正确答案：</span>
              <span className="text-emerald-400/70">{r.standard_answer || '（暂无）'}</span>
            </div>
            <div className="mt-1.5 p-3 bg-blue-500/[0.04] rounded-xl text-[11px] text-zinc-300 leading-relaxed whitespace-pre-wrap">
              <span className="font-medium text-blue-400/80">🔍 详细解析：</span>
              <span className="text-zinc-400/80">{r.explanation || '（暂无）'}</span>
            </div>
          </div>
        )
      })}

      <div className="flex gap-3 mt-6">
        <button onClick={onRetry}
          className="flex-1 py-3 rounded-xl bg-blue-600/80 hover:bg-blue-600 text-white text-sm font-medium transition-all duration-200 active:scale-[0.99] shadow-[0_4px_20px_rgba(59,130,246,0.25)]">
          重新作答</button>
        <button onClick={onClose}
          className="flex-1 py-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.05] text-zinc-300 text-sm font-medium transition-all duration-200 active:scale-[0.99] border border-white/[0.04]">
          完成</button>
      </div>
    </div>
  )
}
