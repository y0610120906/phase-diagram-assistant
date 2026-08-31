import { useState } from 'react'
import { MessageSquare, Trash2 } from 'lucide-react'
import type { SessionSummary } from '../../types'

interface Props { session: SessionSummary; isActive: boolean; onSelect: () => void; onDelete: () => void; onRename: (title: string) => void; collapsed?: boolean }

export default function SessionItem({ session, isActive, onSelect, onDelete, onRename, collapsed }: Props) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(session.title)

  function submit() { if (title.trim()) onRename(title.trim()); else setTitle(session.title); setEditing(false) }

  if (collapsed) {
    return (
      <div onClick={onSelect} title={session.title}
        className={`flex items-center justify-center w-8 h-8 rounded-lg cursor-pointer transition-colors duration-200 mb-0.5 ${
          isActive ? 'bg-blue-600/20 text-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.15)] border border-blue-400/20' : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300 hover:shadow-[0_0_24px_rgba(59,130,246,0.08)]'
        }`}>
        <MessageSquare size={13} />
      </div>
    )
  }

  return (
    <div onClick={() => { if (!editing) onSelect() }} onDoubleClick={() => setEditing(true)}
      className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-xl cursor-pointer text-[12px] transition-colors duration-200 active:scale-[0.99] border ${
        isActive
          ? 'bg-blue-600/20 text-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.15)] border-blue-400/20'
          : 'text-zinc-400 hover:bg-white/[0.02] hover:shadow-[0_0_24px_rgba(59,130,246,0.1)] border-transparent'
      }`}>
      <MessageSquare size={12} className="shrink-0 opacity-50" />
      {editing ? (
        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} onBlur={submit}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { setTitle(session.title); setEditing(false) } }}
          onClick={e => e.stopPropagation()}
          className="flex-1 bg-white/[0.04] text-zinc-200 px-1.5 py-0.5 rounded-lg text-[11px] outline-none border border-white/[0.04]" />
      ) : <span className="flex-1 truncate">{session.title}</span>}
      <span className="text-[10px] opacity-30 shrink-0">{session.message_count}</span>
      <button onClick={e => { e.stopPropagation(); onDelete() }}
        className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"><Trash2 size={11} /></button>
    </div>
  )
}
