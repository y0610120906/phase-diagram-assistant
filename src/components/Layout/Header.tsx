import { useChatStore } from '../../store/chatStore'

export default function Header({ children }: { children?: React.ReactNode }) {
  const activeSession = useChatStore((s) => s.activeSession)

  return (
    <div className="shrink-0 px-3 pt-3">
      <div className="flex items-center justify-between px-5 py-2.5 rounded-2xl min-h-[44px]"
        style={{
          background: 'var(--bg-glass-header)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4), 0 0 40px var(--accent-glow)',
        }}>
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[13px] font-semibold text-zinc-300 truncate">
            {activeSession?.title || '新会话'}
          </span>
          {activeSession && (
            <span className="text-[10px] text-zinc-600 bg-white/[0.03] px-1.5 py-0.5 rounded-md">
              {activeSession.messages.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {children}
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" title="已连接" />
        </div>
      </div>
    </div>
  )
}
