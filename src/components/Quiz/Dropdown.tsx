import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

interface Props {
  value: string
  options: string[]
  onChange: (v: string) => void
  label?: string
}

export default function Dropdown({ value, options, onChange, label }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      {label && <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2.5">{label}</div>}
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-[15px] text-zinc-200 bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.12] transition-all duration-200 focus:outline-none focus:border-blue-400/40">
        {value}
        <ChevronDown size={16} className={`text-zinc-500 transition-transform duration-250 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-2 w-full bg-[#12121f] rounded-2xl border border-white/[0.06] shadow-[0_16px_48px_rgba(0,0,0,0.6),0_0_40px_rgba(59,130,246,0.06)] p-1 z-20"
          style={{ animation: 'dropdown-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}>
          {options.map((opt, i) => (
            <button key={opt} onClick={() => { onChange(opt); setOpen(false) }}
              className={`w-full text-left px-4 py-2.5 rounded-2xl text-sm transition-all duration-150 my-0.5 ${
                opt === value
                  ? 'bg-blue-500/15 text-blue-400 shadow-[0_0_16px_rgba(59,130,246,0.12)] border border-blue-400/15'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] border border-transparent'
              }`}
              style={{ animationDelay: `${i * 40}ms`, animation: `dropdown-in 0.2s ${i * 40}ms cubic-bezier(0.16, 1, 0.3, 1) both` }}>
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
