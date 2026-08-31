import { useState, useEffect } from 'react'
import { Trash2, CheckCircle, AlertTriangle, RefreshCw, Circle, ChevronDown, ExternalLink } from 'lucide-react'
import { useChatStore } from '../../store/chatStore'
import * as api from '../../services/api'

const MASTERY_OPTIONS = [
  { value: 'mastered', label: '✅ 已掌握', color: '#4ade80', bg: 'rgba(34,197,94,0.1)' },
  { value: 'weak', label: '⚠️ 薄弱', color: '#fb923c', bg: 'rgba(251,146,60,0.1)' },
  { value: 'learning', label: '🔄 学习中', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  { value: 'unlearned', label: '❌ 未掌握', color: '#a1a1aa', bg: 'rgba(161,161,170,0.06)' },
]
const MASTERY_MAP = Object.fromEntries(MASTERY_OPTIONS.map(o => [o.value, o]))

export default function StudentProfile() {
  const [profile, setProfile] = useState<any>(null)
  const [timeline, setTimeline] = useState<any[]>([])
  const [trends, setTrends] = useState<any[]>([])
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const setActiveSession = useChatStore((s) => s.setActiveSession)
  const activeSession = useChatStore((s) => s.activeSession)

  useEffect(() => {
    api.getStudentProfile().then(setProfile)
    api.getStudentTimeline().then(setTimeline).catch(() => {})
    api.getStudentTrends().then(setTrends).catch(() => {})
  }, [])

  useEffect(() => {
    if (!openDropdown) return
    const close = () => setOpenDropdown(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [openDropdown])

  async function changeMastery(concept: string, current: string, newMastery: string) {
    setOpenDropdown(null)
    if (newMastery === current) return
    const updated = await api.updateStudentConcept(concept, newMastery, undefined, activeSession?.id)
    setProfile(updated)
    api.getStudentTimeline().then(setTimeline).catch(() => {})
  }

  async function handleReset() {
    if (!confirm('确定清空所有学习记录？')) return
    setProfile(await api.resetStudentProfile())
    setTimeline([]); setTrends([])
  }

  async function openSession(sessionId: string) {
    if (!sessionId) return
    try {
      const session = await api.getSession(sessionId)
      setActiveSession(session)
    } catch {}
  }

  const concepts: Record<string, any> = profile?.concepts || {}
  const entries = Object.entries(concepts) as [string, any][]
  const stats = { mastered: 0, weak: 0, learning: 0, unlearned: 0 }
  entries.forEach(([, v]) => { const m = v.mastery; if (m in stats) stats[m as keyof typeof stats]++ })
  const total = entries.length
  const pct = total > 0 ? Math.round((stats.mastered / total) * 100) : 0

  return (
    <div className="max-w-5xl mx-auto w-full px-6 py-6 page-enter">
      {/* Stats bar + ring */}
      <div className="flex items-center gap-6 mb-8 p-5 rounded-2xl" style={{ background: 'var(--bg-bubble-ai)', border: '1px solid var(--border-subtle)' }}>
        <div className="relative shrink-0" style={{ width: 80, height: 80 }}>
          <svg viewBox="0 0 120 120" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={60} cy={60} r={50} fill="none" stroke="var(--border-subtle)" strokeWidth={8} />
            {total > 0 && (
              <circle cx={60} cy={60} r={50} fill="none" stroke="#4ade80" strokeWidth={8} strokeLinecap="round"
                strokeDasharray={`${pct * 3.14} ${314}`}
                style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.16,1,0.3,1)' }} />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{total > 0 ? pct + '%' : '--'}</span>
          </div>
        </div>
        <div className="flex-1 grid grid-cols-4 gap-3">
          {MASTERY_OPTIONS.map(o => (
            <div key={o.value} className="text-center py-3 rounded-xl transition-all duration-300 hover:scale-105" style={{ background: o.bg }}>
              <div className="text-xl font-bold" style={{ color: o.color }}>{stats[o.value as keyof typeof stats] || 0}</div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{o.label}</div>
            </div>
          ))}
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{total}</div>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>总知识点</div>
          {total > 0 && (
            <button onClick={handleReset} className="mt-2 text-[10px] flex items-center gap-1 hover:text-red-400 transition-colors" style={{ color: 'var(--text-muted)' }}>
              <Trash2 size={11} /> 清空
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* LEFT: Timeline + Trends */}
        <div className="space-y-6">
          {/* Timeline */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--bg-bubble-ai)', border: '1px solid var(--border-subtle)' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>📅 学习时间线</h3>
            {timeline.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>开始对话后自动记录</p>
            ) : (
              <div className="relative pl-5 max-h-[340px] overflow-y-auto">
                <div className="absolute left-[5px] top-1 bottom-1 w-0.5 rounded" style={{ background: 'var(--border-subtle)' }} />
                {timeline.slice(0, 15).map((e, i) => {
                  const m = MASTERY_MAP[e.mastery] || MASTERY_MAP.learning
                  return (
                    <div key={i} className="relative mb-3 pl-4 animate-[msg-in_0.3s_ease-out]" style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'both' }}>
                      <div className="absolute left-[-8px] top-[6px] w-[7px] h-[7px] rounded-full" style={{ background: m.color, boxShadow: `0 0 8px ${m.color}40` }} />
                      <div className="text-[10px] mb-0.5" style={{ color: 'var(--text-muted)' }}>{e.time}</div>
                      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        学习了 <strong style={{ color: 'var(--text-primary)' }}>{e.concept}</strong>
                        <span className="ml-1 px-1 py-0.5 rounded text-[9px]" style={{ background: m.bg, color: m.color }}>{m.label}</span>
                      </div>
                      {e.session_id && (
                        <button onClick={() => openSession(e.session_id)} className="mt-1 text-[10px] flex items-center gap-1 hover:underline transition-colors" style={{ color: 'var(--accent)' }}>
                          <ExternalLink size={10} /> 查看对话
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Trends */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--bg-bubble-ai)', border: '1px solid var(--border-subtle)' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>📈 掌握度趋势</h3>
            {trends.length < 2 ? (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>数据积累中，多聊几次就有趋势了</p>
            ) : (
              <div>
                <div className="flex items-end gap-2 h-[70px] mb-2">
                  {trends.slice(-10).map((d, i) => {
                    const h = d.total > 0 ? Math.max(10, (d.mastered / Math.max(1, d.total)) * 70) : 5
                    return (
                      <div key={i} className="flex-1 rounded-t transition-all duration-500 cursor-pointer hover:opacity-80 relative group"
                        style={{ height: h + 'px', background: d.mastered > 0 ? '#4ade80' : 'var(--border-subtle)', minWidth: 16 }}>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap"
                          style={{ background: 'rgba(0,0,0,0.8)', color: '#e4e4e7' }}>
                          {d.date} · ✅{d.mastered} ⚠️{d.weak}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between text-[9px]" style={{ color: 'var(--text-muted)' }}>
                  <span>{trends[0]?.date}</span><span>{trends[trends.length - 1]?.date}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Suggestions + Graph + Concept list */}
        <div className="space-y-6">
          {/* Smart suggestions */}
          {entries.filter(([, v]) => v.mastery === 'weak' || v.mastery === 'unlearned').length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: 'var(--bg-bubble-ai)', border: '1px solid var(--border-subtle)' }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>💡 学习建议</h3>
              <div className="space-y-2">
                {entries.filter(([, v]) => v.mastery === 'weak').slice(0, 2).map(([name]) => (
                  <div key={name} className="flex items-center gap-2 p-2.5 rounded-xl text-xs transition-all duration-200 hover:scale-[1.02]"
                    style={{ background: 'rgba(251,146,60,0.06)', border: '1px solid rgba(251,146,60,0.12)' }}>
                    <AlertTriangle size={14} style={{ color: '#fb923c' }} />
                    <span style={{ color: 'var(--text-secondary)' }}><strong style={{ color: '#fb923c' }}>{name}</strong> 需要加强练习</span>
                  </div>
                ))}
                {entries.filter(([, v]) => v.mastery === 'unlearned').slice(0, 1).map(([name]) => (
                  <div key={name} className="flex items-center gap-2 p-2.5 rounded-xl text-xs transition-all duration-200 hover:scale-[1.02]"
                    style={{ background: 'rgba(161,161,170,0.06)', border: '1px solid rgba(161,161,170,0.12)' }}>
                    <Circle size={14} style={{ color: '#a1a1aa' }} />
                    <span style={{ color: 'var(--text-secondary)' }}><strong style={{ color: '#a1a1aa' }}>{name}</strong> 尚未掌握，建议开始学习</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Knowledge graph (simple node list) */}
          {total > 0 && (
            <div className="rounded-2xl p-5" style={{ background: 'var(--bg-bubble-ai)', border: '1px solid var(--border-subtle)' }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>🗺️ 知识点概览</h3>
              <div className="flex flex-wrap gap-2">
                {entries
                  .sort((a, b) => {
                    const order = { mastered: 0, learning: 1, weak: 2, unlearned: 3 }
                    return (order[a[1].mastery as keyof typeof order] ?? 9) - (order[b[1].mastery as keyof typeof order] ?? 9)
                  })
                  .map(([name, info]) => {
                    const m = MASTERY_MAP[info.mastery] || MASTERY_MAP.learning
                    return (
                      <div key={name} className="relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === name ? null : name) }}
                          className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-300 hover:scale-105"
                          style={{ background: m.bg, border: `1px solid ${m.color}20`, color: m.color }}>
                          {name}
                          <ChevronDown size={10} className="inline ml-1 transition-transform duration-300" style={{ transform: openDropdown === name ? 'rotate(180deg)' : '' }} />
                        </button>
                        {/* Dropdown mastery selector */}
                        <div className={`absolute top-full mt-1 left-0 z-20 rounded-xl p-1 shadow-[0_8px_24px_rgba(0,0,0,0.4)] transition-all duration-300 origin-top ${openDropdown === name ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'}`}
                          style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)', backdropFilter: 'blur(20px)', minWidth: 140 }}>
                          {MASTERY_OPTIONS.map(o => (
                            <button key={o.value}
                              onClick={(e) => { e.stopPropagation(); changeMastery(name, info.mastery, o.value) }}
                              className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-[1.02]"
                              style={{
                                background: o.value === info.mastery ? o.bg : 'transparent',
                                color: o.value === info.mastery ? o.color : 'var(--text-muted)',
                              }}>
                              {o.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {total === 0 && (
            <div className="text-center py-16 rounded-2xl" style={{ background: 'var(--bg-bubble-ai)', border: '1px solid var(--border-subtle)' }}>
              <div className="text-5xl mb-5">📝</div>
              <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>还没有学习记录</h3>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>每轮对话后自动分析生成，现在去聊几句相图吧</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
