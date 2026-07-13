import type { TableObj } from './types'

/**
 * THE SPINE. The 2D canvas, the 3D scene, and the pathfinder all import from
 * here — they physically cannot disagree about where a chair is. Do not
 * inline chair-ring maths anywhere else.
 *
 * All inputs/outputs in WORLD METRES.
 */

/** Chair offset from the table edge. */
export const CHAIR_OFFSET = 0.42
/** Chair footprint beyond its offset (how far a seated chair sticks out). */
export const CHAIR_DEPTH = 0.18
/** Standing-queue pad around service stations — no chairs, just people. */
export const SERVICE_PAD = 0.35

export interface Seat {
  x: number
  y: number
  /** Outward-facing angle (radians) — the chair back points this way. */
  a: number
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i)

/**
 * Seat positions in world metres + each chair's facing angle.
 * Service stations return []. The ONLY place chair positions are computed.
 */
export function seatPositions(t: TableObj): Seat[] {
  if (t.kind === 'service') return []
  const n = t.seats ?? 0
  if (n <= 0) return []
  const CH = CHAIR_OFFSET
  const rot = ((t.rot ?? 0) * Math.PI) / 180
  const cos = Math.cos(rot)
  const sin = Math.sin(rot)
  const toWorld = (lx: number, ly: number, la: number): Seat => ({
    x: t.x + lx * cos - ly * sin,
    y: t.y + lx * sin + ly * cos,
    a: la + rot,
  })

  if (t.shape === 'round') {
    const r = (t.dia ?? 1.8) / 2 + CH
    return range(n).map((i) => {
      const a = (i / n) * Math.PI * 2
      return { x: t.x + Math.cos(a) * r, y: t.y + Math.sin(a) * r, a }
    })
  }

  if (t.shape === 'oval') {
    // Push each seat out along the ellipse's TRUE SURFACE NORMAL — spacing
    // naively by angle bunches chairs at the flat ends.
    const A = (t.len ?? 2.6) / 2
    const B = (t.wid ?? 1.5) / 2
    return range(n).map((i) => {
      const th = (i / n) * Math.PI * 2
      const px = A * Math.cos(th)
      const py = B * Math.sin(th)
      let nx = Math.cos(th) / A
      let ny = Math.sin(th) / B
      const nl = Math.hypot(nx, ny) || 1
      nx /= nl
      ny /= nl
      return toWorld(px + nx * CH, py + ny * CH, Math.atan2(ny, nx))
    })
  }

  // Rectangular (banquet / square): seats along the LONG SIDES, optionally
  // capping the short ends. `ends: false` is the head-table case.
  const len = t.len ?? 2.4
  const wid = t.wid ?? 0.9
  const ends = t.ends ?? true
  const endSeats = ends ? Math.min(2, n) : 0
  const sideSeats = n - endSeats
  const topCount = Math.ceil(sideSeats / 2) // odd count → extra on one side
  const botCount = sideSeats - topCount
  const seats: Seat[] = []

  const alongSide = (count: number, ly: number, la: number) => {
    for (let i = 0; i < count; i++) {
      const lx = -len / 2 + (len * (i + 0.5)) / count
      seats.push(toWorld(lx, ly, la))
    }
  }
  alongSide(topCount, -(wid / 2 + CH), -Math.PI / 2)
  alongSide(botCount, wid / 2 + CH, Math.PI / 2)
  if (endSeats >= 1) seats.push(toWorld(len / 2 + CH, 0, 0))
  if (endSeats >= 2) seats.push(toWorld(-(len / 2 + CH), 0, Math.PI))
  return seats
}

/** Half-extents [hx, hy] of the tabletop in table-local space. */
export function halfExtent(t: TableObj): [number, number] {
  if (t.shape === 'round') {
    const r = (t.dia ?? 1.8) / 2
    return [r, r]
  }
  return [(t.len ?? 2) / 2, (t.wid ?? 1) / 2]
}

/**
 * Distance from centre to the table EDGE along a world-space angle. A 6m
 * banquet table has no meaningful "radius" — a circular stop distance would
 * end the walking path a metre out in mid-air.
 */
export function edgeDist(t: TableObj, ang: number): number {
  if (t.shape === 'round') return (t.dia ?? 1.8) / 2
  const a = ang - ((t.rot ?? 0) * Math.PI) / 180 // into table-local space
  const cx = Math.cos(a)
  const cy = Math.sin(a)
  const [hx, hy] = halfExtent(t)
  if (t.shape === 'oval') return 1 / Math.hypot(cx / hx, cy / hy)
  const tx = Math.abs(cx) < 1e-6 ? Infinity : hx / Math.abs(cx)
  const ty = Math.abs(cy) < 1e-6 ? Infinity : hy / Math.abs(cy)
  return Math.min(tx, ty) // whichever face the ray exits
}

/** Bounding radius including the chair ring / queuing pad. */
export function outerRadius(t: TableObj): number {
  const [hx, hy] = halfExtent(t)
  const ring = t.kind === 'service' ? SERVICE_PAD : CHAIR_OFFSET + CHAIR_DEPTH
  return Math.hypot(hx, hy) + ring
}

/** Blocking pad beyond the tabletop edge (chair ring or queue pad). */
export function blockPad(t: TableObj): number {
  return t.kind === 'service' ? SERVICE_PAD : CHAIR_OFFSET + CHAIR_DEPTH
}

/**
 * Is a world point inside this table's blocked footprint (tabletop + pad)?
 * Rectangles block as ROTATED ROUNDED-RECTANGLES — square corners over-block
 * the diagonals and seal aisles that are genuinely passable.
 */
export function blocksPoint(t: TableObj, px: number, py: number, extraPad = 0): boolean {
  const rot = ((t.rot ?? 0) * Math.PI) / 180
  const dx = px - t.x
  const dy = py - t.y
  // inverse-rotate into table-local space
  const lx = dx * Math.cos(-rot) - dy * Math.sin(-rot)
  const ly = dx * Math.sin(-rot) + dy * Math.cos(-rot)
  const pad = blockPad(t) + extraPad
  const [hx, hy] = halfExtent(t)
  if (t.shape === 'round' || t.shape === 'oval') {
    const a = hx + pad
    const b = hy + pad
    return (lx * lx) / (a * a) + (ly * ly) / (b * b) < 1
  }
  const qx = Math.max(Math.abs(lx) - hx, 0)
  const qy = Math.max(Math.abs(ly) - hy, 0)
  return qx * qx + qy * qy < pad * pad
}
