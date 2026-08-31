import { useState } from 'react'
import { ClipboardList, Library, GraduationCap, ArrowLeft, Receipt } from 'lucide-react'
import Sidebar from './Sidebar'
import Header from './Header'
import ChatWindow from '../Chat/ChatWindow'
import ChatInput from '../Chat/ChatInput'
import QuizPanel from '../Quiz/QuizPanel'
import KnowledgePanel from '../KnowledgeBase/KnowledgePanel'
import StudentProfile from '../Student/StudentProfile'
import ReceiptModal from '../Student/ReceiptModal'
import { useSettingsStore } from '../../store/settingsStore'
import { useChatStore } from '../../store/chatStore'

type View = 'chat' | 'quiz' | 'knowledge' | 'profile'

export default function MainLayout() {
  const connected = useSettingsStore((s) => s.backendConnected)
  const [view, setView] = useState<View>('chat')
  const [showReceipt, setShowReceipt] = useState(false)
  const activeSessionId = useChatStore((s) => s.activeSession?.id)

  if (!connected) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: 'var(--bg-body)' }}>
        <div className="text-center page-enter">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
            <div className="w-4 h-4 rounded-full bg-blue-400 animate-pulse" />
          </div>
          <p className="text-base font-medium text-zinc-300">正在连接</p>
          <p className="text-sm text-zinc-500 mt-1">请确保后端已启动</p>
        </div>
      </div>
    )
  }

  const isChat = view === 'chat'

  return (
    <div className="h-screen flex" style={{ background: 'var(--bg-body)' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 relative">
        {isChat && (
          <Header>
            <button onClick={() => setView('quiz')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-all duration-200">
              <ClipboardList size={14} /> 出题自测
            </button>
            <button onClick={() => setView('knowledge')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-all duration-200">
              <Library size={14} /> 知识库
            </button>
            <button onClick={() => setView('profile')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-all duration-200">
              <GraduationCap size={14} /> 学习档案
            </button>
            <button onClick={() => setShowReceipt(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-all duration-200">
              <Receipt size={14} /> 学习总结
            </button>
          </Header>
        )}
        {view === 'chat' && (
          <div className="flex-1 flex flex-col min-h-0 page-enter">
            <ChatWindow />
            <ChatInput />
          </div>
        )}
        {view === 'quiz' && (
          <div className="flex-1 flex flex-col min-h-0 page-enter">
            <div className="shrink-0 px-3 pt-3">
              <div className="flex items-center justify-between px-5 py-2.5 rounded-2xl min-h-[44px]"
                style={{background:'var(--bg-glass-header)',backdropFilter:'blur(30px)',WebkitBackdropFilter:'blur(30px)',border:'1px solid var(--border-subtle)',boxShadow:'0 4px 24px rgba(0,0,0,0.4), 0 0 40px var(--accent-glow)'}}>
                <button onClick={() => setView('chat')} className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors">
                  <ArrowLeft size={16} /> <span className="text-sm">返回</span>
                </button>
                <span className="text-sm font-semibold text-zinc-300">出题自测</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto max-w-2xl mx-auto w-full px-6 py-6">
              <QuizPanel />
            </div>
          </div>
        )}
        {view === 'knowledge' && (
          <div className="flex-1 flex flex-col min-h-0 page-enter">
            <div className="shrink-0 px-3 pt-3">
              <div className="flex items-center justify-between px-5 py-2.5 rounded-2xl min-h-[44px]"
                style={{background:'var(--bg-glass-header)',backdropFilter:'blur(30px)',WebkitBackdropFilter:'blur(30px)',border:'1px solid var(--border-subtle)',boxShadow:'0 4px 24px rgba(0,0,0,0.4), 0 0 40px var(--accent-glow)'}}>
                <button onClick={() => setView('chat')} className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors">
                  <ArrowLeft size={16} /> <span className="text-sm">返回</span>
                </button>
                <span className="text-sm font-semibold text-zinc-300">知识库</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto max-w-2xl mx-auto w-full px-6 py-6">
              <KnowledgePanel />
            </div>
          </div>
        )}
        {view === 'profile' && (
          <div className="flex-1 flex flex-col min-h-0 page-enter">
            <div className="shrink-0 px-3 pt-3">
              <div className="flex items-center justify-between px-5 py-2.5 rounded-2xl min-h-[44px]"
                style={{background:'var(--bg-glass-header)',backdropFilter:'blur(30px)',WebkitBackdropFilter:'blur(30px)',border:'1px solid var(--border-subtle)',boxShadow:'0 4px 24px rgba(0,0,0,0.4), 0 0 40px var(--accent-glow)'}}>
                <button onClick={() => setView('chat')} className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors">
                  <ArrowLeft size={16} /> <span className="text-sm">返回</span>
                </button>
                <span className="text-sm font-semibold text-zinc-300">学习档案</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <StudentProfile />
            </div>
          </div>
        )}
      </div>
      {activeSessionId && (
        <ReceiptModal sessionId={activeSessionId} open={showReceipt} onClose={() => setShowReceipt(false)} />
      )}
    </div>
  )
}
