import { useMemo } from 'react'
import { useChatStore } from '../store/chatStore'

// Pool of positive face emojis for the coach
const FACE_POOL = ['😊', '🤗', '😄', '✨', '🌟', '💫', '🎯', '💪', '🫶', '🙌', '🤩', '😎', '🧐', '🤓', '☺️', '😌', '💙', '🌱', '🎓', '💡']
const MOOD_POSITIVE = ['😊', '🤗', '😄', '☺️', '😌', '💙']

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ── Time-based emoji for welcome page ──
export function useWelcomeEmoji(): { emoji: string; greeting: string } {
  return useMemo(() => {
    const h = new Date().getHours()
    if (h >= 6 && h < 9) return { emoji: '🌅', greeting: '早上好！一日之计在于晨' }
    if (h >= 9 && h < 12) return { emoji: '☀️', greeting: '上午好！精力充沛适合学新概念' }
    if (h >= 12 && h < 14) return { emoji: '🌤️', greeting: '午后好！休息一下再战' }
    if (h >= 14 && h < 18) return { emoji: '📖', greeting: '下午好！专注时间' }
    if (h >= 18 && h < 22) return { emoji: '🌆', greeting: '晚上好！温故而知新' }
    if (h >= 22 || h < 2) return { emoji: '🌙', greeting: '夜深了，注意休息' }
    return { emoji: '✨', greeting: '凌晨了，灵感乍现的时刻' }
  }, [])
}

// ── Context-based emoji for chat avatar ──
export function useChatEmoji(): string {
  const messages = useChatStore((s) => s.activeSession?.messages) || []
  const isStreaming = useChatStore((s) => s.isStreaming)
  const streamingContent = useChatStore((s) => s.streamingContent)
  const toolCalls = useChatStore((s) => s.streamingToolCalls)

  return useMemo(() => {
    // Tool calls take priority
    if (toolCalls.length > 0) {
      const names = toolCalls.map(t => t.tool_name)
      if (names.some(n => n.includes('renderer') || n.includes('diagram'))) return '🎨'
      if (names.some(n => n.includes('lever') || n.includes('cooling') || n.includes('reaction'))) return '⚖️'
      return '🔢'
    }

    // During streaming = thinking face
    if (isStreaming && streamingContent.length > 0) return '🤔'

    // Last message keywords
    if (messages.length > 0) {
      const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
      const lastUser = [...messages].reverse().find(m => m.role === 'user')
      const userText = (lastUser?.content || '') + (lastAssistant?.content || '')

      if (/正确|答对|很好|很棒|没错|对的|理解.*正确|完全正确/i.test(lastAssistant?.content || '')) return '👏'
      if (/提示|试试|想想|再看|注意|也许|或者|能不能/i.test(lastAssistant?.content || '')) return '💡'
      if (/谢谢|感谢|多谢|谢了|thanks/i.test(userText)) return pickRandom(MOOD_POSITIVE)
      if (/你好|嗨|hello|hi/i.test(userText) && messages.length <= 2) return '👋'
      if (/相图|铁碳|共晶|共析|包晶|相律|杠杆|冷却曲线/i.test(userText)) return '📊'
      if (/计算|多少|比例|含量|成分|温度/i.test(userText)) return '⚖️'
      if (/复习|回顾|总结|梳理/i.test(userText)) return '📚'
      if (lastUser?.imageBase64) return '🔬'
    }

    // Default: random positive face from pool
    return pickRandom(FACE_POOL)
  }, [messages, isStreaming, streamingContent, toolCalls])
}

// ── V5 glow style ──
export function getAvatarGlow(emoji: string): string {
  if (['👏', '🎉', '🏆', '💪'].includes(emoji)) return 'shadow-[0_0_24px_rgba(34,197,94,0.2)] border-emerald-400/30'
  if (['💡', '🌟', '✨', '💫'].includes(emoji)) return 'shadow-[0_0_24px_rgba(245,158,11,0.25)] border-amber-400/30'
  if (['📊', '⚖️', '🔢'].includes(emoji)) return 'shadow-[0_0_24px_rgba(59,130,246,0.25)] border-blue-400/30'
  if (['🎨', '🔬', '🤔', '🧐'].includes(emoji)) return 'shadow-[0_0_24px_rgba(99,102,241,0.25)] border-indigo-400/30'
  if (['📖', '📚', '📝', '✏️', '🎓'].includes(emoji)) return 'shadow-[0_0_24px_rgba(139,92,246,0.2)] border-violet-400/25'
  if (FACE_POOL.some(f => emoji.includes(f) || f.includes(emoji))) return 'shadow-[0_0_24px_rgba(236,72,153,0.18)] border-pink-400/25'
  if (['👋', '🫶', '🙌', '💙'].includes(emoji)) return 'shadow-[0_0_24px_rgba(236,72,153,0.18)] border-pink-400/25'
  return 'shadow-[0_0_20px_rgba(245,158,11,0.15)] border-amber-400/20'
}
