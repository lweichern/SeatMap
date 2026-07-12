import { GRID_M } from './types'

export function mToPx(m: number, scalePxPerM: number): number {
  return m * scalePxPerM
}

export function pxToM(px: number, scalePxPerM: number): number {
  return px / scalePxPerM
}

export function snapToGrid(m: number, grid: number = GRID_M): number {
  return Math.round(m / grid) * grid
}

/**
 * Derive px-per-metre from a line the planner drags across a known
 * dimension on the floor plan ("this wall is 20 metres").
 */
export function deriveScale(linePx: number, knownMetres: number): number {
  if (linePx <= 0 || knownMetres <= 0) {
    throw new Error('Scale line and known distance must both be positive')
  }
  return linePx / knownMetres
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay)
}
