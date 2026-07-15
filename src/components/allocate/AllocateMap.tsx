'use client'

import { useMemo, useRef, useState } from 'react'
import { halfExtent } from '@/lib/table-geometry'
import { seatsOf } from '@/lib/layout-ops'
import type { TableObj, Venue } from '@/lib/types'

interface Props {
  venue: Venue
  tables: TableObj[]
  /** Seated pax per table id. */
  paxByTable: Map<string, number>
  selectedId: string | null
  onSelect: (id: string | null) => void
  onDropGuest: (guestId: string, tableId: string) => void
}

/**
 * The seating board drawn as the REAL floor plan — same geometry the hall
 * editor produced, so the planner allocates guests spatially: near the
 * stage, away from the door, next to the buffet.
 */
export function AllocateMap({
  venue,
  tables,
  paxByTable,
  selectedId,
  onSelect,
  onDropGuest,
}: Props) {
  // bounds from everything visible
  const bounds = useMemo(() => {
    const xs: number[] = []
    const ys: number[] = []
    for (const w of venue.walls) xs.push(w.x1, w.x2), ys.push(w.y1, w.y2)
    for (const t of tables) xs.push(t.x), ys.push(t.y)
    if (venue.registration) xs.push(venue.registration.x), ys.push(venue.registration.y)
    if (venue.stage) {
      xs.push(venue.stage.x, venue.stage.x + venue.stage.w)
      ys.push(venue.stage.y, venue.stage.y + venue.stage.h)
    }
    if (xs.length === 0) xs.push(0, 30), ys.push(0, 20)
    const pad = 2.5
    const minX = Math.min(...xs) - pad
    const minY = Math.min(...ys) - pad
    return {
      x: minX,
      y: minY,
      w: Math.max(...xs) + pad - minX,
      h: Math.max(...ys) + pad - minY,
    }
  }, [venue, tables])

  // pan/zoom via the viewBox; null = fitted to bounds
  const [view, setView] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const vb = view ?? bounds
  const svgRef = useRef<SVGSVGElement>(null)
  const panRef = useRef<{ px: number; py: number; moved: boolean } | null>(null)
  const suppressClickRef = useRef(false)

  /** Convert a client point to map metres. */
  const toMap = (clientX: number, clientY: number) => {
    const r = svgRef.current!.getBoundingClientRect()
    return {
      x: vb.x + ((clientX - r.left) / r.width) * vb.w,
      y: vb.y + ((clientY - r.top) / r.height) * vb.h,
    }
  }

  const zoomAt = (clientX: number, clientY: number, factor: number) => {
    const pt = toMap(clientX, clientY)
    setView((prev) => {
      const cur = prev ?? bounds
      const w = Math.min(bounds.w * 1.5, Math.max(bounds.w / 10, cur.w * factor))
      const scale = w / cur.w
      const h = cur.h * scale
      return {
        x: pt.x - (pt.x - cur.x) * scale,
        y: pt.y - (pt.y - cur.y) * scale,
        w,
        h,
      }
    })
  }

  const zoomCentre = (factor: number) => {
    const r = svgRef.current?.getBoundingClientRect()
    if (r) zoomAt(r.left + r.width / 2, r.top + r.height / 2, factor)
  }

  return (
    <div className="relative h-full w-full">
      <div className="absolute right-2 top-2 z-10 flex flex-col gap-1">
        {(
          [
            ['+', () => zoomCentre(0.75), 'Zoom in'],
            ['−', () => zoomCentre(1.33), 'Zoom out'],
            ['⤢', () => setView(null), 'Fit to room'],
          ] as const
        ).map(([label, fn, title]) => (
          <button
            key={label}
            onClick={fn}
            title={title}
            className="h-7 w-7 rounded-md border border-slate-200 bg-white text-sm text-slate-600 shadow-sm hover:bg-slate-50"
          >
            {label}
          </button>
        ))}
      </div>
    <svg
      ref={svgRef}
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      className="h-full w-full touch-none"
      role="img"
      aria-label="Seating map"
      onWheel={(e) => {
        // same gestures as the hall editor: scroll pans, ⌘/Ctrl+scroll zooms
        if (e.ctrlKey || e.metaKey) {
          zoomAt(e.clientX, e.clientY, e.deltaY > 0 ? 1.08 : 0.92)
        } else {
          const r = svgRef.current!.getBoundingClientRect()
          setView((prev) => {
            const cur = prev ?? bounds
            return {
              ...cur,
              x: cur.x + (e.deltaX / r.width) * cur.w,
              y: cur.y + (e.deltaY / r.height) * cur.h,
            }
          })
        }
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        panRef.current = { px: e.clientX, py: e.clientY, moved: false }
        ;(e.target as Element).setPointerCapture?.(e.pointerId)
      }}
      onPointerMove={(e) => {
        const pan = panRef.current
        if (!pan) return
        const dx = e.clientX - pan.px
        const dy = e.clientY - pan.py
        if (!pan.moved && Math.hypot(dx, dy) < 4) return
        pan.moved = true
        const r = svgRef.current!.getBoundingClientRect()
        setView((prev) => {
          const cur = prev ?? bounds
          return {
            ...cur,
            x: cur.x - (dx / r.width) * cur.w,
            y: cur.y - (dy / r.height) * cur.h,
          }
        })
        pan.px = e.clientX
        pan.py = e.clientY
      }}
      onPointerUp={() => {
        // a real pan must not fall through as a deselect click
        const moved = panRef.current?.moved
        panRef.current = null
        if (moved) suppressClickRef.current = true
      }}
      onClick={() => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false
          return
        }
        onSelect(null)
      }}
    >
      {/* walls with the door gap */}
      {venue.walls.map((wall, i) => (
        <WallWithGap key={i} wall={wall} door={venue.door} doorWidthM={venue.door_width_m} />
      ))}

      {venue.stage && (
        <g
          transform={`rotate(${venue.stage.rot ?? 0} ${venue.stage.x + venue.stage.w / 2} ${venue.stage.y + venue.stage.h / 2})`}
        >
          <rect
            x={venue.stage.x}
            y={venue.stage.y}
            width={venue.stage.w}
            height={venue.stage.h}
            fill="rgba(147,51,234,0.12)"
            stroke="#9333ea"
            strokeWidth={0.12}
            strokeDasharray="0.5 0.3"
            rx={0.2}
          />
          <text
            x={venue.stage.x + venue.stage.w / 2}
            y={venue.stage.y + venue.stage.h / 2}
            fill="#9333ea"
            fontSize={Math.min(venue.stage.h * 0.4, 0.9)}
            fontWeight="bold"
            textAnchor="middle"
            dominantBaseline="central"
          >
            STAGE
          </text>
        </g>
      )}

      {venue.door && (
        <g>
          <circle cx={venue.door.x} cy={venue.door.y} r={0.35} fill="#10b981" />
          <text
            x={venue.door.x}
            y={venue.door.y + 1.1}
            fill="#059669"
            fontSize={0.6}
            fontWeight="bold"
            textAnchor="middle"
          >
            DOOR
          </text>
        </g>
      )}

      {venue.registration && (
        <g
          transform={`rotate(${venue.registration.rot ?? 0} ${venue.registration.x} ${venue.registration.y})`}
        >
          <rect
            x={venue.registration.x - 0.9}
            y={venue.registration.y - 0.35}
            width={1.8}
            height={0.7}
            rx={0.12}
            fill="rgba(14,165,233,0.2)"
            stroke="#0ea5e9"
            strokeWidth={0.1}
          />
          <text
            x={venue.registration.x}
            y={venue.registration.y + 1.15}
            fill="#0284c7"
            fontSize={0.55}
            fontWeight="bold"
            textAnchor="middle"
          >
            REGISTRATION
          </text>
        </g>
      )}

      {tables.map((t) => (
        <TableTarget
          key={t.id}
          t={t}
          pax={paxByTable.get(t.id) ?? 0}
          selected={t.id === selectedId}
          onSelect={onSelect}
          onDropGuest={onDropGuest}
        />
      ))}
    </svg>
    </div>
  )
}

function TableTarget({
  t,
  pax,
  selected,
  onSelect,
  onDropGuest,
}: {
  t: TableObj
  pax: number
  selected: boolean
  onSelect: (id: string) => void
  onDropGuest: (guestId: string, tableId: string) => void
}) {
  const service = t.kind === 'service'
  const seats = seatsOf(t)
  const [hx, hy] = halfExtent(t)
  const full = !service && pax >= seats
  const over = !service && pax > seats

  const fill = service
    ? '#92400e'
    : over
      ? '#fecaca'
      : full
        ? '#bbf7d0'
        : pax > 0
          ? '#e0f2fe'
          : '#ffffff'
  const stroke = selected
    ? '#d97706'
    : service
      ? '#7c2d12'
      : over
        ? '#dc2626'
        : full
          ? '#16a34a'
          : pax > 0
            ? '#0284c7'
            : '#94a3b8'

  return (
    <g
      transform={`translate(${t.x} ${t.y})`}
      className={service ? undefined : 'cursor-pointer'}
      onClick={(e) => {
        e.stopPropagation()
        if (!service) onSelect(t.id)
      }}
      onDragOver={(e) => {
        if (service) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
      }}
      onDrop={(e) => {
        if (service) return
        e.preventDefault()
        e.stopPropagation()
        const id = e.dataTransfer.getData('text/plain')
        if (id) onDropGuest(id, t.id)
      }}
    >
      <g transform={`rotate(${t.rot ?? 0})`}>
        {t.shape === 'round' && (
          <circle r={hx} fill={fill} stroke={stroke} strokeWidth={selected ? 0.22 : 0.12} />
        )}
        {t.shape === 'oval' && (
          <ellipse rx={hx} ry={hy} fill={fill} stroke={stroke} strokeWidth={selected ? 0.22 : 0.12} />
        )}
        {(t.shape === 'banquet' || t.shape === 'square' || t.shape === 'buffet') && (
          <rect
            x={-hx}
            y={-hy}
            width={hx * 2}
            height={hy * 2}
            rx={0.15}
            fill={fill}
            stroke={stroke}
            strokeWidth={selected ? 0.22 : 0.12}
          />
        )}
      </g>
      {selected && (
        <circle
          r={Math.max(hx, hy) + 0.55}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={0.15}
          strokeDasharray="0.4 0.25"
        />
      )}
      {service ? (
        <text
          fill="#fdba74"
          fontSize={0.55}
          fontWeight="bold"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {t.label.split('—')[0].trim()}
        </text>
      ) : (
        <>
          <text
            y={-0.15}
            fill="#0f172a"
            fontSize={0.8}
            fontWeight="bold"
            textAnchor="middle"
            dominantBaseline="central"
          >
            {t.label}
          </text>
          <text
            y={0.75}
            fill={over ? '#dc2626' : '#475569'}
            fontSize={0.55}
            fontWeight={over ? 'bold' : 'normal'}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {pax}/{seats}
          </text>
        </>
      )}
    </g>
  )
}

function WallWithGap({
  wall,
  door,
  doorWidthM,
}: {
  wall: { x1: number; y1: number; x2: number; y2: number }
  door: { x: number; y: number } | null
  doorWidthM: number
}) {
  const stroke = { stroke: '#334155', strokeWidth: 0.25, strokeLinecap: 'round' as const }
  if (!door) return <line x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2} {...stroke} />
  const dx = wall.x2 - wall.x1
  const dy = wall.y2 - wall.y1
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return null
  const t = ((door.x - wall.x1) * dx + (door.y - wall.y1) * dy) / len2
  const tc = Math.max(0, Math.min(1, t))
  const onSeg = Math.hypot(wall.x1 + tc * dx - door.x, wall.y1 + tc * dy - door.y) < 0.2
  if (!onSeg) return <line x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2} {...stroke} />
  const half = doorWidthM / 2 / Math.sqrt(len2)
  const a = Math.max(0, t - half)
  const b = Math.min(1, t + half)
  return (
    <g>
      {a > 0 && (
        <line x1={wall.x1} y1={wall.y1} x2={wall.x1 + dx * a} y2={wall.y1 + dy * a} {...stroke} />
      )}
      {b < 1 && (
        <line x1={wall.x1 + dx * b} y1={wall.y1 + dy * b} x2={wall.x2} y2={wall.y2} {...stroke} />
      )}
    </g>
  )
}
