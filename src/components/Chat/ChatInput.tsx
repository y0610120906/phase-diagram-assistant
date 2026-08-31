import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { Send, Square, X } from 'lucide-react'
import { useChatStore } from '../../store/chatStore'
import * as api from '../../services/api'

const INPUT_FACES = ['😊', '🤗', '😄', '✨', '💫', '🎯', '🧐', '🤓', '☺️', '😌', '💙', '🌱', '🎓', '🙌', '🫶']

export default function ChatInput() {
  const [input, setInput] = useState('')
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const coachEmoji = useMemo(() => INPUT_FACES[Math.floor(Math.random() * INPUT_FACES.length)], [])

  const isStreaming = useChatStore((s) => s.isStreaming)
  const activeSession = useChatStore((s) => s.activeSession)
  const sessionTitle = useChatStore((s) => s.activeSession?.title)
  const addMessage = useChatStore((s) => s.addMessage)
  const setIsStreaming = useChatStore((s) => s.setIsStreaming)
  const appendStreamingContent = useChatStore((s) => s.appendStreamingContent)
  const setStreamingKbRefs = useChatStore((s) => s.setStreamingKbRefs)
  const addToolCall = useChatStore((s) => s.addToolCall)
  const setStreamingDiagram = useChatStore((s) => s.setStreamingDiagram)
  const resetStreaming = useChatStore((s) => s.resetStreaming)
  const setSessions = useChatStore((s) => s.setSessions)
  const pendingSend = useChatStore((s) => s.pendingSend)
  const pendingImage = useChatStore((s) => s.pendingImage)
  const setPendingSend = useChatStore((s) => s.setPendingSend)
  const messages = useChatStore((s) => s.activeSession?.messages) || []
  // Auto-send from welcome page — direct, no ref needed
  useEffect(() => {
    if (!pendingSend || !activeSession) return
    const text = pendingSend
    const img = pendingImage
    setPendingSend(null)
    setInput(text)
    requestAnimationFrame(() => {
      if (!text.trim()) { setInput(''); return }
      setInput('')
      abortRef.current = new AbortController()
      addMessage({ id: crypto.randomUUID(), role: 'user', content: text, imageBase64: img || undefined, kbReferences: [], toolCalls: [], timestamp: new Date().toISOString() })
      setIsStreaming(true)
      if (img) {
        api.streamImageChat(activeSession.id, text, img, {
          onChunk: appendStreamingContent,
          onKb: () => {},
          onToolCall: (name: any, args: any) => addToolCall({ tool_name: name, arguments: args }),
          onToolResult: () => {},
          onDiagram: (b64: any) => setStreamingDiagram(b64),
          onMessage: (msg: any) => { addMessage({ id: msg.id, role: 'assistant', content: msg.content, diagramBase64: msg.diagram_base64 || undefined, kbReferences: msg.kb_references || [], toolCalls: msg.tool_calls || [], timestamp: msg.timestamp }) },
          onDone: () => { const s = useChatStore.getState(); if (s.streamingContent) { addMessage({ id: crypto.randomUUID(), role: 'assistant', content: s.streamingContent, kbReferences: [], toolCalls: [], diagramBase64: s.streamingDiagramBase64 || undefined, timestamp: new Date().toISOString() }) }; resetStreaming() },
          onError: (msg: any) => { addMessage({ id: crypto.randomUUID(), role: 'assistant', content: `错误: ${msg}`, kbReferences: [], toolCalls: [], timestamp: new Date().toISOString() }); resetStreaming() },
        }, abortRef.current!.signal).catch(() => {})
      } else {
        api.streamChat(activeSession.id, text, true, {
          onChunk: appendStreamingContent,
          onKb: (ids: any, titles: any, snippets: any) => setStreamingKbRefs(ids.map((id: any, i: number) => ({ chunk_id: id, title: titles[i] || '', snippet: snippets[i] || '' }))),
          onToolCall: (name: any, args: any) => addToolCall({ tool_name: name, arguments: args }),
          onToolResult: (name: any, result: any) => { const tc = useChatStore.getState().streamingToolCalls.find((t: any) => t.tool_name === name && !t.result); if (tc) tc.result = result },
          onDiagram: (b64: any) => setStreamingDiagram(b64),
          onMessage: (msg: any) => { addMessage({ id: msg.id, role: 'assistant', content: msg.content, diagramBase64: msg.diagram_base64 || undefined, kbReferences: msg.kb_references || [], toolCalls: msg.tool_calls || [], timestamp: msg.timestamp }) },
          onDone: () => { resetStreaming() },
          onError: (msg: any) => { addMessage({ id: crypto.randomUUID(), role: 'assistant', content: `错误: ${msg}`, kbReferences: [], toolCalls: [], timestamp: new Date().toISOString() }); resetStreaming() },
        }, abortRef.current!.signal).catch(() => {})
      }
    })
  }, [pendingSend, pendingImage, activeSession])

  const showInput = messages.length > 0 || isStreaming

  async function autoTitle() {
    if (activeSession && sessionTitle === '新会话') {
      try {
        const { title } = await api.autoTitle(activeSession.id)
        if (title) {
          const { sessions } = await api.listSessions()
          setSessions(sessions)
        }
      } catch {
        // keep default title if auto-title fails
      }
    }
  }

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming || !activeSession) return
    setInput('')
    abortRef.current = new AbortController()
    // Auto-focus back after send
    setTimeout(() => textareaRef.current?.focus(), 50)

    addMessage({ id: crypto.randomUUID(), role: 'user', content: text, imageBase64: imageBase64 || undefined, kbReferences: [], toolCalls: [], timestamp: new Date().toISOString() })
    setIsStreaming(true)

    try {
      if (imageBase64) {
        await api.streamImageChat(activeSession.id, text, imageBase64, {
          onChunk: appendStreamingContent,
          onKb: (ids, titles, snippets) => setStreamingKbRefs(ids.map((id, i) => ({ chunk_id: id, title: titles[i] || '', snippet: snippets[i] || '' }))),
          onToolCall: (name, args) => addToolCall({ tool_name: name, arguments: args }),
          onToolResult: () => {},
          onDiagram: (b64) => setStreamingDiagram(b64),
          onMessage: (msg) => { addMessage({ id: msg.id, role: 'assistant', content: msg.content, diagramBase64: msg.diagram_base64 || undefined, kbReferences: msg.kb_references || [], toolCalls: msg.tool_calls || [], timestamp: msg.timestamp }); setStreamingDiagram(null); useChatStore.setState({ streamingToolCalls: [], streamingContent: '' }) },
          onDone: () => { const s = useChatStore.getState(); if (s.streamingContent) { addMessage({ id: crypto.randomUUID(), role: 'assistant', content: s.streamingContent, kbReferences: [], toolCalls: [], diagramBase64: s.streamingDiagramBase64 || undefined, timestamp: new Date().toISOString() }) }; autoTitle(); resetStreaming() },
          onError: (msg) => { addMessage({ id: crypto.randomUUID(), role: 'assistant', content: `错误: ${msg}`, kbReferences: [], toolCalls: [], timestamp: new Date().toISOString() }); resetStreaming() },
        }, abortRef.current.signal)
      } else {
        await api.streamChat(activeSession.id, text, true, {
          onChunk: appendStreamingContent,
          onKb: (ids, titles, snippets) => setStreamingKbRefs(ids.map((id, i) => ({ chunk_id: id, title: titles[i] || '', snippet: snippets[i] || '' }))),
          onToolCall: (name, args) => addToolCall({ tool_name: name, arguments: args }),
          onToolResult: (name, result) => { const tc = useChatStore.getState().streamingToolCalls.find(t => t.tool_name === name && !t.result); if (tc) tc.result = result },
          onDiagram: (b64) => setStreamingDiagram(b64),
          onMessage: (msg) => { addMessage({ id: msg.id, role: 'assistant', content: msg.content, diagramBase64: msg.diagram_base64 || undefined, kbReferences: msg.kb_references || [], toolCalls: msg.tool_calls || [], timestamp: msg.timestamp }); setStreamingDiagram(null); useChatStore.setState({ streamingToolCalls: [], streamingContent: '' }) },
          onDone: () => { autoTitle(); api.listSessions().then(({ sessions }) => setSessions(sessions)); resetStreaming() },
          onError: (msg) => { addMessage({ id: crypto.randomUUID(), role: 'assistant', content: `错误: ${msg}`, kbReferences: [], toolCalls: [], timestamp: new Date().toISOString() }); resetStreaming() },
        }, abortRef.current.signal)
      }
      setImageBase64(null)
    } catch (err: any) {
      if (err.name !== 'AbortError') { addMessage({ id: crypto.randomUUID(), role: 'assistant', content: `网络错误: ${err.message}`, kbReferences: [], toolCalls: [], timestamp: new Date().toISOString() }) }
      resetStreaming()
    }
  }, [input, isStreaming, activeSession, null, imageBase64])

  const onDrop = useCallback((accepted: File[]) => {
    const file = accepted[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { alert('文件不能超过 10MB'); return }
    const reader = new FileReader()
    reader.onload = () => { const b64 = (reader.result as string).split(',')[1]; setImageBase64(b64) }
    reader.readAsDataURL(file)
  }, [])

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop, accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'] }, maxFiles: 1, noClick: true, noKeyboard: true,
  })

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }

  return (
    <div className={`px-4 pb-4 ${showInput ? '' : 'hidden'}`}>
      <div className="max-w-4xl mx-auto relative" {...getRootProps()}>
        <input {...getInputProps()} />
        {isDragActive && (
          <div className="absolute inset-0 bg-blue-500/10 border-2 border-blue-400/40 border-dashed rounded-3xl flex items-center justify-center z-10 pointer-events-none">
            <p className="text-blue-400 text-sm font-medium">释放以添加相图</p>
          </div>
        )}

        {/* V2: Frosted glass bar */}
        <div className="glow-input relative rounded-3xl px-4 py-3 flex items-center gap-3 border border-white/[0.08] transition-all duration-300"
          style={{
            background: 'var(--bg-glass-input)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            boxShadow: focused
              ? '0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 var(--bg-hover), 0 0 50px var(--accent-glow), 0 0 100px var(--accent-glow)'
              : '0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 var(--bg-hover), 0 0 20px var(--accent-glow)',
          }}>

          {/* Upload / coach emoji */}
          {imageBase64 ? (
            <div className="relative shrink-0">
              <img src={`data:image/png;base64,${imageBase64}`} alt="" className="h-10 w-10 rounded-xl object-cover" />
              <button onClick={() => setImageBase64(null)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"><X size={10} /></button>
            </div>
          ) : (
            <button onClick={open} title="上传图片或文档"
              className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-lg shrink-0 hover:bg-white/[0.08] hover:border-white/[0.12] transition-all duration-200">
              {coachEmoji}
            </button>
          )}

          {/* Text input */}
          <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            placeholder={imageBase64 ? '描述这张图片...' : '向相图教练提问...'}
            rows={1}
            className="flex-1 bg-transparent text-[15px] text-zinc-200 placeholder-zinc-500 resize-none outline-none py-1.5 leading-relaxed"
            style={{ maxHeight: '120px' }}
            onInput={e => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px' }} />

          {/* Send / Stop button */}
          <button onClick={isStreaming ? () => abortRef.current?.abort() : handleSend}
            disabled={!isStreaming && !input.trim()}
            className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
              isStreaming
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/20'
                : input.trim()
                  ? 'bg-blue-500 text-white hover:bg-blue-400 active:scale-95 shadow-[0_4px_16px_rgba(59,130,246,0.35)]'
                  : 'bg-white/[0.04] text-zinc-600 cursor-not-allowed border border-white/[0.04]'
            }`}>
            {isStreaming ? <Square size={15} /> : <Send size={15} />}
          </button>
        </div>
      </div>
    </div>
  )
}
