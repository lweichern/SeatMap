'use client'

import { Circle, Group, Line } from 'react-konva'
import type { Wall } from '@/lib/types'

interface Props {
  walls: Wall[]
  draftWall: { x: number; y: number }[]
  pxPerM: number
}

export function WallsLayer({ walls, draftWall, pxPerM }: Props) {
  return (
    <Group listening={false}>
      {walls.map((w, i) => (
        <Line
          key={i}
          points={[w.x1 * pxPerM, w.y1 * pxPerM, w.x2 * pxPerM, w.y2 * pxPerM]}
          stroke="#1e293b"
          strokeWidth={4}
          lineCap="round"
        />
      ))}
      {draftWall.length > 0 && (
        <>
          <Line
            points={draftWall.flatMap((p) => [p.x * pxPerM, p.y * pxPerM])}
            stroke="#2563eb"
            strokeWidth={3}
            dash={[8, 6]}
            lineCap="round"
          />
          {draftWall.map((p, i) => (
            <Circle
              key={i}
              x={p.x * pxPerM}
              y={p.y * pxPerM}
              radius={4}
              fill="#2563eb"
            />
          ))}
        </>
      )}
    </Group>
  )
}
