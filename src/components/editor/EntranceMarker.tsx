'use client'

import { Arrow, Circle, Group, Text } from 'react-konva'
import type { Entrance } from '@/lib/types'

interface Props {
  entrance: Entrance
  pxPerM: number
}

/** Entrance dot + arrow showing facing (degrees clockwise from north/up). */
export function EntranceMarker({ entrance, pxPerM }: Props) {
  const rad = (entrance.facing_deg * Math.PI) / 180
  const len = 1.5 * pxPerM
  const dx = Math.sin(rad) * len
  const dy = -Math.cos(rad) * len

  return (
    <Group x={entrance.x * pxPerM} y={entrance.y * pxPerM} listening={false}>
      <Circle radius={8} fill="#16a34a" stroke="#ffffff" strokeWidth={2} />
      <Arrow
        points={[0, 0, dx, dy]}
        stroke="#16a34a"
        fill="#16a34a"
        strokeWidth={3}
        pointerLength={8}
        pointerWidth={8}
      />
      <Text text="ENTRANCE" fontSize={11} fontStyle="bold" fill="#16a34a" x={12} y={-6} />
    </Group>
  )
}
