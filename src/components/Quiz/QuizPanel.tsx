import { useState, useRef } from 'react'
import { ChevronRight, ChevronLeft, ArrowRight, Minus, Plus } from 'lucide-react'
import * as api from '../../services/api'
import type { QuizQuestion, GradeResult } from '../../types'
import QuizResult from './QuizResult'
import Dropdown from './Dropdown'

const selectClass = "w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-[15px] text-zinc-200 focus:outline-none focus:border-blue-400/40 focus:ring-1 focus:ring-blue-400/15 transition-all duration-200"
const segClass = (active: boolean) => `flex-1 py-2.5 rounded-xl text-xs font-medium cursor-pointer transition-all duration-200 ${active ? 'bg-blue-500/25 text-blue-300' : 'bg-transparent text-zinc-500 hover:text-zinc-300'}`

function Stepper({ step }: { step: number }) {
  const dot = (n: number, active: boolean) => (
    <div key={n} className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
      active ? 'bg-blue-500/30 text-blue-300' :
      'border-2 border-white/[0.06] text-zinc-600'}`}>{n}</div>
  )
  return (
    <div className="flex flex-col items-center">
      {dot(1, step === 1)}
      <div className="w-0.5 h-8 bg-white/[0.04] my-1" />
      {dot(2, step === 2)}
      <div className="w-0.5 h-8 bg-white/[0.04] my-1" />
      {dot(3, step === 3)}
    </div>
  )
}

export default function QuizPanel() {
  const [chapter, setChapter] = useState('铁碳相图')
  const [difficulty, setDifficulty] = useState('medium')
  const [count, setCount] = useState(3)
  const [questionType, setQuestionType] = useState('mixed')
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [results, setResults] = useState<GradeResult[]>([])
  const [loading, setLoading] = useState(false)
  const [grading, setGrading] = useState(false)
  const [currentQ, setCurrentQ] = useState(0)
  const [toasts, setToasts] = useState<{ id: number; text: string; x: number; y: number }[]>([])
  const toastId = useRef(0)

  function changeCount(delta: number, e: React.MouseEvent) {
    const next = count + delta
    if (next > 10) { const id = ++toastId.current; setToasts(prev => [...prev, { id, text: '做题太多了，休息一下吧', x: e.clientX, y: e.clientY }]); setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 1600); return }
    if (next < 1)  { const id = ++toastId.current; setToasts(prev => [...prev, { id, text: '至少做一道题吧', x: e.clientX, y: e.clientY }]); setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 1600); return }
    setCount(next)
  }

  async function handleGenerate() {
    setLoading(true)
    try { const res = await api.generateQuiz(chapter, difficulty, count, questionType); setQuestions(res.questions); setAnswers({}); setResults([]); setCurrentQ(0) }
    catch (e: any) { alert(`出题失败: ${e.message}`) }
    setLoading(false)
  }

  async function handleGrade() {
    setGrading(true)
    try { const res = await api.gradeQuiz(questions.map(q => ({ question_id: q.id, student_answer: answers[q.id] || '', question_text: q.question, question_type: q.question_type, correct_answer: q.correct_answer, answer_explanation: q.answer_explanation, max_score: q.max_score }))); setResults(res.results) }
    catch (e: any) { alert(`批改失败: ${e.message}`) }
    setGrading(false)
  }

  const step = results.length > 0 ? 3 : questions.length > 0 ? 2 : 1
  const isLast = currentQ === questions.length - 1
  const q = questions[currentQ]

  return (
    <div className="page-enter relative max-w-2xl mx-auto pl-14">
      {/* Stepper — absolute left, doesn't affect content centering */}
      <div className="absolute left-0 top-0">
        <Stepper step={step} />
      </div>

      {step === 3 ? (
        <QuizResult results={results} onClose={() => { setQuestions([]); setResults([]) }} onRetry={() => { setResults([]); setAnswers({}) }} />
      ) : step === 2 ? (
        /* ── Answering phase ── */
        <div>
          <div className="flex items-center justify-between mb-8">
            <button onClick={() => setQuestions([])} className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">返回选题</button>
            <span className="text-xs text-zinc-600">{currentQ + 1} / {questions.length}</span>
          </div>
          <div className="flex gap-1.5 mb-8">
            {questions.map((_, i) => (<div key={i} className={`flex-1 h-1 rounded-full transition-all duration-300 ${i <= currentQ ? 'bg-blue-500' : 'bg-white/[0.06]'}`} />))}
          </div>
          <div className="mb-8">
            <div className="text-[13px] text-zinc-500 uppercase tracking-wider mb-3">第 {currentQ + 1} 题</div>
            <div className="text-[15px] font-medium text-zinc-200 leading-relaxed">{q.question}</div>
          </div>
          {q.question_type === 'choice' && q.options?.length > 0 ? (
            <div className="mb-6 space-y-2">
              {q.options.map((opt, i) => (
                <button key={i} onClick={() => setAnswers({ ...answers, [q.id]: String.fromCharCode(65 + i) })}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm border transition-all duration-200 ${
                    answers[q.id] === String.fromCharCode(65 + i)
                      ? 'bg-blue-500/15 border-blue-400/40 text-blue-400'
                      : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:bg-white/[0.04]'
                  }`}>
                  <span className="font-bold mr-2">{String.fromCharCode(65 + i)}.</span> {opt.replace(/^[A-D][.、]\s*/, '')}
                </button>
              ))}
            </div>
          ) : q.question_type === 'true_false' ? (
            <div className="mb-6 flex gap-3">
              {['对', '错'].map(opt => (
                <button key={opt} onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-all duration-200 ${
                    answers[q.id] === opt
                      ? opt === '对' ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-400'
                      : 'bg-red-500/20 border-red-400/40 text-red-400'
                      : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:bg-white/[0.04]'
                  }`}>
                  {opt === '对' ? '✅ 正确' : '❌ 错误'}
                </button>
              ))}
            </div>
          ) : (
            <textarea value={answers[q.id] || ''} onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
              placeholder={q.question_type === 'fill_blank' ? '输入填空答案...' : '输入你的答案...'} rows={5} className={`${selectClass} resize-none mb-6`} />
          )}
          <div className="flex items-center justify-between">
            <button onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} disabled={currentQ === 0}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/[0.06] text-sm text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200">
              <ChevronLeft size={15} /> 上一题</button>
            {isLast ? (
              <button onClick={handleGrade} disabled={grading}
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 disabled:opacity-40 text-white text-sm font-medium transition-all duration-200 active:scale-[0.99] shadow-[0_4px_20px_rgba(34,197,94,0.2)]">
                {grading ? '批改中...' : <>{'提交批改'}<ArrowRight size={15} /></>}</button>
            ) : (
              <button onClick={() => setCurrentQ(Math.min(questions.length - 1, currentQ + 1))}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600/80 hover:bg-blue-600 text-white text-sm font-medium transition-all duration-200 active:scale-[0.99] shadow-[0_4px_16px_rgba(59,130,246,0.25)]">
                下一题 <ChevronRight size={15} /></button>
            )}
          </div>
        </div>
      ) : (
        /* ── Config phase ── */
        <div>
          <h2 className="text-xl font-semibold text-zinc-200 mb-1">出题自测</h2>
          <p className="text-[13px] text-zinc-500 mb-8">选择章节与难度，生成对应题目</p>
          <div className="mb-6"><Dropdown label="章节" value={chapter} options={['铁碳相图','相律基础','二元相图','三元相图']} onChange={setChapter} /></div>
          <div className="mb-6"><Dropdown label="题型" value={questionType === 'mixed' ? '混合题型' : questionType === 'choice' ? '选择题' : questionType === 'short_answer' ? '简答题' : questionType === 'fill_blank' ? '填空题' : '判断题'} options={['混合题型','选择题','简答题','填空题','判断题']} onChange={(v) => { const map: Record<string,string> = {'混合题型':'mixed','选择题':'choice','简答题':'short_answer','填空题':'fill_blank','判断题':'true_false'}; setQuestionType(map[v]||'mixed') }} /></div>
          <div className="mb-6">
            <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2.5">难度</div>
            <div className="flex bg-white/[0.02] rounded-xl p-1 border border-white/[0.05]">
              {(['basic','medium','advanced'] as const).map(d => (
                <button key={d} onClick={() => setDifficulty(d)} className={segClass(difficulty === d)}>
                  {d === 'basic' ? '基础' : d === 'medium' ? '中等' : '高级'}</button>))}
            </div>
          </div>
          <div className="mb-8">
            <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2.5">题数</div>
            <div className="inline-flex items-center gap-0.5 bg-white/[0.02] rounded-2xl p-1 border border-white/[0.05]">
              <button onClick={(e) => changeCount(-1, e)}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-all duration-150 active:scale-95">
                <Minus size={16} /></button>
              <span className="w-12 text-center text-base font-semibold text-zinc-200 select-none">{count}</span>
              <button onClick={(e) => changeCount(1, e)}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-all duration-150 active:scale-95">
                <Plus size={16} /></button>
            </div>
            {toasts.map(t => (
              <div key={t.id} className="fixed pointer-events-none z-50 text-[11px] text-zinc-300 bg-zinc-800/90 border border-white/[0.08] rounded-xl px-2.5 py-1 shadow-[0_4px_16px_rgba(0,0,0,0.4)] backdrop-blur-sm animate-toast"
                style={{ left: t.x - 50, top: t.y - 36 }}>
                {t.text}
              </div>
            ))}
          </div>
          <button onClick={handleGenerate} disabled={loading}
            className="w-full py-3.5 rounded-xl bg-blue-600/80 hover:bg-blue-600 disabled:opacity-40 text-white text-sm font-medium transition-all duration-200 active:scale-[0.99] shadow-[0_4px_24px_rgba(59,130,246,0.25)] flex items-center justify-center gap-2">
            {loading ? '生成中...' : <>{'生成题目'}<ChevronRight size={16} /></>}</button>
        </div>
      )}
    </div>
  )
}
