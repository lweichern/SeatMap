import { describe, it, expect } from 'vitest'
import { mToPx, pxToM, snapToGrid, deriveScale, dist } from './geometry'

describe('mToPx / pxToM', () => {
  it('converts metres to pixels with the given scale', () => {
    expect(mToPx(2, 20)).toBe(40)
    expect(mToPx(0, 20)).toBe(0)
  })

  it('round-trips m -> px -> m', () => {
    expect(pxToM(mToPx(3.7, 13.5), 13.5)).toBeCloseTo(3.7, 10)
  })
})

describe('snapToGrid', () => {
  it('snaps to nearest 0.5m by default', () => {
    expect(snapToGrid(3.26)).toBe(3.5)
    expect(snapToGrid(3.24)).toBe(3.0)
    expect(snapToGrid(0.1)).toBe(0)
  })

  it('accepts a custom grid', () => {
    expect(snapToGrid(3.26, 0.25)).toBe(3.25)
  })
})

describe('deriveScale', () => {
  it('derives px-per-metre from a measured line', () => {
    // planner drags a 400px line across a known 20m wall
    expect(deriveScale(400, 20)).toBe(20)
  })

  it('throws on non-positive inputs', () => {
    expect(() => deriveScale(0, 20)).toThrow()
    expect(() => deriveScale(400, 0)).toThrow()
    expect(() => deriveScale(-10, 5)).toThrow()
  })
})

describe('dist', () => {
  it('computes euclidean distance', () => {
    expect(dist(0, 0, 3, 4)).toBe(5)
  })
})
