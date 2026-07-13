'use client'

import { useRef } from 'react'
import { useEditor, type GridOrder, type Tool } from '@/stores/editor'
import { fileToImageUrl } from '@/lib/floorplan'
import { ShapePicker } from './ShapePicker'

interface Props {
  /** Seating tables the validation pass found unreachable. */
  unreachable: string[]
}

/** The 4-step left panel. Steps 2–4 are gated on scale calibration. */
export function Rail({ unreachable }: Props) {
  const s = useEditor()
  const fileRef = useRef<HTMLInputElement>(null)
  const gated = s.scalePxPerM === null

  const toolBtn = (tool: Tool, label: string, disabled = gated) => (
    <button
      onClick={() => s.setTool(tool)}
      disabled={disabled}
      className={`rounded-md px-2 py-1.5 text-xs font-medium ${
        s.tool === tool
          ? 'bg-slate-900 text-white'
          : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
      } disabled:pointer-events-none disabled:opacity-40`}
    >
      {label}
    </button>
  )

  const step = (n: number, title: string, done: boolean, children: React.ReactNode) => (
    <section className={`border-b border-slate-100 p-3 ${gated && n > 1 ? 'opacity-50' : ''}`}>
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
            done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'
          }`}
        >
          {done ? '✓' : n}
        </span>
        {title}
      </h3>
      <div className="mt-2">{children}</div>
    </section>
  )

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    s.setFloorplanUrl(await fileToImageUrl(file))
    e.target.value = ''
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white">
      {step(
        1,
        'Scale',
        s.scalePxPerM !== null,
        <div className="space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,application/pdf"
            className="hidden"
            onChange={onUpload}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs hover:bg-slate-50"
          >
            {s.floorplanUrl ? 'Replace floor plan' : 'Upload floor plan'}
          </button>
          <div className="flex gap-1">
            {toolBtn('calibrate', '📏 Calibrate scale', false)}
            {s.scalePxPerM !== null && (
              <span className="self-center text-[10px] text-slate-400">
                {s.scalePxPerM.toFixed(1)} px/m
              </span>
            )}
          </div>
          {gated && (
            <p className="text-[10px] leading-snug text-amber-600">
              Drag a line across a known dimension. Everything below unlocks
              after calibration.
            </p>
          )}
        </div>,
      )}

      {step(
        2,
        'Walls',
        s.walls.length > 0,
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {toolBtn('room', '▭ Rectangle room')}
            {toolBtn('wall', '✎ Trace')}
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" checked={s.snapOn} onChange={s.toggleSnap} />
            Snap to 0.5m grid
          </label>
          {s.walls.length > 0 && (
            <button
              onClick={() => confirm('Remove all walls (and the door)?') && s.clearWalls()}
              className="text-[10px] text-red-500 hover:underline"
            >
              Clear {s.walls.length} wall segment(s)
            </button>
          )}
        </div>,
      )}

      {step(
        3,
        'Door · desk · stage',
        s.door !== null,
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {toolBtn('door', '🚪 Door', gated || s.walls.length === 0)}
            {toolBtn('registration', '🛎 Registration')}
            {toolBtn('stage', '🎤 Stage')}
          </div>
          <label className="block text-xs text-slate-600">
            Door width (m)
            <input
              type="number"
              step={0.2}
              min={0.8}
              max={6}
              defaultValue={s.doorWidthM}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                if (Number.isFinite(v) && v >= 0.8 && v <= 6) s.setDoorWidth(v)
              }}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
            />
          </label>
          <p className="text-[10px] leading-snug text-slate-400">
            The door snaps onto a wall and becomes a gap. The desk lives
            outside, in the foyer — routes start there.
          </p>
        </div>,
      )}

      {step(
        4,
        'Tables',
        s.tables.length > 0,
        <div className="space-y-2">
          <ShapePicker />
          <div className="flex flex-wrap gap-1">
            {toolBtn('place', '＋ Place one')}
            {toolBtn('grid', '⠿ Grid tool')}
          </div>
          <div className="flex items-center gap-2">
            <label className="flex-1 text-[10px] text-slate-500">
              Numbering
              <select
                value={s.gridOrder}
                onChange={(e) => s.setGridOrder(e.target.value as GridOrder)}
                className="mt-0.5 w-full rounded border border-slate-300 px-1 py-1 text-xs"
              >
                <option value="rows">Row by row</option>
                <option value="serpentine">Serpentine</option>
                <option value="cols">Column by column</option>
              </select>
            </label>
            <label className="text-[10px] text-slate-500">
              Rotation
              <select
                value={s.gridRot}
                onChange={(e) => s.setGridRot(Number(e.target.value) as 0 | 45 | 90)}
                className="mt-0.5 w-full rounded border border-slate-300 px-1 py-1 text-xs"
              >
                <option value={0}>0°</option>
                <option value={90}>90°</option>
                <option value={45}>45°</option>
              </select>
            </label>
          </div>
          <div className="flex items-end gap-1.5">
            <label className="w-14 text-[10px] text-slate-500">
              Rows
              <input
                type="number"
                min={1}
                max={20}
                value={s.gridRows}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10)
                  if (Number.isFinite(v) && v >= 1 && v <= 20) s.setGridRows(v)
                }}
                className="mt-0.5 w-full rounded border border-slate-300 px-1 py-1 text-xs"
              />
            </label>
            <span className="pb-1.5 text-xs text-slate-400">×</span>
            <label className="w-14 text-[10px] text-slate-500">
              Cols
              <input
                type="number"
                min={1}
                max={20}
                value={s.gridCols}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10)
                  if (Number.isFinite(v) && v >= 1 && v <= 20) s.setGridCols(v)
                }}
                className="mt-0.5 w-full rounded border border-slate-300 px-1 py-1 text-xs"
              />
            </label>
            <span className="pb-1.5 text-[10px] text-slate-400">
              = {s.gridRows * s.gridCols} tables
            </span>
          </div>
          <p className="text-[10px] leading-snug text-slate-400">
            Drag a rectangle — exactly {s.gridRows} × {s.gridCols} tables are
            spread evenly across it. If routes turn amber/red afterwards, the
            spacing is too tight for the aisles.
          </p>
        </div>,
      )}

      {unreachable.length > 0 && (
        <div className="m-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          <strong>⚠ {unreachable.length} unreachable table(s):</strong>{' '}
          {unreachable.join(', ')} — no walkable route from the desk. Fix
          before wedding day.
        </div>
      )}
    </aside>
  )
}
