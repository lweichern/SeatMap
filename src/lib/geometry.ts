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

/**
 * Project a point onto the nearest wall segment (clamped 0..1 along it).
 * The door MUST sit on a wall — a door floating in open space is a bug.
 */
export function nearestPointOnWalls(
  walls: { x1: number; y1: number; x2: number; y2: number }[],
  px: number,
  py: number,
): { x: number; y: number; wallIndex: number; dist: number } | null {
  let best: { x: number; y: number; wallIndex: number; dist: number } | null = null
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i]
    const dx = w.x2 - w.x1
    const dy = w.y2 - w.y1
    const len2 = dx * dx + dy * dy
    if (len2 === 0) continue
    const t = Math.max(0, Math.min(1, ((px - w.x1) * dx + (py - w.y1) * dy) / len2))
    const x = w.x1 + t * dx
    const y = w.y1 + t * dy
    const d = dist(px, py, x, y)
    if (!best || d < best.dist) best = { x, y, wallIndex: i, dist: d }
  }
  return best
}
