'use client'

import { Group, Rect, Text } from 'react-konva'
import type { Stage } from '@/lib/types'

interface Props {
  stage: Stage
  pxPerM: number
}

export function StageRect({ stage, pxPerM }: Props) {
  const w = stage.w * pxPerM
  const h = stage.h * pxPerM
  return (
    <Group x={stage.x * pxPerM} y={stage.y * pxPerM} listening={false}>
      <Rect
        width={w}
        height={h}
        fill="rgba(147, 51, 234, 0.15)"
        stroke="#9333ea"
        strokeWidth={2}
        dash={[10, 5]}
      />
      <Text
        text="STAGE"
        fontSize={14}
        fontStyle="bold"
        fill="#9333ea"
        width={w}
        height={h}
        align="center"
        verticalAlign="middle"
      />
    </Group>
  )
}
