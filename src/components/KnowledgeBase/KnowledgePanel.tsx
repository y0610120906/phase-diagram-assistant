import { useState, useEffect, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Search, Upload, FileText, Trash2 } from 'lucide-react'
import * as api from '../../services/api'

interface DocInfo { name: string; title: string; chunk_count: number }
interface Chunk { chunk_id: string; content: string; page_number: number; chunk_index?: number }

export default function KnowledgePanel() {
  const [query, setQuery] = useState('')
  const [docs, setDocs] = useState<DocInfo[]>([])
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null)
  const [chunks, setChunks] = useState<Chunk[]>([])
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => { api.listDocuments().then(r => { setDocs(r.documents) }).catch(() => {}) }, [])

  async function handleSearch() {
    if (!query.trim()) return
    setSearching(true); setSelectedDoc(null)
    try { const r = await api.searchKnowledge(query, 10); setResults(r.results || []) }
    catch { setResults([]) }
    setSearching(false)
  }

  async function openDoc(name: string) {
    setSelectedDoc(name); setQuery(''); setResults([])
    try { const r = await api.getDocumentChunks(name); setChunks(r.chunks) }
    catch { setChunks([]) }
  }

  const onDrop = useCallback(async (accepted: File[]) => {
    setUploading(true)
    for (const f of accepted) {
      try { await api.uploadKnowledge(f, '参考资料'); setToast(`${f.name} ✅`); setTimeout(() => setToast(null), 2000) } catch (e) { setToast(`${f.name} ❌ 失败`); setTimeout(() => setToast(null), 2500) }
    }
    const r = await api.listDocuments(); setDocs(r.documents)
    setUploading(false)
  }, [])
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'application/pdf': ['.pdf'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] }, maxFiles: 5, noClick: true, noKeyboard: true })

  function highlightText(text: string, q: string) {
    if (!q.trim()) return text
    const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
    return parts.map((p, i) => p.toLowerCase() === q.toLowerCase() ? <mark key={i}>{p}</mark> : p)
  }

  const hasResults = results.length > 0
  const viewingDoc = selectedDoc && chunks.length > 0

  return (
    <div className="page-enter max-w-xl mx-auto" {...getRootProps()}>
      <input {...getInputProps()} />
      {isDragActive && (
        <div className="fixed inset-0 bg-blue-500/10 border-2 border-blue-400/40 border-dashed rounded-3xl flex items-center justify-center z-50 pointer-events-none">
          <p className="text-blue-400 text-lg font-semibold">释放以上传文档</p>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-8">
        <div className="text-4xl mb-3">📚</div>
        <h2 className="text-xl font-bold text-zinc-200">知识库检索</h2>
        <p className="text-xs text-zinc-500 mt-1">
          {docs.length > 0 ? `已索引 ${docs.length} 个文档 · ${docs.reduce((s, d) => s + d.chunk_count, 0)} 个知识块` : '暂无文档'}
        </p>
      </div>

      {/* Search bar */}
      <div className="flex gap-2 mb-6">
        <div className="flex-1 relative">
          <input value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="搜索关键词..."
            className="w-full py-3 pl-4 pr-10 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-sm text-zinc-200 placeholder-zinc-500 outline-none focus:border-blue-400/40 transition-all duration-200" />
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        </div>
        <button onClick={handleSearch} disabled={searching}
          className="px-5 py-3 rounded-2xl bg-blue-600/80 hover:bg-blue-600 disabled:opacity-40 text-white text-sm font-medium transition-all duration-200 shadow-[0_4px_16px_rgba(59,130,246,0.25)]">
          {searching ? '...' : '搜索'}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl text-sm font-medium shadow-[0_4px_20px_rgba(0,0,0,0.4)] animate-toast"
          style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
          {toast}
        </div>
      )}

      {/* Upload area */}
      <label className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl border-2 border-dashed border-white/[0.06] hover:border-white/[0.12] text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer transition-all duration-200 mb-8">
        <Upload size={14} />
        {uploading ? '上传中...' : '拖拽或点击上传 PDF / DOCX'}
        <input type="file" accept=".pdf,.docx" className="hidden" onChange={async (e) => {
          const files = e.target.files; if (!files || files.length === 0) return
          setUploading(true); let ok = 0, fail = 0
          for (const f of Array.from(files)) {
            try { await api.uploadKnowledge(f, '参考资料'); ok++ } catch (e: any) { fail++; console.error('Upload failed:', f.name, e) }
          }
          const r = await api.listDocuments(); setDocs(r.documents); setUploading(false)
          if (ok > 0 || fail > 0) { setToast(`${ok > 0 ? '✅' : '❌'} ${ok} 成功${fail > 0 ? `，${fail} 失败（查看控制台）` : ''}`); setTimeout(() => setToast(null), 3000) }
        }} multiple />
      </label>

      {/* Search results */}
      {hasResults && (
        <div className="mb-6">
          <div className="text-xs text-zinc-500 mb-3 uppercase tracking-wider">搜索结果</div>
          {results.map((r, i) => (
            <div key={i} className="glow-card mb-2 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] cursor-pointer"
              onClick={() => openDoc(r.source_name)}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-400">{r.source_type}</span>
                <span className="text-xs text-zinc-400">{r.source_name}</span>
                {r.relevance_score > 0 && <span className="text-[10px] text-zinc-600">{Math.round(r.relevance_score * 100)}%</span>}
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">{highlightText(r.snippet?.slice(0, 200) || '', query)}</p>
            </div>
          ))}
          <button onClick={() => { setResults([]); setQuery('') }} className="text-xs text-zinc-500 hover:text-zinc-300 mt-2">清除结果</button>
        </div>
      )}

      {/* Document list */}
      {!hasResults && !viewingDoc && (
        <div>
          <div className="text-xs text-zinc-500 mb-3 uppercase tracking-wider">已上传文档</div>
          {docs.length === 0 ? (
            <div className="text-center text-zinc-500 text-sm py-8">暂无文档，上传文档 开始索引</div>
          ) : (
            docs.map(d => (
              <div key={d.name} className="glow-card flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] mb-2 group">
                <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => openDoc(d.name)}>
                  <FileText size={18} className="text-zinc-500 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-300 truncate">{d.title || d.name}</div>
                    <div className="text-[10px] text-zinc-600">{d.chunk_count} 个知识块</div>
                  </div>
                </div>
                <button onClick={async (e) => { e.stopPropagation(); if (confirm(`确定删除「${d.title || d.name}」？`)) { await api.deleteKnowledgeDocument(d.name); const r = await api.listDocuments(); setDocs(r.documents); setToast('已删除'); setTimeout(() => setToast(null), 2000) } }}
                  className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-all ml-2"
                  style={{ color: '#f87171' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Document viewer */}
      {viewingDoc && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => { setSelectedDoc(null); setChunks([]) }}
              className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors">← 返回列表</button>
            <span className="text-xs text-zinc-600">{chunks.length} 个知识块</span>
          </div>
          {chunks.map(c => (
            <div key={c.chunk_id} className="p-4 rounded-2xl bg-white/[0.01] border border-white/[0.03] mb-2">
              <div className="text-[10px] text-zinc-600 mb-1.5">第 {c.page_number} 页 · 块 {c.chunk_index || 0}</div>
              <p className="text-xs text-zinc-300 leading-relaxed">{highlightText(c.content, query)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
