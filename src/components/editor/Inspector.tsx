'use client'

import { useEditor } from '@/stores/editor'
import type { TableShape } from '@/lib/types'

export function Inspector() {
  const editor = useEditor()
  const sel = editor.tables.filter((t) => editor.selectedIds.includes(t.id))

  if (sel.length === 0) {
    const capacity = editor.tables.reduce((s, t) => s + t.seats, 0)
    return (
      <aside className="w-64 shrink-0 border-l border-slate-200 bg-white p-4 text-sm">
        <h3 className="font-semibold text-slate-900">Layout</h3>
        <dl className="mt-3 space-y-2 text-slate-600">
          <div className="flex justify-between">
            <dt>Tables</dt>
            <dd className="font-medium text-slate-900">{editor.tables.length}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Total capacity</dt>
            <dd className="font-medium text-slate-900">{capacity}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Scale</dt>
            <dd className="font-medium text-slate-900">
              {editor.scalePxPerM ? `${editor.scalePxPerM.toFixed(1)} px/m` : 'not set'}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>Entrance</dt>
            <dd className="font-medium text-slate-900">{editor.entrance ? '✓' : '✗ required'}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-slate-400">
          Select a table to edit it. Shift-click or drag a marquee for multi-select.
        </p>
      </aside>
    )
  }

  const t = sel[0]
  const mixed = sel.length > 1

  return (
    <aside className="w-64 shrink-0 border-l border-slate-200 bg-white p-4 text-sm">
      <h3 className="font-semibold text-slate-900">
        {mixed ? `${sel.length} tables selected` : `Table ${t.label}`}
      </h3>

      {!mixed && (
        <label className="mt-3 block text-xs text-slate-600">
          Label
          <input
            value={t.label}
            onChange={(e) => editor.updateTable(t.id, { label: e.target.value })}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5"
          />
        </label>
      )}

      <label className="mt-3 block text-xs text-slate-600">
        Seats
        <input
          type="number"
          min={1}
          value={t.seats}
          onChange={(e) =>
            sel.forEach((s) => editor.updateTable(s.id, { seats: Number(e.target.value) }))
          }
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5"
        />
      </label>

      <label className="mt-3 block text-xs text-slate-600">
        Shape
        <select
          value={t.shape}
          onChange={(e) =>
            sel.forEach((s) => editor.updateTable(s.id, { shape: e.target.value as TableShape }))
          }
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5"
        >
          <option value="round">Round</option>
          <option value="rect">Rectangular</option>
        </select>
      </label>

      {t.shape === 'round' ? (
        <label className="mt-3 block text-xs text-slate-600">
          Diameter (m)
          <input
            type="number"
            min={0.5}
            step={0.1}
            value={t.diameter_m}
            onChange={(e) =>
              sel.forEach((s) => editor.updateTable(s.id, { diameter_m: Number(e.target.value) }))
            }
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5"
          />
        </label>
      ) : (
        <div className="mt-3 flex gap-2">
          <label className="block flex-1 text-xs text-slate-600">
            Width (m)
            <input
              type="number"
              min={0.5}
              step={0.1}
              value={t.w_m ?? t.diameter_m}
              onChange={(e) =>
                sel.forEach((s) => editor.updateTable(s.id, { w_m: Number(e.target.value) }))
              }
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5"
            />
          </label>
          <label className="block flex-1 text-xs text-slate-600">
            Depth (m)
            <input
              type="number"
              min={0.5}
              step={0.1}
              value={t.h_m ?? t.diameter_m}
              onChange={(e) =>
                sel.forEach((s) => editor.updateTable(s.id, { h_m: Number(e.target.value) }))
              }
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5"
            />
          </label>
        </div>
      )}

      {!mixed && (
        <p className="mt-4 text-xs text-slate-400">
          Position: {t.x.toFixed(1)}m, {t.y.toFixed(1)}m
        </p>
      )}
    </aside>
  )
}
