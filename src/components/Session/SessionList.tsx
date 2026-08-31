import type { SessionSummary } from '../../types'
import SessionItem from './SessionItem'

interface Props {
  sessions: SessionSummary[]
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
  activeId?: string
  collapsed?: boolean
}

export default function SessionList({ sessions, onSelect, onDelete, onRename, activeId, collapsed }: Props) {
  if (sessions.length === 0) {
    return <p className="text-zinc-500 text-sm text-center py-6">暂无会话</p>
  }
  return (
    <div className={collapsed ? 'flex flex-col items-center gap-0.5' : 'space-y-0.5'}>
      {sessions.map((s) => (
        <SessionItem key={s.id} session={s} isActive={s.id === activeId}
          onSelect={() => onSelect(s.id)} onDelete={() => onDelete(s.id)}
          onRename={(title) => onRename(s.id, title)} collapsed={collapsed} />
      ))}
    </div>
  )
}
