import { useState } from 'react'
import { Plus, ChevronLeft, ChevronRight, FlaskConical, Sun, Moon } from 'lucide-react'
import { useChatStore } from '../../store/chatStore'
import { useThemeStore } from '../../store/themeStore'
import * as api from '../../services/api'
import SessionList from '../Session/SessionList'

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const sessions = useChatStore((s) => s.sessions)
  const activeSession = useChatStore((s) => s.activeSession)
  const setSessions = useChatStore((s) => s.setSessions)
  const setActiveSession = useChatStore((s) => s.setActiveSession)
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggle)

  async function handleNewSession() {
    const session = await api.createSession()
    setActiveSession(await api.getSession(session.id))
    const { sessions } = await api.listSessions()
    setSessions(sessions)
  }

  return (
    <div className={`shrink-0 p-3 relative`} style={{ width: collapsed ? 72 : 240, transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
      <div className="h-full flex flex-col rounded-2xl overflow-hidden"
        style={{
          background: 'var(--bg-glass)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>

        {/* Header */}
        <div className="flex items-center py-4 min-h-[52px]">
          {collapsed ? (
            <div className="w-full flex justify-center" title="相图学习助手">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-400/20 flex items-center justify-center">
                <FlaskConical size={18} className="text-blue-400" />
              </div>
            </div>
          ) : (
            <div className="flex-1 min-w-0 group cursor-default px-4">
              <div className="text-sm font-bold text-zinc-200 tracking-tight truncate">相图学习助手</div>
              <div className="text-[9px] text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300 truncate mt-0.5">Powered by 525地下室起义</div>
            </div>
          )}
        </div>

        {/* New session button — only in expanded */}
        {!collapsed && (
          <div className="px-3 mb-2">
            <button onClick={handleNewSession}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-blue-600/80 hover:bg-blue-600 text-xs font-medium text-white transition-colors duration-200 active:scale-[0.98]">
              <Plus size={15} />新建会话
            </button>
          </div>
        )}

        {/* Session list */}
        <div className="flex-1 overflow-y-auto px-2">
          <SessionList collapsed={collapsed} sessions={sessions} onSelect={async (id) => {
            if (activeSession?.id === id) return
            setActiveSession(await api.getSession(id))
          }} onDelete={async (id) => {
            await api.deleteSession(id)
            const { sessions: updated } = await api.listSessions()
            setSessions(updated)
            if (activeSession?.id === id) {
              if (updated.length > 0) setActiveSession(await api.getSession(updated[0].id))
              else { const s = await api.createSession(); setActiveSession(await api.getSession(s.id)) }
            }
          }} onRename={async (id, title) => {
            await api.updateSession(id, { title })
            const { sessions } = await api.listSessions()
            setSessions(sessions)
            if (activeSession?.id === id) setActiveSession({ ...activeSession, title })
          }} activeId={activeSession?.id} />
        </div>

        {/* Footer: Theme toggle */}
        <div className="border-t border-white/[0.04] mx-3">
          <div className="px-1 py-3">
            <button onClick={toggleTheme}
              className={`flex items-center gap-2.5 transition-all duration-300 rounded-xl
                ${collapsed ? 'w-full justify-center px-0 py-2' : 'w-full px-2.5 py-2'}`}
              style={{ color: theme === 'light' ? '#d97706' : 'var(--text-muted)' }}
              title={theme === 'dark' ? '切换浅色模式' : '切换暗色模式'}>
              <span className="shrink-0 transition-transform duration-500 ease-out group-hover:rotate-45">
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </span>
              {!collapsed && (
                <span className="text-xs font-medium">{theme === 'dark' ? '浅色模式' : '暗色模式'}</span>
              )}
            </button>
          </div>
        </div>


      </div>

      {/* Floating fold button — outside the island, fixed position */}
      <button onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-[26px] w-6 h-6 rounded-full border flex items-center justify-center transition-all duration-300 z-10"
        style={{
          background: collapsed ? 'var(--accent)' : 'var(--bg-glass-fold)',
          borderColor: collapsed ? 'var(--accent-glow)' : 'var(--border-medium)',
          boxShadow: collapsed ? '0 0 16px var(--accent-glow)' : '0 2px 8px rgba(0,0,0,0.4)',
        }}>
        {collapsed ? <ChevronRight size={11} className="text-white" /> : <ChevronLeft size={11} className="text-zinc-400" />}
      </button>
    </div>
  )
}
