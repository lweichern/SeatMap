'use client'

import type { Hall3DProps } from './Hall3D'

/**
 * Top-down SVG fallback — same data, same highlighted table. Renders on
 * anything with a browser. A guest must NEVER see a blank screen.
 */
export function Hall2D(props: Hall3DProps) {
  const { widthM: w, heightM: h } = props
  const pad = 1.5

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}`}
      className="h-full w-full"
      role="img"
      aria-label="Hall map"
    >
      <rect x={0} y={0} width={w} height={h} rx={0.5} fill="#1e293b" stroke="#334155" strokeWidth={0.15} />

      {props.walls.map((wall, i) => (
        <line
          key={i}
          x1={wall.x1}
          y1={wall.y1}
          x2={wall.x2}
          y2={wall.y2}
          stroke="#64748b"
          strokeWidth={0.35}
          strokeLinecap="round"
        />
      ))}

      {props.stage && (
        <g>
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

      {props.entrance && props.tables.some((t) => t.id === props.guestTableId) && (
        <path
          d={pathD(props)}
          fill="none"
          stroke="#34d399"
          strokeWidth={0.3}
          strokeDasharray="0.7 0.4"
          strokeLinecap="round"
        />
      )}

      {props.tables.map((t) => {
        const isGuest = t.id === props.guestTableId
        const r = t.diameter_m / 2
        return (
          <g key={t.id}>
            {t.shape === 'rect' ? (
              <rect
                x={t.x - (t.w_m ?? t.diameter_m) / 2}
                y={t.y - (t.h_m ?? t.diameter_m) / 2}
                width={t.w_m ?? t.diameter_m}
                height={t.h_m ?? t.diameter_m}
                rx={0.2}
                fill={isGuest ? '#fbbf24' : '#475569'}
              />
            ) : (
              <circle cx={t.x} cy={t.y} r={r} fill={isGuest ? '#fbbf24' : '#475569'} />
            )}
            {isGuest && (
              <circle cx={t.x} cy={t.y} r={r + 0.5} fill="none" stroke="#f59e0b" strokeWidth={0.2}>
                <animate attributeName="r" values={`${r + 0.4};${r + 0.8};${r + 0.4}`} dur="1.6s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.9;0.3;0.9" dur="1.6s" repeatCount="indefinite" />
              </circle>
            )}
            <text
              x={t.x}
              y={t.y}
              fill={isGuest ? '#78350f' : '#e2e8f0'}
              fontSize={isGuest ? 1.1 : 0.8}
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {t.label}
            </text>
          </g>
        )
      })}

      {props.entrance && (
        <g>
          <circle cx={props.entrance.x} cy={props.entrance.y} r={0.5} fill="#10b981" />
          <text
            x={props.entrance.x}
            y={props.entrance.y + 1.4}
            fill="#6ee7b7"
            fontSize={0.8}
            fontWeight="bold"
            textAnchor="middle"
          >
            ENTRANCE
          </text>
        </g>
      )}
    </svg>
  )
}

function pathD(props: Hall3DProps): string {
  const e = props.entrance!
  const t = props.tables.find((x) => x.id === props.guestTableId)!
  return `M ${e.x} ${e.y} L ${e.x} ${t.y} L ${t.x} ${t.y}`
}
