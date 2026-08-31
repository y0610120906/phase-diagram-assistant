import { create } from 'zustand'
import type { SessionSummary, Session, Message, KbRef, ToolCall } from '../types'

interface ChatState {
  sessions: SessionSummary[]
  activeSession: Session | null
  isStreaming: boolean
  streamingContent: string
  streamingKbRefs: KbRef[]
  streamingToolCalls: ToolCall[]
  streamingDiagramBase64: string | null
  isQuizMode: boolean

  setSessions: (sessions: SessionSummary[]) => void
  setActiveSession: (session: Session | null) => void
  setIsStreaming: (val: boolean) => void
  appendStreamingContent: (text: string) => void
  setStreamingKbRefs: (refs: KbRef[]) => void
  addToolCall: (tc: ToolCall) => void
  setStreamingDiagram: (b64: string | null) => void
  resetStreaming: () => void
  addMessage: (msg: Message) => void
  setQuizMode: (val: boolean) => void
  pendingSend: string | null
  pendingImage: string | null
  setPendingSend: (text: string | null, image?: string | null) => void
}

export const useChatStore = create<ChatState>((set) => ({
  sessions: [],
  activeSession: null,
  isStreaming: false,
  streamingContent: '',
  streamingKbRefs: [],
  streamingToolCalls: [],
  streamingDiagramBase64: null,
  isQuizMode: false,

  setSessions: (sessions) => set({ sessions }),
  setActiveSession: (session) => set({
    activeSession: session,
  }),
  setIsStreaming: (val) => set({ isStreaming: val }),
  appendStreamingContent: (text) => set((s) => ({
    streamingContent: s.streamingContent + text,
  })),
  setStreamingKbRefs: (refs) => set({ streamingKbRefs: refs }),
  addToolCall: (tc) => set((s) => {
    const idx = s.streamingToolCalls.findIndex(t => t.tool_name === tc.tool_name)
    if (idx >= 0) {
      const updated = [...s.streamingToolCalls]
      updated[idx] = { ...tc }
      return { streamingToolCalls: updated }
    }
    return { streamingToolCalls: [...s.streamingToolCalls, tc] }
  }),
  setStreamingDiagram: (b64) => set({ streamingDiagramBase64: b64 }),
  resetStreaming: () => set({
    isStreaming: false,
    streamingContent: '',
    streamingKbRefs: [],
    streamingToolCalls: [],
    streamingDiagramBase64: null,
  }),
  addMessage: (msg) => set((s) => {
    if (!s.activeSession) return s
    return {
      activeSession: {
        ...s.activeSession,
        messages: [...s.activeSession.messages, msg],
      },
    }
  }),
  setQuizMode: (val) => set({ isQuizMode: val }),
  pendingSend: null,
  pendingImage: null,
  setPendingSend: (text, image = null) => set({ pendingSend: text, pendingImage: image }),
}))
