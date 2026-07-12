import { describe, it, expect } from 'vitest'
import { nextLabel, alignTables, distributeTables, duplicateGrid } from './layout-ops'
import type { VenueTable } from './types'

function table(over: Partial<VenueTable>): VenueTable {
  return {
    id: Math.random().toString(36).slice(2),
    layout_id: 'L1',
    label: '1',
    x: 0,
    y: 0,
    seats: 10,
    shape: 'round',
    diameter_m: 1.8,
    ...over,
  }
}

describe('nextLabel', () => {
  it('returns "1" for an empty layout', () => {
    expect(nextLabel([])).toBe('1')
  })

  it('returns the smallest unused positive integer', () => {
    expect(nextLabel(['1', '2', '4'])).toBe('3')
    expect(nextLabel(['1', '2', '3'])).toBe('4')
  })

  it('ignores non-numeric labels like VIP-1', () => {
    expect(nextLabel(['1', 'VIP-1', '2'])).toBe('3')
  })
})

describe('alignTables', () => {
  it('aligns selected tables to the mean y without touching others', () => {
    const a = table({ id: 'a', y: 2 })
    const b = table({ id: 'b', y: 4 })
    const c = table({ id: 'c', y: 100 })
    const out = alignTables([a, b, c], ['a', 'b'], 'y')
    expect(out.find((t) => t.id === 'a')!.y).toBe(3)
    expect(out.find((t) => t.id === 'b')!.y).toBe(3)
    expect(out.find((t) => t.id === 'c')!.y).toBe(100)
  })

  it('snaps the alignment target to the 0.5m grid', () => {
    const a = table({ id: 'a', y: 10 })
    const b = table({ id: 'b', y: 10 })
    const c = table({ id: 'c', y: 11.5 })
    const out = alignTables([a, b, c], ['a', 'b', 'c'], 'y')
    // raw mean is 10.5; already on grid — now force an off-grid mean
    const out2 = alignTables(
      [table({ id: 'p', y: 10 }), table({ id: 'q', y: 10.5 }), table({ id: 'r', y: 10.5 })],
      ['p', 'q', 'r'],
      'y',
    )
    expect(out.every((t) => t.y === 10.5)).toBe(true)
    expect(out2.every((t) => (t.y * 2) % 1 === 0)).toBe(true)
  })

  it('aligns on x when asked', () => {
    const a = table({ id: 'a', x: 1 })
    const b = table({ id: 'b', x: 3 })
    const out = alignTables([a, b], ['a', 'b'], 'x')
    expect(out.every((t) => t.x === 2)).toBe(true)
  })
})

describe('distributeTables', () => {
  it('spaces selected tables evenly between min and max on the axis', () => {
    const a = table({ id: 'a', x: 0 })
    const b = table({ id: 'b', x: 1 })
    const c = table({ id: 'c', x: 10 })
    const out = distributeTables([a, b, c], ['a', 'b', 'c'], 'x')
    const xs = out.map((t) => t.x).sort((p, q) => p - q)
    expect(xs).toEqual([0, 5, 10])
  })

  it('is a no-op for fewer than 3 selected tables', () => {
    const a = table({ id: 'a', x: 0 })
    const b = table({ id: 'b', x: 7 })
    const out = distributeTables([a, b], ['a', 'b'], 'x')
    expect(out.map((t) => t.x)).toEqual([0, 7])
  })
})

describe('duplicateGrid', () => {
  it('clones the selection into a rows x cols grid with fresh ids and labels', () => {
    const a = table({ id: 'a', label: '1', x: 2, y: 2 })
    const out = duplicateGrid([a], ['a'], { rows: 2, cols: 3, gapM: 2.5 })
    // original + (2*3 - 1) copies (the [0,0] cell is the original position)
    expect(out.length).toBe(6)
    const labels = out.map((t) => t.label)
    expect(new Set(labels).size).toBe(labels.length)
    const ids = out.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    // second column offset by gap
    const col2 = out.find((t) => t.x === 4.5 && t.y === 2)
    expect(col2).toBeDefined()
  })
})
