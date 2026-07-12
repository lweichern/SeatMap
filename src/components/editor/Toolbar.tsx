'use client'

import { useRef, useState } from 'react'
import { useEditor, type Tool } from '@/stores/editor'
import { fileToImageUrl } from '@/lib/floorplan'

const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id: 'select', label: 'Select (drag tables, marquee)', icon: '⌖' },
  { id: 'table', label: 'Add table (click to place)', icon: '◯' },
  { id: 'wall', label: 'Draw walls', icon: '╱' },
  { id: 'entrance', label: 'Mark entrance', icon: '⮕' },
  { id: 'stage', label: 'Mark stage', icon: '▭' },
  { id: 'scale', label: 'Set scale', icon: '📏' },
]

export function Toolbar() {
  const editor = useEditor()
  const fileRef = useRef<HTMLInputElement>(null)
  const [gridOpen, setGridOpen] = useState(false)
  const [grid, setGrid] = useState({ rows: 2, cols: 5, gapM: 3 })
  const hasSel = editor.selectedIds.length > 0
  const multiSel = editor.selectedIds.length >= 2

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    editor.setFloorplanUrl(await fileToImageUrl(file))
    e.target.value = ''
  }

  const btn =
    'rounded-md px-2.5 py-1.5 text-sm border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none'

  return (
    <div className="relative flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,application/pdf"
        className="hidden"
        onChange={onUpload}
      />
      <button className={btn} onClick={() => fileRef.current?.click()}>
        Upload floor plan
      </button>

      <span className="mx-1 h-6 w-px bg-slate-200" />

      {TOOLS.map((t) => (
        <button
          key={t.id}
          title={t.label}
          onClick={() => editor.setTool(t.id)}
          className={`rounded-md px-2.5 py-1.5 text-sm border ${
            editor.tool === t.id
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-200 hover:bg-slate-100'
          }`}
        >
          <span className="mr-1">{t.icon}</span>
          {t.id === 'select' ? 'Select' : t.id === 'table' ? 'Table' : t.id[0].toUpperCase() + t.id.slice(1)}
        </button>
      ))}

      <span className="mx-1 h-6 w-px bg-slate-200" />

      <button className={btn} disabled={!multiSel} onClick={() => editor.align('y')}>
        Align row
      </button>
      <button className={btn} disabled={!multiSel} onClick={() => editor.align('x')}>
        Align column
      </button>
      <button className={btn} disabled={editor.selectedIds.length < 3} onClick={() => editor.distribute('x')}>
        Distribute H
      </button>
      <button className={btn} disabled={editor.selectedIds.length < 3} onClick={() => editor.distribute('y')}>
        Distribute V
      </button>
      <button className={btn} disabled={!hasSel} onClick={() => setGridOpen((o) => !o)}>
        Duplicate grid…
      </button>
      <button
        className={`${btn} text-red-600`}
        disabled={!hasSel}
        onClick={() => editor.removeSelected()}
      >
        Delete
      </button>

      {editor.scalePxPerM === null && (
        <span className="ml-auto rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
          ⚠ Scale not set — use the Scale tool first
        </span>
      )}

      {gridOpen && (
        <div className="absolute right-3 top-full z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          <h4 className="text-xs font-semibold text-slate-700">Duplicate into grid</h4>
          {(
            [
              ['rows', 'Rows'],
              ['cols', 'Columns'],
              ['gapM', 'Gap (m)'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="mt-2 flex items-center justify-between text-xs text-slate-600">
              {label}
              <input
                type="number"
                min={key === 'gapM' ? 0.5 : 1}
                step={key === 'gapM' ? 0.5 : 1}
                value={grid[key]}
                onChange={(e) => setGrid({ ...grid, [key]: Number(e.target.value) })}
                className="w-20 rounded border border-slate-300 px-2 py-1"
              />
            </label>
          ))}
          <button
            className="mt-3 w-full rounded-md bg-slate-900 py-1.5 text-sm text-white hover:bg-slate-700"
            onClick={() => {
              editor.duplicateGrid(grid)
              setGridOpen(false)
            }}
          >
            Duplicate
          </button>
        </div>
      )}
    </div>
  )
}
