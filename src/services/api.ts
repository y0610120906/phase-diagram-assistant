import type { SessionSummary, Session, QuizQuestion, GradeResult } from '../types'

let _baseURL = 'http://127.0.0.1:8001'

export async function initBaseURL(): Promise<void> {
  try {
    const port = await (window as any).electronAPI?.getBackendPort?.()
    if (port) _baseURL = `http://127.0.0.1:${port}`
  } catch {
    // Use default
  }
}

function baseURL(): string {
  return _baseURL
}

async function request(path: string, options?: RequestInit) {
  const hasBody = options?.body != null
  const res = await fetch(`${baseURL()}${path}`, {
    ...options,
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(options?.headers || {}),
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

// --- Health ---
export async function checkHealth(): Promise<{ status: string; dashscope_configured: boolean }> {
  return request('/api/health')
}

// --- Sessions ---
export async function listSessions(): Promise<{ sessions: SessionSummary[] }> {
  return request('/api/sessions')
}

export async function createSession(title?: string): Promise<Session> {
  return request('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ title: title || '新会话' }),
  })
}

export async function getSession(id: string): Promise<Session> {
  return request(`/api/sessions/${id}`)
}

export async function updateSession(id: string, data: { title?: string; active_skill_id?: string | null }): Promise<Session> {
  return request(`/api/sessions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteSession(id: string): Promise<void> {
  await request(`/api/sessions/${id}`, { method: 'DELETE' })
}

export async function autoTitle(id: string): Promise<{ title: string }> {
  return request(`/api/sessions/${id}/auto-title`, { method: 'POST' })
}

// --- Student Profile ---
export async function getStudentProfile(): Promise<any> {
  return request('/api/student/profile')
}

export async function updateStudentConcept(concept: string, mastery: string, note?: string, sessionId?: string): Promise<any> {
  return request('/api/student/concept', {
    method: 'POST',
    body: JSON.stringify({ concept, mastery, note: note || '', session_id: sessionId || '' }),
  })
}

export async function getStudentTimeline(): Promise<any[]> {
  return request('/api/student/timeline')
}

export async function getStudentTrends(): Promise<any[]> {
  return request('/api/student/trends')
}

export async function resetStudentProfile(): Promise<any> {
  return request('/api/student/profile', { method: 'DELETE' })
}

export async function generateReceipt(sessionId: string): Promise<any> {
  return request(`/api/sessions/${sessionId}/receipt`, { method: 'POST' })
}

// --- Chat (SSE streaming) ---
export interface StreamCallbacks {
  onKb: (chunkIds: string[], titles: string[], snippets: string[]) => void
  onToolCall: (toolName: string, args: Record<string, unknown>) => void
  onToolResult: (toolName: string, result: Record<string, unknown>) => void
  onChunk: (content: string) => void
  onDiagram: (imageBase64: string, caption: string) => void
  onMessage: (msg: any) => void
  onDone: () => void
  onError: (message: string) => void
}

export async function streamChat(
  sessionId: string,
  message: string,
  includeKb: boolean,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${baseURL()}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      message,
      include_kb: includeKb,
    }),
    signal,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    callbacks.onError(err.detail || 'Request failed')
    return
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let currentEvent = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim()
      } else if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6))
          switch (currentEvent) {
            case 'kb':
              callbacks.onKb(data.chunk_ids || [], data.titles || [], data.snippets || [])
              break
            case 'tool_call':
              callbacks.onToolCall(data.tool_name, data.arguments || {})
              break
            case 'tool_result':
              callbacks.onToolResult(data.tool_name, data.result || {})
              break
            case 'chunk':
              callbacks.onChunk(data.content || '')
              break
            case 'diagram':
              callbacks.onDiagram(data.image_base64 || '', data.caption || '')
              break
            case 'msg':
              callbacks.onMessage(data)
              break
            case 'done':
              callbacks.onDone()
              break
            case 'error':
              callbacks.onError(data.message || 'Unknown error')
              break
          }
        } catch {
          // skip malformed JSON lines
        }
      }
    }
  }
}

// --- Image chat ---
export async function streamImageChat(
  sessionId: string,
  message: string,
  imageBase64: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${baseURL()}/api/chat/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      message,
      image: imageBase64,
      include_kb: false,
    }),
    signal,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    callbacks.onError(err.detail || 'Request failed')
    return
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let currentEvent = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim()
      } else if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6))
          switch (currentEvent) {
            case 'chunk':
              callbacks.onChunk(data.content || '')
              break
            case 'done':
              callbacks.onDone()
              break
            case 'error':
              callbacks.onError(data.message || 'Unknown error')
              break
          }
        } catch { /* skip */ }
      }
    }
  }
}

// --- Quiz ---
export async function generateQuiz(chapter: string, difficulty: string, count: number, questionType: string = 'mixed'): Promise<{ questions: QuizQuestion[] }> {
  return request('/api/quiz/generate', {
    method: 'POST',
    body: JSON.stringify({ chapter, difficulty, count, question_type: questionType }),
  })
}

export async function gradeQuiz(answers: { question_id: string; student_answer: string; question_text?: string; question_type?: string; correct_answer?: string; answer_explanation?: string; max_score?: number }[]): Promise<{ results: GradeResult[] }> {
  return request('/api/quiz/grade', {
    method: 'POST',
    body: JSON.stringify({ answers }),
  })
}

// --- Knowledge ---
export async function searchKnowledge(query: string, topK: number = 3): Promise<{ results: any[] }> {
  return request(`/api/knowledge/search?q=${encodeURIComponent(query)}&top_k=${topK}`)
}

export async function listDocuments(): Promise<{ documents: { name: string; title: string; chunk_count: number }[] }> {
  return request('/api/knowledge/documents')
}

export async function getDocumentChunks(docName: string): Promise<{ chunks: { chunk_id: string; content: string; page_number: number }[] }> {
  return request(`/api/knowledge/documents/${encodeURIComponent(docName)}/chunks`)
}

export async function deleteKnowledgeDocument(docName: string): Promise<any> {
  const res = await fetch(`${baseURL()}/api/knowledge/documents/${encodeURIComponent(docName)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Delete failed')
  return res.json()
}

export async function indexKnowledgeFolder(contentType: string = '参考资料'): Promise<any> {
  const form = new FormData()
  form.append('content_type', contentType)
  const res = await fetch(`${baseURL()}/api/knowledge/index-folder?content_type=${encodeURIComponent(contentType)}`, { method: 'POST' })
  if (!res.ok) throw new Error('Index failed')
  return res.json()
}

export async function uploadKnowledge(file: File, contentType: string = '参考资料'): Promise<{ success: boolean; chunks_created: number }> {
  const form = new FormData()
  form.append('file', file)
  form.append('content_type', contentType)
  const res = await fetch(`${baseURL()}/api/knowledge/upload`, { method: 'POST', body: form })
  if (!res.ok) throw new Error('Upload failed')
  return res.json()
}
