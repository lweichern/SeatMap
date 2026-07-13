import { describe, it, expect } from 'vitest'
import { edgeDist, halfExtent, outerRadius, seatPositions } from './table-geometry'
import type { TableObj } from './types'

function t(over: Partial<TableObj>): TableObj {
  return {
    id: 'x',
    layout_id: 'l',
    shape: 'round',
    kind: 'seat',
    label: '1',
    x: 10,
    y: 20,
    rot: 0,
    seats: 10,
    dia: 1.8,
    ...over,
  }
}

const CH = 0.42

describe('seatPositions', () => {
  it('round: N chairs evenly on a ring at dia/2 + chair offset', () => {
    const seats = seatPositions(t({ seats: 10 }))
    expect(seats.length).toBe(10)
    for (const s of seats) {
      expect(Math.hypot(s.x - 10, s.y - 20)).toBeCloseTo(0.9 + CH, 6)
    }
    // distinct positions
    expect(new Set(seats.map((s) => `${s.x.toFixed(3)},${s.y.toFixed(3)}`)).size).toBe(10)
  })

  it('service stations have NO chairs', () => {
    expect(
      seatPositions(t({ shape: 'buffet', kind: 'service', seats: undefined, len: 3, wid: 0.8 })),
    ).toEqual([])
  })

  it('banquet with ends: 2 end chairs on the short sides', () => {
    const seats = seatPositions(
      t({ shape: 'banquet', seats: 8, len: 2.4, wid: 0.9, dia: undefined, ends: true }),
    )
    expect(seats.length).toBe(8)
    // end chairs sit past the half-length on the x axis (rot 0)
    const endChairs = seats.filter((s) => Math.abs(s.x - 10) > 1.2)
    expect(endChairs.length).toBe(2)
  })

  it('banquet head-table (ends:false): all chairs on the long sides', () => {
    const seats = seatPositions(
      t({ shape: 'banquet', seats: 8, len: 2.4, wid: 0.9, dia: undefined, ends: false }),
    )
    expect(seats.length).toBe(8)
    for (const s of seats) {
      expect(Math.abs(s.x - 10)).toBeLessThan(1.2 + 1e-9) // never past the ends
      expect(Math.abs(s.y - 20)).toBeCloseTo(0.45 + CH, 6) // on a long side
    }
  })

  it('odd seat count puts the extra chair on one long side', () => {
    const seats = seatPositions(
      t({ shape: 'square', seats: 7, len: 1.5, wid: 1.5, dia: undefined, ends: false }),
    )
    expect(seats.length).toBe(7)
    const top = seats.filter((s) => s.y < 20)
    const bottom = seats.filter((s) => s.y > 20)
    expect(Math.abs(top.length - bottom.length)).toBe(1)
  })

  it('oval: chairs pushed along the TRUE surface normal (outside the ellipse)', () => {
    const seats = seatPositions(
      t({ shape: 'oval', seats: 12, len: 2.6, wid: 1.5, dia: undefined }),
    )
    expect(seats.length).toBe(12)
    const A = 1.3
    const B = 0.75
    for (const s of seats) {
      const lx = s.x - 10
      const ly = s.y - 20
      // strictly outside the ellipse…
      expect((lx * lx) / (A * A) + (ly * ly) / (B * B)).toBeGreaterThan(1)
      // …but within a chair's reach of it
      expect((lx * lx) / ((A + 0.7) * (A + 0.7)) + (ly * ly) / ((B + 0.7) * (B + 0.7))).toBeLessThan(1)
    }
  })

  it('rotation carries every chair with the table', () => {
    const flat = seatPositions(
      t({ shape: 'banquet', seats: 6, len: 2.4, wid: 0.9, dia: undefined, ends: false }),
    )
    const rot = seatPositions(
      t({ shape: 'banquet', seats: 6, len: 2.4, wid: 0.9, dia: undefined, ends: false, rot: 90 }),
    )
    // 90°: local (dx, dy) → world (-dy, dx)
    for (let i = 0; i < flat.length; i++) {
      const dx = flat[i].x - 10
      const dy = flat[i].y - 20
      expect(rot[i].x - 10).toBeCloseTo(-dy, 6)
      expect(rot[i].y - 20).toBeCloseTo(dx, 6)
    }
  })
})

describe('halfExtent / edgeDist', () => {
  it('round: radius in every direction', () => {
    const table = t({ dia: 1.8 })
    expect(halfExtent(table)).toEqual([0.9, 0.9])
    expect(edgeDist(table, 0)).toBeCloseTo(0.9)
    expect(edgeDist(table, 1.2)).toBeCloseTo(0.9)
  })

  it('banquet: ray exits the nearer face', () => {
    const table = t({ shape: 'banquet', len: 2.4, wid: 0.9, dia: undefined })
    expect(edgeDist(table, 0)).toBeCloseTo(1.2, 6) // along length
    expect(edgeDist(table, Math.PI / 2)).toBeCloseTo(0.45, 6) // across width
  })

  it('banquet rotated 90°: axes swap', () => {
    const table = t({ shape: 'banquet', len: 2.4, wid: 0.9, dia: undefined, rot: 90 })
    expect(edgeDist(table, 0)).toBeCloseTo(0.45, 6)
    expect(edgeDist(table, Math.PI / 2)).toBeCloseTo(1.2, 6)
  })

  it('oval: between the semi-axes', () => {
    const table = t({ shape: 'oval', len: 2.6, wid: 1.5, dia: undefined })
    expect(edgeDist(table, 0)).toBeCloseTo(1.3, 6)
    expect(edgeDist(table, Math.PI / 2)).toBeCloseTo(0.75, 6)
    const diag = edgeDist(table, Math.PI / 4)
    expect(diag).toBeGreaterThan(0.75)
    expect(diag).toBeLessThan(1.3)
  })
})

describe('outerRadius', () => {
  it('seat tables add the chair ring (0.60m)', () => {
    expect(outerRadius(t({ dia: 1.8 }))).toBeCloseTo(Math.hypot(0.9, 0.9) + 0.6, 6)
  })

  it('service stations add only the 0.35m queuing pad', () => {
    const b = t({ shape: 'buffet', kind: 'service', seats: undefined, dia: undefined, len: 3, wid: 0.8 })
    expect(outerRadius(b)).toBeCloseTo(Math.hypot(1.5, 0.4) + 0.35, 6)
  })
})
