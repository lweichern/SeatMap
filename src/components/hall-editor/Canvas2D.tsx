'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Circle,
  Ellipse,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
} from 'react-konva'
import type Konva from 'konva'
import { useEditor, computeGridPositions, gridSpacing } from '@/stores/editor'
import { deriveScale, dist } from '@/lib/geometry'
import { loadImage } from '@/lib/floorplan'
import { halfExtent, seatPositions } from '@/lib/table-geometry'
import { SHAPES, type TableObj } from '@/lib/types'
import type { RouteResult } from '@/lib/pathfinding'

/** Render scale used before calibration (floorplan px per metre). */
export const DEFAULT_PX_PER_M = 20

type Pt = { x: number; y: number }

interface Props {
  route: RouteResult | null
  unreachableIds: string[]
}

export function Canvas2D({ route, unreachableIds }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [floorplanImg, setFloorplanImg] = useState<HTMLImageElement | null>(null)
  const [dragRect, setDragRect] = useState<{ a: Pt; b: Pt } | null>(null)
  const [scalePrompt, setScalePrompt] = useState<{ linePx: number } | null>(null)
  const [scaleInput, setScaleInput] = useState('')
  const [view, setView] = useState({ x: 40, y: 40, zoom: 1 })

  const editor = useEditor()
  // m2p/p2m — the ONLY place metres meet pixels in the editor
  const pxPerM = editor.scalePxPerM ?? DEFAULT_PX_PER_M
  const m2p = useCallback((m: number) => m * pxPerM, [pxPerM])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
        return
      if (e.key === 'Delete' || e.key === 'Backspace') editor.removeSelected()
      else if (e.key === 'Enter' && editor.tool === 'wall') editor.finishWall()
      else if (e.key === 'Escape') {
        if (editor.draftWall.length > 0) editor.cancelWall()
        else editor.setSelection([])
        setScalePrompt(null)
        setDragRect(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor.tool, editor.draftWall.length])

  const worldPos = useCallback((): Pt | null => {
    return stageRef.current?.getRelativePointerPosition() ?? null
  }, [])
  const toM = useCallback((p: Pt): Pt => ({ x: p.x / pxPerM, y: p.y / pxPerM }), [pxPerM])

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
      const m = toM(p)
      switch (editor.tool) {
        case 'select':
          if (isEmptyTarget(e)) editor.setSelection([])
          break
        case 'wall':
          editor.addWallPoint(m.x, m.y)
          break
        case 'door':
          editor.setDoor(m.x, m.y)
          editor.setTool('select')
          break
        case 'registration':
          editor.setRegistration(m)
          editor.setTool('select')
          break
        case 'place':
          editor.placeTable(m.x, m.y)
          break
        case 'calibrate':
        case 'room':
        case 'stage':
        case 'grid':
          setDragRect({ a: p, b: p })
          break
      }
    },
    [editor, toM, worldPos],
  )

  const onMouseMove = useCallback(() => {
    const p = worldPos()
    if (!p) return
    setDragRect((d) => (d ? { ...d, b: p } : d))
  }, [worldPos])

  const onMouseUp = useCallback(() => {
    if (!dragRect) return
    const { a, b } = dragRect
    const lenPx = dist(a.x, a.y, b.x, b.y)
    const rectM = {
      x: Math.min(a.x, b.x) / pxPerM,
      y: Math.min(a.y, b.y) / pxPerM,
      w: Math.abs(b.x - a.x) / pxPerM,
      h: Math.abs(b.y - a.y) / pxPerM,
    }
    if (editor.tool === 'calibrate' && lenPx > 8) {
      setScalePrompt({ linePx: lenPx })
      setScaleInput('')
      return // keep dragRect visible under the dialog
    }
    if (editor.tool === 'room' && lenPx > 8) {
      editor.addRoomRect(rectM.x, rectM.y, rectM.w, rectM.h)
      editor.setTool('select')
    } else if (editor.tool === 'stage' && lenPx > 8) {
      editor.setStage({ x: rectM.x, y: rectM.y, w: rectM.w, h: rectM.h })
      editor.setTool('select')
    } else if (editor.tool === 'grid' && lenPx > 8) {
      editor.applyGrid(rectM)
      editor.setTool('select')
    }
    setDragRect(null)
  }, [dragRect, editor, pxPerM])

  const onDblClick = useCallback(() => {
    if (editor.tool !== 'wall') return
    const pts = editor.draftWall
    if (
      pts.length >= 2 &&
      pts[pts.length - 1].x === pts[pts.length - 2].x &&
      pts[pts.length - 1].y === pts[pts.length - 2].y
    ) {
      editor.finishWall()
    }
  }, [editor])

  function confirmScale() {
    const metres = parseFloat(scaleInput)
    if (scalePrompt && metres > 0) {
      // the drag was measured with getRelativePointerPosition → already in
      // floorplan-pixel space, independent of pan/zoom
      editor.setScale(deriveScale(scalePrompt.linePx, metres))
      editor.setTool('select')
    }
    setScalePrompt(null)
    setDragRect(null)
  }

  // ghost grid while dragging with the grid tool
  const ghost =
    editor.tool === 'grid' && dragRect
      ? computeGridPositions(
          {
            x: Math.min(dragRect.a.x, dragRect.b.x) / pxPerM,
            y: Math.min(dragRect.a.y, dragRect.b.y) / pxPerM,
            w: Math.abs(dragRect.b.x - dragRect.a.x) / pxPerM,
            h: Math.abs(dragRect.b.y - dragRect.a.y) / pxPerM,
          },
          editor.placeShape,
          editor.gridRot,
          editor.gridOrder,
          editor.gridAisle,
        )
      : null

  const cursor =
    editor.tool === 'select' ? 'default' : editor.tool === 'place' ? 'copy' : 'crosshair'

  // route legs (foyer teal, hall blue), red when !ok, amber when squeeze
  const routeLegs: { pts: number[]; color: string; dash?: number[] }[] = []
  if (route) {
    const color = !route.ok ? '#ef4444' : route.squeeze ? '#f59e0b' : null
    const flat = (pts: Pt[]) => pts.flatMap((p) => [m2p(p.x), m2p(p.y)])
    if (route.doorIndex > 0 && route.ok) {
      routeLegs.push({
        pts: flat(route.path.slice(0, route.doorIndex + 1)),
        color: color ?? '#14b8a6',
      })
      routeLegs.push({
        pts: flat(route.path.slice(route.doorIndex)),
        color: color ?? '#3b82f6',
      })
    } else {
      routeLegs.push({ pts: flat(route.path), color: color ?? '#3b82f6', dash: !route.ok ? [10, 6] : undefined })
    }
  }

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
          {floorplanImg ? (
            <KonvaImage image={floorplanImg} name="floorplan" opacity={0.8} />
          ) : (
            <Rect
              name="floorplan"
              width={m2p(40)}
              height={m2p(25)}
              fill="#ffffff"
              stroke="#cbd5e1"
              strokeWidth={1}
            />
          )}

          {editor.stage && (
            <Group x={m2p(editor.stage.x)} y={m2p(editor.stage.y)} listening={false}>
              <Rect
                width={m2p(editor.stage.w)}
                height={m2p(editor.stage.h)}
                fill="rgba(147, 51, 234, 0.15)"
                stroke="#9333ea"
                strokeWidth={2}
                dash={[10, 5]}
              />
              <Text
                text="STAGE"
                fontSize={13}
                fontStyle="bold"
                fill="#9333ea"
                width={m2p(editor.stage.w)}
                height={m2p(editor.stage.h)}
                align="center"
                verticalAlign="middle"
              />
            </Group>
          )}

          {/* walls with the door GAP visibly carved out */}
          {editor.walls.map((w, i) => (
            <WallLine key={i} w={w} m2p={m2p} door={editor.door} doorWidthM={editor.doorWidthM} />
          ))}

          {editor.draftWall.length > 0 && (
            <Line
              points={editor.draftWall.flatMap((p) => [m2p(p.x), m2p(p.y)])}
              stroke="#2563eb"
              strokeWidth={3}
              dash={[8, 6]}
              lineCap="round"
              listening={false}
            />
          )}

          {editor.door && (
            <Group x={m2p(editor.door.x)} y={m2p(editor.door.y)} listening={false}>
              <Circle radius={6} fill="#10b981" stroke="#fff" strokeWidth={1.5} />
              <Text text="DOOR" fontSize={10} fontStyle="bold" fill="#059669" x={8} y={-5} />
            </Group>
          )}

          {editor.registration && (
            <Group
              x={m2p(editor.registration.x)}
              y={m2p(editor.registration.y)}
              listening={false}
            >
              <Rect
                x={-m2p(0.9)}
                y={-m2p(0.35)}
                width={m2p(1.8)}
                height={m2p(0.7)}
                fill="rgba(14,165,233,0.25)"
                stroke="#0ea5e9"
                strokeWidth={2}
                cornerRadius={3}
              />
              <Text
                text="REGISTRATION"
                fontSize={9}
                fontStyle="bold"
                fill="#0284c7"
                x={-m2p(0.9)}
                width={m2p(1.8)}
                y={m2p(0.45)}
                align="center"
              />
            </Group>
          )}

          {/* walking route */}
          {routeLegs.map((leg, i) => (
            <Line
              key={i}
              points={leg.pts}
              stroke={leg.color}
              strokeWidth={3}
              dash={leg.dash ?? [9, 6]}
              lineCap="round"
              lineJoin="round"
              listening={false}
              opacity={0.9}
            />
          ))}
          {route && !route.ok && route.path.length > 0 && (
            <Text
              text="NO WALKABLE ROUTE"
              x={m2p((route.path[0].x + route.path[route.path.length - 1].x) / 2) - 70}
              y={m2p((route.path[0].y + route.path[route.path.length - 1].y) / 2) - 20}
              fontSize={13}
              fontStyle="bold"
              fill="#dc2626"
              listening={false}
            />
          )}
        </Layer>

        <Layer>
          {editor.tables.map((t) => (
            <TableGlyph
              key={t.id}
              t={t}
              m2p={m2p}
              selected={editor.selectedIds.includes(t.id)}
              unreachable={unreachableIds.includes(t.label)}
              draggable={editor.tool === 'select'}
              onSelect={(evt) => {
                if (evt.evt.shiftKey) editor.toggleSelection(t.id)
                else {
                  editor.setSelection([t.id])
                  editor.setRouteTarget(t.kind === 'seat' ? t.id : null)
                }
              }}
              onDragEnd={(xPx, yPx) => editor.moveTable(t.id, xPx / pxPerM, yPx / pxPerM)}
            />
          ))}

          {/* ghost grid preview */}
          {ghost && ghost.length > 0 && (
            <Group listening={false} opacity={0.45}>
              {ghost.map((p, i) => (
                <GhostShape key={i} x={m2p(p.x)} y={m2p(p.y)} m2p={m2p} />
              ))}
              <Text
                text={`${ghost[0].cols} × ${ghost[0].rows} = ${ghost.length}`}
                x={m2p(ghost[0].x)}
                y={m2p(ghost[0].y) - 30}
                fontSize={16}
                fontStyle="bold"
                fill="#1d4ed8"
              />
            </Group>
          )}

          {dragRect && editor.tool !== 'place' && (
            <>
              {editor.tool === 'calibrate' ? (
                <Line
                  points={[dragRect.a.x, dragRect.a.y, dragRect.b.x, dragRect.b.y]}
                  stroke="#dc2626"
                  strokeWidth={2.5}
                  dash={[6, 4]}
                  listening={false}
                />
              ) : (
                <Rect
                  x={Math.min(dragRect.a.x, dragRect.b.x)}
                  y={Math.min(dragRect.a.y, dragRect.b.y)}
                  width={Math.abs(dragRect.b.x - dragRect.a.x)}
                  height={Math.abs(dragRect.b.y - dragRect.a.y)}
                  stroke={editor.tool === 'stage' ? '#9333ea' : '#2563eb'}
                  strokeWidth={1.5}
                  dash={[8, 4]}
                  fill="rgba(37,99,235,0.05)"
                  listening={false}
                />
              )}
            </>
          )}
        </Layer>
      </Stage>

      {/* tool hints */}
      {editor.tool === 'wall' && (
        <Hint>Click each corner — double-click in place (or Enter) to close the room</Hint>
      )}
      {editor.tool === 'calibrate' && !scalePrompt && (
        <Hint tone="red">Drag a line across a known dimension (e.g. a 20m wall)</Hint>
      )}
      {editor.tool === 'door' && <Hint tone="green">Click on a wall — the door snaps onto it</Hint>}
      {editor.tool === 'registration' && (
        <Hint tone="sky">Click OUTSIDE the walls — the desk lives in the foyer</Hint>
      )}
      {editor.tool === 'grid' && !dragRect && (
        <Hint>Drag a rectangle — tables auto-space and auto-number as you drag</Hint>
      )}

      {scalePrompt && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30">
          <div className="w-72 rounded-lg bg-white p-4 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-900">Set scale</h3>
            <p className="mt-1 text-xs text-slate-500">How long is that line, in metres?</p>
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
                  setDragRect(null)
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

function Hint({ children, tone = 'slate' }: { children: React.ReactNode; tone?: string }) {
  const bg =
    tone === 'red'
      ? 'bg-red-700'
      : tone === 'green'
        ? 'bg-green-700'
        : tone === 'sky'
          ? 'bg-sky-700'
          : 'bg-slate-900'
  return (
    <div
      className={`absolute left-1/2 top-3 -translate-x-1/2 rounded-md ${bg} px-3 py-1.5 text-xs text-white shadow`}
    >
      {children}
    </div>
  )
}

/** Wall line with the doorway carved out when the door projects onto it. */
function WallLine({
  w,
  m2p,
  door,
  doorWidthM,
}: {
  w: { x1: number; y1: number; x2: number; y2: number }
  m2p: (m: number) => number
  door: { x: number; y: number } | null
  doorWidthM: number
}) {
  const stroke = { stroke: '#1e293b', strokeWidth: 4, lineCap: 'round' as const, listening: false }
  if (!door)
    return <Line points={[m2p(w.x1), m2p(w.y1), m2p(w.x2), m2p(w.y2)]} {...stroke} />
  const dx = w.x2 - w.x1
  const dy = w.y2 - w.y1
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return null
  const t = ((door.x - w.x1) * dx + (door.y - w.y1) * dy) / len2
  const tc = Math.max(0, Math.min(1, t))
  const onWall = Math.hypot(w.x1 + tc * dx - door.x, w.y1 + tc * dy - door.y) < 0.2
  if (!onWall)
    return <Line points={[m2p(w.x1), m2p(w.y1), m2p(w.x2), m2p(w.y2)]} {...stroke} />
  const half = doorWidthM / 2 / Math.sqrt(len2)
  const a = Math.max(0, t - half)
  const b = Math.min(1, t + half)
  return (
    <>
      {a > 0 && (
        <Line
          points={[m2p(w.x1), m2p(w.y1), m2p(w.x1 + dx * a), m2p(w.y1 + dy * a)]}
          {...stroke}
        />
      )}
      {b < 1 && (
        <Line
          points={[m2p(w.x1 + dx * b), m2p(w.y1 + dy * b), m2p(w.x2), m2p(w.y2)]}
          {...stroke}
        />
      )}
    </>
  )
}

function GhostShape({ x, y, m2p }: { x: number; y: number; m2p: (m: number) => number }) {
  const shape = useEditor((s) => s.placeShape)
  const rot = useEditor((s) => s.gridRot)
  const d = SHAPES[shape].defaults
  if (shape === 'round') return <Circle x={x} y={y} radius={m2p((d.dia ?? 1.8) / 2)} fill="#3b82f6" />
  return (
    <Rect
      x={x}
      y={y}
      offsetX={m2p((d.len ?? 2) / 2)}
      offsetY={m2p((d.wid ?? 1) / 2)}
      width={m2p(d.len ?? 2)}
      height={m2p(d.wid ?? 1)}
      rotation={rot}
      fill="#3b82f6"
      cornerRadius={3}
    />
  )
}

function TableGlyph({
  t,
  m2p,
  selected,
  unreachable,
  draggable,
  onSelect,
  onDragEnd,
}: {
  t: TableObj
  m2p: (m: number) => number
  selected: boolean
  unreachable: boolean
  draggable: boolean
  onSelect: (e: Konva.KonvaEventObject<MouseEvent>) => void
  onDragEnd: (xPx: number, yPx: number) => void
}) {
  const service = t.kind === 'service'
  const fill = selected ? '#fef3c7' : service ? '#7c2d12' : '#ffffff'
  const strokeC = selected ? '#d97706' : service ? '#9a3412' : '#334155'
  const [hx, hy] = halfExtent(t)
  const seats = seatPositions(t)
  const labelText = service ? t.label.split('—')[0].trim() : t.label

  return (
    <Group
      x={m2p(t.x)}
      y={m2p(t.y)}
      draggable={draggable}
      name="table"
      onClick={(e) => {
        e.cancelBubble = true
        onSelect(e)
      }}
      onDragEnd={(e) => onDragEnd(e.target.x(), e.target.y())}
    >
      {unreachable && (
        <Circle radius={m2p(Math.hypot(hx, hy) + 0.8)} stroke="#ef4444" strokeWidth={3} dash={[6, 4]} />
      )}
      <Group rotation={t.rot ?? 0}>
        {t.shape === 'round' && (
          <Circle radius={m2p(hx)} fill={fill} stroke={strokeC} strokeWidth={selected ? 3 : 1.5} />
        )}
        {t.shape === 'oval' && (
          <Ellipse
            radiusX={m2p(hx)}
            radiusY={m2p(hy)}
            fill={fill}
            stroke={strokeC}
            strokeWidth={selected ? 3 : 1.5}
          />
        )}
        {(t.shape === 'banquet' || t.shape === 'square' || t.shape === 'buffet') && (
          <Rect
            x={-m2p(hx)}
            y={-m2p(hy)}
            width={m2p(hx * 2)}
            height={m2p(hy * 2)}
            fill={fill}
            stroke={strokeC}
            strokeWidth={selected ? 3 : 1.5}
            cornerRadius={3}
          />
        )}
      </Group>
      {/* chairs — straight from seatPositions: 2D and 3D cannot disagree */}
      {seats.map((sp, i) => (
        <Circle
          key={i}
          x={m2p(sp.x - t.x)}
          y={m2p(sp.y - t.y)}
          radius={m2p(0.15)}
          fill={selected ? '#f59e0b' : '#94a3b8'}
          listening={false}
        />
      ))}
      <Text
        text={labelText}
        fontSize={Math.max(10, m2p(0.5))}
        fontStyle="bold"
        fill={service ? '#fdba74' : '#0f172a'}
        width={m2p(hx * 2)}
        height={m2p(hy * 2)}
        x={-m2p(hx)}
        y={-m2p(hy)}
        align="center"
        verticalAlign="middle"
        listening={false}
      />
    </Group>
  )
}
