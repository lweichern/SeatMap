'use client'

import { useEditor } from '@/stores/editor'
import { SHAPES, type Shape } from '@/lib/types'

const GLYPHS: Record<Shape, React.ReactNode> = {
  round: <circle cx="12" cy="12" r="8" />,
  banquet: <rect x="3" y="8" width="18" height="8" rx="1.5" />,
  square: <rect x="5" y="5" width="14" height="14" rx="1.5" />,
  oval: <ellipse cx="12" cy="12" rx="9" ry="6" />,
  buffet: <rect x="2" y="9" width="20" height="6" rx="1" />,
}

export function ShapePicker() {
  const placeShape = useEditor((s) => s.placeShape)
  const setPlaceShape = useEditor((s) => s.setPlaceShape)

  return (
    <div className="grid grid-cols-5 gap-1">
      {(Object.keys(SHAPES) as Shape[]).map((shape) => {
        const active = placeShape === shape
        const service = SHAPES[shape].kind === 'service'
        return (
          <button
            key={shape}
            onClick={() => setPlaceShape(shape)}
            title={SHAPES[shape].label + (service ? ' (service — no seats)' : '')}
            className={`flex flex-col items-center gap-0.5 rounded-md border px-1 py-1.5 text-[10px] ${
              active
                ? service
                  ? 'border-amber-700 bg-amber-50 text-amber-900'
                  : 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" opacity={0.85}>
              {GLYPHS[shape]}
            </svg>
            {SHAPES[shape].label}
          </button>
        )
      })}
    </div>
  )
}
