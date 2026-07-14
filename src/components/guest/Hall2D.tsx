'use client'

import type { Stage, TableObj, Wall } from '@/lib/types'

export interface HallViewProps {
  widthM: number
  heightM: number
  walls: Wall[]
  door: { x: number; y: number } | null
  doorWidthM: number
  registration: { x: number; y: number; rot?: number } | null
  stage: Stage | null
  tables: TableObj[]
  guestTableId: string | null
  /** Walking route waypoints (metres). Empty = no route drawn. */
  route?: { x: number; y: number }[]
  routeOk?: boolean
}

/**
 * Top-down SVG fallback — same data, same highlighted table. Renders on
 * anything with a browser. A guest must NEVER see a blank screen.
 */
export function Hall2D(props: HallViewProps) {
  const { widthM: w, heightM: h } = props
  const pad = 2.5

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}`}
      className="h-full w-full"
      role="img"
      aria-label="Hall map"
    >
      <rect x={-pad} y={-pad} width={w + pad * 2} height={h + pad * 2} fill="#0f172a" />
      <rect x={0} y={0} width={w} height={h} rx={0.5} fill="#1e293b" />

      {props.walls.map((wall, i) => (
        <WallWithGap key={i} wall={wall} door={props.door} doorWidthM={props.doorWidthM} />
      ))}

      {props.stage && (
        <g
          transform={`rotate(${props.stage.rot ?? 0} ${props.stage.x + props.stage.w / 2} ${props.stage.y + props.stage.h / 2})`}
        >
          <rect
            x={props.stage.x}
            y={props.stage.y}
            width={props.stage.w}
            height={props.stage.h}
            fill="#7c3aed"
            opacity={0.85}
            rx={0.3}
          />
          <text
            x={props.stage.x + props.stage.w / 2}
            y={props.stage.y + props.stage.h / 2}
            fill="#ddd6fe"
            fontSize={Math.min(props.stage.h * 0.5, 1.2)}
            textAnchor="middle"
            dominantBaseline="central"
            fontWeight="bold"
          >
            STAGE
          </text>
        </g>
      )}

      {props.route && props.route.length > 1 && (
        <polyline
          points={props.route.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={props.routeOk === false ? '#ef4444' : '#34d399'}
          strokeWidth={0.28}
          strokeDasharray="0.7 0.4"
          strokeLinecap="round"
        />
      )}

      {props.tables.map((t) => (
        <TableGlyph key={t.id} t={t} isGuest={t.id === props.guestTableId} />
      ))}

      {props.door && (
        <g>
          <circle cx={props.door.x} cy={props.door.y} r={0.45} fill="#10b981" />
          <text
            x={props.door.x}
            y={props.door.y + 1.3}
            fill="#6ee7b7"
            fontSize={0.75}
            fontWeight="bold"
            textAnchor="middle"
          >
            DOOR
          </text>
        </g>
      )}

      {props.registration && (
        <g
          transform={`rotate(${props.registration.rot ?? 0} ${props.registration.x} ${props.registration.y})`}
        >
          <rect
            x={props.registration.x - 0.9}
            y={props.registration.y - 0.35}
            width={1.8}
            height={0.7}
            rx={0.15}
            fill="#0ea5e9"
          />
          <text
            x={props.registration.x}
            y={props.registration.y + 1.35}
            fill="#7dd3fc"
            fontSize={0.7}
            fontWeight="bold"
            textAnchor="middle"
          >
            REGISTRATION
          </text>
        </g>
      )}
    </svg>
  )
}

/** Walls render with the doorway visibly carved out. */
function WallWithGap({
  wall,
  door,
  doorWidthM,
}: {
  wall: Wall
  door: { x: number; y: number } | null
  doorWidthM: number
}) {
  const stroke = { stroke: '#64748b', strokeWidth: 0.35, strokeLinecap: 'round' as const }
  if (!door) return <line x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2} {...stroke} />

  // project the door onto this segment; if it lands on it, split the line
  const dx = wall.x2 - wall.x1
  const dy = wall.y2 - wall.y1
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return null
  const t = ((door.x - wall.x1) * dx + (door.y - wall.y1) * dy) / len2
  const px = wall.x1 + Math.max(0, Math.min(1, t)) * dx
  const py = wall.y1 + Math.max(0, Math.min(1, t)) * dy
  const onSegment = Math.hypot(px - door.x, py - door.y) < 0.3
  if (!onSegment) return <line x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2} {...stroke} />

  const len = Math.sqrt(len2)
  const half = doorWidthM / 2 / len
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

function TableGlyph({ t, isGuest }: { t: TableObj; isGuest: boolean }) {
  const fill = isGuest ? '#fbbf24' : t.kind === 'service' ? '#92400e' : '#475569'
  const textFill = isGuest ? '#78350f' : '#e2e8f0'
  const label = t.kind === 'service' ? t.label.split('—')[0].trim() : t.label
  const r = (t.dia ?? 1.8) / 2

  return (
    <g transform={`translate(${t.x} ${t.y})`}>
      <g transform={`rotate(${t.rot ?? 0})`}>
        {t.shape === 'round' && <circle r={r} fill={fill} />}
        {t.shape === 'oval' && <ellipse rx={(t.len ?? 2.6) / 2} ry={(t.wid ?? 1.5) / 2} fill={fill} />}
        {(t.shape === 'banquet' || t.shape === 'square' || t.shape === 'buffet') && (
          <rect
            x={-(t.len ?? 2) / 2}
            y={-(t.wid ?? 1) / 2}
            width={t.len ?? 2}
            height={t.wid ?? 1}
            rx={0.15}
            fill={fill}
          />
        )}
      </g>
      {isGuest && (
        <circle r={Math.max(r, (t.len ?? 1.8) / 2) + 0.5} fill="none" stroke="#f59e0b" strokeWidth={0.2}>
          <animate attributeName="opacity" values="0.9;0.3;0.9" dur="1.6s" repeatCount="indefinite" />
        </circle>
      )}
      <text
        fill={textFill}
        fontSize={isGuest ? 1.1 : 0.7}
        fontWeight="bold"
        textAnchor="middle"
        dominantBaseline="central"
      >
        {label}
      </text>
    </g>
  )
}
