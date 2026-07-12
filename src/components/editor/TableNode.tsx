'use client'

import { Circle, Group, Rect, Text } from 'react-konva'
import type Konva from 'konva'
import type { VenueTable } from '@/lib/types'

interface Props {
  table: VenueTable
  pxPerM: number
  selected: boolean
  draggable: boolean
  onSelect: (e: Konva.KonvaEventObject<MouseEvent>) => void
  onDragEnd: (xPx: number, yPx: number) => void
}

export function TableNode({ table, pxPerM, selected, draggable, onSelect, onDragEnd }: Props) {
  const rPx = (table.diameter_m / 2) * pxPerM
  const wPx = (table.w_m ?? table.diameter_m) * pxPerM
  const hPx = (table.h_m ?? table.diameter_m) * pxPerM
  const fill = selected ? '#fef3c7' : '#ffffff'
  const stroke = selected ? '#d97706' : '#334155'

  return (
    <Group
      x={table.x * pxPerM}
      y={table.y * pxPerM}
      draggable={draggable}
      name="table"
      onClick={(e) => {
        e.cancelBubble = true
        onSelect(e)
      }}
      onTap={(e) => {
        e.cancelBubble = true
        onSelect(e as unknown as Konva.KonvaEventObject<MouseEvent>)
      }}
      onDragEnd={(e) => onDragEnd(e.target.x(), e.target.y())}
    >
      {table.shape === 'round' ? (
        <Circle radius={rPx} fill={fill} stroke={stroke} strokeWidth={selected ? 3 : 1.5} />
      ) : (
        <Rect
          x={-wPx / 2}
          y={-hPx / 2}
          width={wPx}
          height={hPx}
          fill={fill}
          stroke={stroke}
          strokeWidth={selected ? 3 : 1.5}
          cornerRadius={4}
        />
      )}
      <Text
        text={table.label}
        fontSize={Math.max(11, rPx * 0.6)}
        fontStyle="bold"
        fill="#0f172a"
        width={rPx * 2}
        height={rPx * 2}
        x={-rPx}
        y={-rPx}
        align="center"
        verticalAlign="middle"
        listening={false}
      />
      <Text
        text={`${table.seats}`}
        fontSize={Math.max(8, rPx * 0.28)}
        fill="#64748b"
        width={rPx * 2}
        x={-rPx}
        y={rPx * 0.35}
        align="center"
        listening={false}
      />
    </Group>
  )
}
