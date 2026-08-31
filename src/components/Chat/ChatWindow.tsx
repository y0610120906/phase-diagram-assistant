import { useEffect, useRef, useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Image, X } from 'lucide-react'
import { useChatStore } from '../../store/chatStore'
import { useWelcomeEmoji } from '../../hooks/useAvatar'
import ChatMessage from './ChatMessage'
import StreamingText from './StreamingText'

export default function ChatWindow() {
  const activeSession = useChatStore((s) => s.activeSession)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const streamingContent = useChatStore((s) => s.streamingContent)
  const streamingDiagram = useChatStore((s) => s.streamingDiagramBase64)
  const streamingToolCalls = useChatStore((s) => s.streamingToolCalls)
  const bottomRef = useRef<HTMLDivElement>(null)
  const welcomeEmoji = useWelcomeEmoji()
  const setPendingSend = useChatStore((s) => s.setPendingSend)
  const [welcomeInput, setWelcomeInput] = useState('')
  const [welcomeImage, setWelcomeImage] = useState<string | null>(null)
  const [welcomeFocused, setWelcomeFocused] = useState(false)
  const [typewriterText, setTypewriterText] = useState('')
  const [exiting, setExiting] = useState(false)

  const messages = activeSession?.messages || []
  const hasMessages = messages.length > 0 || isStreaming

  // Typewriter for welcome title — fires whenever session changes and is empty
  useEffect(() => {
    if (hasMessages) return
    setTypewriterText('')
    const h = new Date().getHours()
    const text = h >= 5 && h < 12 ? '一日之计\n在于晨。' : h >= 12 && h < 18 ? '午后时光\n专注力最佳。' : '夜深人静\n正是思考时。'
    let i = 0
    const timer = setInterval(() => {
      i++
      setTypewriterText(text.slice(0, i))
      if (i >= text.length) clearInterval(timer)
    }, 40)
    return () => clearInterval(timer)
  }, [activeSession?.id, hasMessages])

  // Exit animation on first message, reset on new empty session
  useEffect(() => {
    if (!hasMessages) {
      setExiting(false)
    } else if (!exiting) {
      setExiting(true)
    }
  }, [hasMessages, activeSession?.id])

  const onDrop = useCallback((accepted: File[]) => {
    const file = accepted[0]; if (!file) return
    if (file.size > 10 * 1024 * 1024) { alert('文件不能超过 10MB'); return }
    const reader = new FileReader()
    reader.onload = () => setWelcomeImage((reader.result as string).split(',')[1])
    reader.readAsDataURL(file)
  }, [])
  const { getRootProps: getDropProps, getInputProps: getDropInput, open: openDrop } = useDropzone({ onDrop, accept: { 'image/*': ['.png','.jpg','.jpeg','.gif','.webp'] }, maxFiles: 1, noClick: true, noKeyboard: true })

  function handleWelcomeSend() {
    const text = welcomeInput.trim()
    if (!text) return
    setPendingSend(text, welcomeImage)
    setWelcomeInput('')
    setWelcomeImage(null)
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' as any })
  }, [activeSession?.id])

  return (
    <div className="flex-1 overflow-y-auto">
      {!hasMessages ? (
        /* Empty state — centered V9 typewriter welcome */
        <div className={`flex items-center justify-center h-full px-10 ${exiting ? 'welcome-exit' : ''}`}>
          <div className="w-full max-w-4xl welcome-enter">
            <div className="flex items-center gap-5 mb-10">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-b from-blue-500/20 to-blue-500/[0.02] flex items-center justify-center text-3xl shadow-[0_0_60px_rgba(59,130,246,0.1),0_0_0_1px_rgba(59,130,246,0.06)]">
                {welcomeEmoji.emoji}
              </div>
              <div>
                <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
                  {new Date().getHours() >= 5 && new Date().getHours() < 12 ? 'Good Morning' : new Date().getHours() >= 12 && new Date().getHours() < 18 ? 'Good Afternoon' : 'Good Evening'}
                </div>
                <div className="text-base font-semibold text-zinc-300 mt-0.5">{welcomeEmoji.greeting}</div>
              </div>
            </div>
            <div className="text-4xl font-bold tracking-[-0.04em] leading-[1.15] text-zinc-100 mb-10 min-h-[100px] whitespace-pre-line">
              {typewriterText}
              {typewriterText.length < 7 && (
                <span className="inline-block w-[3px] h-9 bg-zinc-400 ml-0.5 animate-pulse align-middle" />
              )}
            </div>
            <div {...getDropProps()} className="relative w-full">
              <input {...getDropInput()} />
              <div className="glass-strong rounded-2xl px-4 py-3 flex items-center gap-3 transition-shadow duration-500"
                style={{ boxShadow: welcomeFocused
                  ? '0 16px 48px rgba(0,0,0,0.5), 0 0 50px var(--accent-glow), 0 0 100px var(--accent-glow)'
                  : '0 16px 48px rgba(0,0,0,0.5), 0 0 20px var(--accent-glow)' }}>
                {welcomeImage ? (
                  <div className="relative shrink-0">
                    <img src={`data:image/png;base64,${welcomeImage}`} alt="" className="h-10 w-10 rounded-xl object-cover" />
                    <button onClick={() => setWelcomeImage(null)} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center"><X size={10} /></button>
                  </div>
                ) : (
                  <button onClick={openDrop} className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-lg shrink-0 hover:bg-white/[0.08] transition-all">
                    <Image size={18} className="text-zinc-500" />
                  </button>
                )}
                <input value={welcomeInput} onChange={(e) => setWelcomeInput(e.target.value)}
                  onFocus={() => setWelcomeFocused(true)} onBlur={() => setWelcomeFocused(false)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleWelcomeSend() }}
                  placeholder={welcomeImage ? '描述这张图片...' : '问任何相图问题...'}
                  className="flex-1 bg-transparent text-[15px] text-zinc-200 placeholder-zinc-500 outline-none" />
                <button onClick={handleWelcomeSend}
                  disabled={!welcomeInput.trim()}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all active:scale-95 ${
                    welcomeInput.trim() ? 'bg-blue-500 hover:bg-blue-400 text-white' : 'bg-white/[0.04] text-zinc-600 cursor-not-allowed'}`}>
                  ↑
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Messages */
        <div className="max-w-4xl mx-auto w-full px-6 py-6 page-enter">
          {messages.map((msg, i) => (
            <div key={msg.id} className={i === messages.length - 1 && msg.role === 'assistant' ? 'msg-in' : ''}>
              <ChatMessage message={msg} />
            </div>
          ))}
          {isStreaming && <StreamingText content={streamingContent} diagramBase64={streamingDiagram} toolCalls={streamingToolCalls} />}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  )
}
