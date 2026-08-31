import { X, Plus, Minus } from 'lucide-react'
import { useState, useCallback, useEffect, useRef } from 'react'

interface Props {
  src: string | null
  onClose: () => void
}

export default function ImageViewer({ src, onClose }: Props) {
  const [scale, setScale] = useState(1)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setScale(1) }, [src])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation()
    setScale(s => Math.min(Math.max(s - e.deltaY * 0.0005, 0.5), 4))
  }, [])

  const zoomIn = useCallback((e: React.MouseEvent) => { e.stopPropagation(); setScale(s => Math.min(s + 0.15, 4)) }, [])
  const zoomOut = useCallback((e: React.MouseEvent) => { e.stopPropagation(); setScale(s => Math.max(s - 0.15, 0.5)) }, [])
  const handleClose = useCallback((e: React.MouseEvent) => { e.stopPropagation(); onClose() }, [onClose])

  if (!src) return null

  return (
    <div ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
      onWheel={onWheel}>

      {/* Pill controls — center-bottom, always above image */}
      <div
        className="absolute bottom-8 left-1/2 flex items-center gap-2"
        style={{ transform: 'translateX(-50%)', zIndex: 9999, pointerEvents: 'auto' }}
        onClick={(e) => e.stopPropagation()}>
        <button onClick={zoomOut}
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer' }}>
          <Minus size={18} />
        </button>
        <span className="text-xs h-10 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.45)', padding: '0 14px' }}>
          {Math.round(scale * 100)}%
        </span>
        <button onClick={zoomIn}
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer' }}>
          <Plus size={18} />
        </button>
        <button onClick={handleClose}
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', cursor: 'pointer', marginLeft: 12 }}>
          <X size={18} />
        </button>
      </div>

      <img
        src={`data:image/png;base64,${src}`}
        alt=""
        className="max-w-[90vw] max-h-[90vh] object-contain select-none pointer-events-none"
        style={{ transform: `scale(${scale})`, transition: 'transform 0.15s cubic-bezier(0.16,1,0.3,1)' }}
        draggable={false}
      />
    </div>
  )
}
