export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  imageBase64?: string
  kbReferences: KbRef[]
  toolCalls: ToolCall[]
  diagramBase64?: string
  timestamp: string
}

export interface KbRef {
  chunk_id: string
  title: string
  snippet: string
}

export interface ToolCall {
  tool_name: string
  arguments: Record<string, unknown>
  result?: Record<string, unknown>
}

export interface Session {
  id: string
  title: string
  created_at: string
  updated_at: string
  messages: Message[]
}

export interface SessionSummary {
  id: string
  title: string
  created_at: string
  updated_at: string
  message_count: number
}

export interface QuizQuestion {
  id: string
  question: string
  question_type: string
  options: string[]
  correct_answer: string
  answer_explanation: string
  chapter: string
  difficulty: string
  max_score: number
}

export interface GradeResult {
  question_id: string
  question_type: string
  score: number
  max_score: number
  correct_answer: string
  errors: string[]
  correct_points: string[]
  standard_answer: string
  explanation: string
}

export interface SSEEvent {
  type: 'chunk' | 'kb' | 'tool_call' | 'tool_result' | 'diagram' | 'done' | 'error'
  data: Record<string, unknown>
}
