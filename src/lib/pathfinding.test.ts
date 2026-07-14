import { describe, it, expect } from 'vitest'
import { findPath } from './pathfinding'
import { blocksPoint, edgeDist } from './table-geometry'
import type { TableObj, Venue, Wall } from './types'

// Rectangular room 18×12 (walls 1..19 × 1..13), door mid-bottom,
// registration desk in the foyer below the door.
function venue(over: Partial<Venue> = {}): Venue {
  const walls: Wall[] = [
    { x1: 1, y1: 1, x2: 19, y2: 1 },
    { x1: 19, y1: 1, x2: 19, y2: 13 },
    { x1: 19, y1: 13, x2: 1, y2: 13 },
    { x1: 1, y1: 13, x2: 1, y2: 1 },
  ]
  return {
    id: 'v1',
    org_id: 'o',
    name: 'Test Hall',
    address: '',
    floorplan_url: null,
    scale_px_per_metre: 20,
    width_m: 20,
    height_m: 16,
    walls,
    door: { x: 10, y: 13 },
    door_width_m: 2.4,
    registration: { x: 10, y: 14.8 },
    stage: null,
    floorplan_north_offset_deg: null,
    clear_m: 0.25,
    ...over,
  }
}

let seq = 0
function table(x: number, y: number, over: Partial<TableObj> = {}): TableObj {
  seq++
  return {
    id: over.id ?? `t${seq}`,
    layout_id: 'l1',
    shape: 'round',
    kind: 'seat',
    label: String(seq),
    x,
    y,
    rot: 0,
    seats: 10,
    dia: 1.8,
    ...over,
  }
}

/** Does segment a→b cross any wall, more than `slack` from the door? */
function crossesWall(v: Venue, a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  for (const w of v.walls) {
    const d = segIntersect(a, b, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 })
    if (!d) continue
    if (v.door && Math.hypot(d.x - v.door.x, d.y - v.door.y) <= v.door_width_m / 2 + 0.25) continue
    return true
  }
  return false
}

function segIntersect(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number },
): { x: number; y: number } | null {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x)
  if (Math.abs(d) < 1e-12) return null
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d
  if (t < 0 || t > 1 || u < 0 || u > 1) return null
  return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) }
}

// 2 rows × 4 cols at the spec's reference spacing (3.8m)
function grid(): TableObj[] {
  seq = 0
  const out: TableObj[] = []
  for (const y of [4, 7.8]) for (const x of [4.3, 8.1, 11.9, 15.7]) out.push(table(x, y))
  return out
}

describe('findPath', () => {
  it('routes desk → door → INTERIOR table without crossing walls or tables', () => {
    const v = venue()
    const tables = grid()
    const target = tables[1] // (8.1, 4): interior — neighbours left, right, below
    const r = findPath(v, tables, target.id)!
    expect(r.ok).toBe(true)
    expect(r.path.length).toBeGreaterThan(2)
    // starts at the desk
    expect(Math.hypot(r.path[0].x - 10, r.path[0].y - 14.8)).toBeLessThan(0.5)
    // passes through the doorway
    const nearDoor = r.path.some((p) => Math.hypot(p.x - 10, p.y - 13) < v.door_width_m / 2 + 0.3)
    expect(nearDoor).toBe(true)
    // no leg crosses a wall away from the door
    for (let i = 0; i < r.path.length - 1; i++) {
      expect(crossesWall(v, r.path[i], r.path[i + 1])).toBe(false)
    }
    // no waypoint inside another table's hard footprint (tabletop, no pad)
    for (const p of r.path) {
      for (const t of tables) {
        if (t.id === target.id) continue
        expect(blocksPoint(t, p.x, p.y, -0.55)).toBe(false)
      }
    }
  })

  it('ends touching the table edge, from the ARRIVAL direction', () => {
    const v = venue()
    const tables = grid()
    const target = tables[5] // (8.1, 7.8)
    const r = findPath(v, tables, target.id)!
    expect(r.ok).toBe(true)
    const end = r.path[r.path.length - 1]
    const d = Math.hypot(end.x - target.x, end.y - target.y)
    const ang = Math.atan2(end.y - target.y, end.x - target.x)
    const stop = edgeDist(target, ang) + 0.3
    expect(d).toBeGreaterThan(stop - 0.35)
    expect(d).toBeLessThan(stop + 0.35)
  })

  it('origin falls back to the door when registration is unset', () => {
    const v = venue({ registration: null })
    const tables = grid()
    const r = findPath(v, tables, tables[0].id)!
    expect(r.ok).toBe(true)
    expect(Math.hypot(r.path[0].x - 10, r.path[0].y - 13)).toBeLessThan(1)
  })

  it('a boxed-in table reports ok:false with the loud straight-line fallback', () => {
    const v = venue()
    seq = 0
    const target = table(10, 7, { id: 'boxed' })
    const ring = [table(8, 7), table(12, 7), table(10, 5), table(10, 9)]
    const r = findPath(v, [target, ...ring], 'boxed')!
    expect(r.ok).toBe(false)
    expect(r.path.length).toBe(2) // origin → table, rendered RED by the UI
  })

  it('a tight corridor is found on the squeeze rungs of the retry ladder', () => {
    const v = venue()
    seq = 0
    // wall-to-wall line of tables with ONE 3.4m gap — blocked discs OVERLAP
    // at CLEAR=0.25 (1.75m radius each), open when the ladder drops clearance
    const barrier: TableObj[] = []
    for (const x of [2.2, 5.0, 7.8, 11.2, 14.4, 17.2]) barrier.push(table(x, 10))
    const target = table(10, 4, { id: 'far' })
    const r = findPath(v, [...barrier, target], 'far')!
    expect(r.ok).toBe(true)
    expect(r.squeeze).toBe(true)
  })

  it('the goal table does not block itself (huge table, path still arrives)', () => {
    const v = venue()
    seq = 0
    const big = table(10, 6, { id: 'big', shape: 'banquet', len: 6, wid: 1.2, dia: undefined })
    const r = findPath(v, [big], 'big')!
    expect(r.ok).toBe(true)
  })

  it('a desk INSIDE the room routes straight to the table — no door detour', () => {
    // registration inside the hall, table straight up the middle aisle
    const v = venue({ registration: { x: 10, y: 11.5 } })
    seq = 0
    const target = table(10, 4, { id: 'in' })
    const r = findPath(v, [target], 'in')!
    expect(r.ok).toBe(true)
    expect(r.doorIndex).toBe(-1) // no foyer leg
    // no waypoint anywhere near the door (10, 13)
    for (const pt of r.path) {
      expect(Math.hypot(pt.x - 10, pt.y - 13)).toBeGreaterThan(1.4)
    }
    // and the path is direct: total length close to the straight-line 7.5m
    let len = 0
    for (let i = 1; i < r.path.length; i++)
      len += Math.hypot(r.path[i].x - r.path[i - 1].x, r.path[i].y - r.path[i - 1].y)
    expect(len).toBeLessThan(10)
  })

  it('doorIndex splits foyer leg from hall leg', () => {
    const v = venue()
    const tables = grid()
    const r = findPath(v, tables, tables[1].id)!
    expect(r.doorIndex).toBeGreaterThan(0)
    expect(r.doorIndex).toBeLessThan(r.path.length - 1)
    const dp = r.path[r.doorIndex]
    expect(Math.hypot(dp.x - 10, dp.y - 13)).toBeLessThan(0.6)
  })
})
