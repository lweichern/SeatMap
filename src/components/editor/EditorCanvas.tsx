'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Image as KonvaImage, Layer, Line, Rect, Stage } from 'react-konva'
import type Konva from 'konva'
import { useEditor } from '@/stores/editor'
import { deriveScale, dist } from '@/lib/geometry'
import { loadImage } from '@/lib/floorplan'
import { TableNode } from './TableNode'
import { WallsLayer } from './WallsLayer'
import { EntranceMarker } from './EntranceMarker'
import { StageRect } from './StageRect'

/** Render scale used before the planner sets the real one. */
export const DEFAULT_PX_PER_M = 20

type Pt = { x: number; y: number }

export default function EditorCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [floorplanImg, setFloorplanImg] = useState<HTMLImageElement | null>(null)
  const [marquee, setMarquee] = useState<{ a: Pt; b: Pt } | null>(null)
  const [dragLine, setDragLine] = useState<{ a: Pt; b: Pt } | null>(null)
  const [scalePrompt, setScalePrompt] = useState<{ linePx: number } | null>(null)
  const [scaleInput, setScaleInput] = useState('')
  const [view, setView] = useState({ x: 40, y: 40, zoom: 1 })

  const editor = useEditor()
  const pxPerM = editor.scalePxPerM ?? DEFAULT_PX_PER_M

  // Fill parent container, track resizes
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() =>
      setSize({ w: el.clientWidth, h: el.clientHeight }),
    )
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  // Load floorplan image whenever the URL changes
  useEffect(() => {
    let alive = true
    if (!editor.floorplanUrl) {
      setFloorplanImg(null)
      return
    }
    loadImage(editor.floorplanUrl).then((img) => {
      if (alive) setFloorplanImg(img)
    })
    return () => {
      alive = false
    }
  }, [editor.floorplanUrl])

  // Keyboard: delete selection, finish/cancel wall
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        editor.removeSelected()
      } else if (e.key === 'Enter' && editor.tool === 'wall') {
        editor.finishWall()
      } else if (e.key === 'Escape') {
        if (editor.draftWall.length > 0) useEditor.setState({ draftWall: [] })
        else editor.setSelection([])
        setScalePrompt(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor.tool, editor.draftWall.length])

  /** Pointer position in floorplan pixel space (accounts for pan/zoom). */
  const worldPos = useCallback((): Pt | null => {
    const stage = stageRef.current
    if (!stage) return null
    return stage.getRelativePointerPosition()
  }, [])

  const toM = useCallback(
    (p: Pt): Pt => ({ x: p.x / pxPerM, y: p.y / pxPerM }),
    [pxPerM],
  )

  // Figma-style: wheel pans, cmd/ctrl+wheel zooms at pointer
  const onWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const stage = stageRef.current
    if (!stage) return
    if (e.evt.ctrlKey || e.evt.metaKey) {
      const pointer = stage.getPointerPosition()!
      setView((v) => {
        const factor = e.evt.deltaY > 0 ? 0.92 : 1.08
        const zoom = Math.min(8, Math.max(0.1, v.zoom * factor))
        const wx = (pointer.x - v.x) / v.zoom
        const wy = (pointer.y - v.y) / v.zoom
        return { zoom, x: pointer.x - wx * zoom, y: pointer.y - wy * zoom }
      })
    } else {
      setView((v) => ({ ...v, x: v.x - e.evt.deltaX, y: v.y - e.evt.deltaY }))
    }
  }, [])

  const isEmptyTarget = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const name = e.target.name?.() ?? ''
    return e.target === e.target.getStage() || name === 'floorplan'
  }

  const onMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const p = worldPos()
      if (!p) return
      switch (editor.tool) {
        case 'select':
          if (isEmptyTarget(e)) setMarquee({ a: p, b: p })
          break
        case 'table':
          editor.addTable(toM(p).x, toM(p).y)
          break
        case 'wall':
          editor.addWallPoint(toM(p).x, toM(p).y)
          break
        case 'entrance':
        case 'stage':
        case 'scale':
          setDragLine({ a: p, b: p })
          break
      }
    },
    [editor, toM, worldPos],
  )

  const onMouseMove = useCallback(() => {
    const p = worldPos()
    if (!p) return
    setMarquee((m) => (m ? { ...m, b: p } : m))
    setDragLine((d) => (d ? { ...d, b: p } : d))
  }, [worldPos])

  const onMouseUp = useCallback(() => {
    const p = worldPos()
    if (marquee && p) {
      const x1 = Math.min(marquee.a.x, p.x) / pxPerM
      const x2 = Math.max(marquee.a.x, p.x) / pxPerM
      const y1 = Math.min(marquee.a.y, p.y) / pxPerM
      const y2 = Math.max(marquee.a.y, p.y) / pxPerM
      // Tiny drag = click on empty space → clear selection
      if ((x2 - x1) * pxPerM < 4 && (y2 - y1) * pxPerM < 4) {
        editor.setSelection([])
      } else {
        editor.setSelection(
          editor.tables
            .filter((t) => t.x >= x1 && t.x <= x2 && t.y >= y1 && t.y <= y2)
            .map((t) => t.id),
        )
      }
      setMarquee(null)
    }
    if (dragLine && p) {
      const { a } = dragLine
      const lenPx = dist(a.x, a.y, p.x, p.y)
      if (editor.tool === 'entrance') {
        const facing =
          lenPx < 8
            ? 0
            : ((Math.atan2(p.x - a.x, -(p.y - a.y)) * 180) / Math.PI + 360) % 360
        editor.setEntrance({ x: toM(a).x, y: toM(a).y, facing_deg: facing })
        editor.setTool('select')
      } else if (editor.tool === 'stage' && lenPx > 8) {
        const m1 = toM(a)
        const m2 = toM(p)
        editor.setStage({
          x: Math.min(m1.x, m2.x),
          y: Math.min(m1.y, m2.y),
          w: Math.abs(m2.x - m1.x),
          h: Math.abs(m2.y - m1.y),
        })
        editor.setTool('select')
      } else if (editor.tool === 'scale' && lenPx > 8) {
        setScalePrompt({ linePx: lenPx })
        setScaleInput('')
      }
      if (editor.tool !== 'scale') setDragLine(null)
    }
  }, [dragLine, editor, marquee, pxPerM, toM, worldPos])

  const onDblClick = useCallback(() => {
    if (editor.tool === 'wall') editor.finishWall()
  }, [editor])

  function confirmScale() {
    const metres = parseFloat(scaleInput)
    if (scalePrompt && metres > 0) {
      editor.setScale(deriveScale(scalePrompt.linePx, metres))
      editor.setTool('select')
    }
    setScalePrompt(null)
    setDragLine(null)
  }

  const cursor =
    editor.tool === 'select' ? 'default' : editor.tool === 'table' ? 'copy' : 'crosshair'

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-slate-100">
      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        x={view.x}
        y={view.y}
        scaleX={view.zoom}
        scaleY={view.zoom}
        style={{ cursor }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onDblClick={onDblClick}
      >
        <Layer>
          {floorplanImg && (
            <KonvaImage image={floorplanImg} name="floorplan" opacity={0.85} />
          )}
          {!floorplanImg && (
            <Rect
              name="floorplan"
              width={40 * pxPerM}
              height={25 * pxPerM}
              fill="#ffffff"
              stroke="#cbd5e1"
              strokeWidth={1}
            />
          )}
          {editor.stage && <StageRect stage={editor.stage} pxPerM={pxPerM} />}
          <WallsLayer walls={editor.walls} draftWall={editor.draftWall} pxPerM={pxPerM} />
          {editor.entrance && <EntranceMarker entrance={editor.entrance} pxPerM={pxPerM} />}
        </Layer>
        <Layer>
          {editor.tables.map((t) => (
            <TableNode
              key={t.id}
              table={t}
              pxPerM={pxPerM}
              selected={editor.selectedIds.includes(t.id)}
              draggable={editor.tool === 'select'}
              onSelect={(e) => {
                if (e.evt.shiftKey) editor.toggleSelection(t.id)
                else editor.setSelection([t.id])
              }}
              onDragEnd={(xPx, yPx) => editor.moveTable(t.id, xPx / pxPerM, yPx / pxPerM)}
            />
          ))}
          {marquee && (
            <Rect
              x={Math.min(marquee.a.x, marquee.b.x)}
              y={Math.min(marquee.a.y, marquee.b.y)}
              width={Math.abs(marquee.b.x - marquee.a.x)}
              height={Math.abs(marquee.b.y - marquee.a.y)}
              fill="rgba(37, 99, 235, 0.08)"
              stroke="#2563eb"
              strokeWidth={1}
              dash={[4, 4]}
              listening={false}
            />
          )}
          {dragLine && (editor.tool === 'scale' || editor.tool === 'entrance') && (
            <Line
              points={[dragLine.a.x, dragLine.a.y, dragLine.b.x, dragLine.b.y]}
              stroke={editor.tool === 'scale' ? '#dc2626' : '#16a34a'}
              strokeWidth={2}
              dash={[6, 4]}
              listening={false}
            />
          )}
          {dragLine && editor.tool === 'stage' && (
            <Rect
              x={Math.min(dragLine.a.x, dragLine.b.x)}
              y={Math.min(dragLine.a.y, dragLine.b.y)}
              width={Math.abs(dragLine.b.x - dragLine.a.x)}
              height={Math.abs(dragLine.b.y - dragLine.a.y)}
              stroke="#9333ea"
              strokeWidth={2}
              dash={[8, 4]}
              listening={false}
            />
          )}
        </Layer>
      </Stage>

      {editor.tool === 'wall' && (
        <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white shadow">
          Click to place wall points — double-click or Enter to finish, Esc to cancel
        </div>
      )}
      {editor.tool === 'scale' && !scalePrompt && (
        <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-md bg-red-700 px-3 py-1.5 text-xs text-white shadow">
          Drag a line across a known dimension (e.g. a 20m wall)
        </div>
      )}
      {editor.tool === 'entrance' && (
        <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-md bg-green-700 px-3 py-1.5 text-xs text-white shadow">
          Press at the entrance, drag in the direction guests walk in, release
        </div>
      )}

      {scalePrompt && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30">
          <div className="w-72 rounded-lg bg-white p-4 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-900">Set scale</h3>
            <p className="mt-1 text-xs text-slate-500">
              How long is the line you just drew, in metres?
            </p>
            <input
              autoFocus
              type="number"
              min="0.1"
              step="0.1"
              value={scaleInput}
              onChange={(e) => setScaleInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmScale()}
              className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="e.g. 20"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => {
                  setScalePrompt(null)
                  setDragLine(null)
                }}
                className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={confirmScale}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
              >
                Set scale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
