'use client'

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
  const w = Math.max(...xs) + pad - minX
  const h = Math.max(...ys) + pad - minY

  return (
    <svg
      viewBox={`${minX} ${minY} ${w} ${h}`}
      className="h-full w-full"
      role="img"
      aria-label="Seating map"
      onClick={() => onSelect(null)}
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
