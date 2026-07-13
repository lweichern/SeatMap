import { blocksPoint, edgeDist } from './table-geometry'
import type { TableObj, Venue } from './types'

/**
 * Walking routes: desk → door → table. Guests walk AROUND tables.
 *
 * CELL = 0.3 so a narrow aisle survives rasterisation. CLEAR comes from
 * venue.clear_m (default 0.25) — it encodes "how much room does a person
 * need to squeeze past a seated guest". Do the aisle arithmetic before
 * touching either (see HALL_EDITOR.md).
 */
export const CELL = 0.3
const WALL_THICK = 0.3
const STOP_GAP = 0.3

export interface Pt {
  x: number
  y: number
}

export interface RouteResult {
  path: Pt[]
  /** false = NO WALKABLE ROUTE — render RED, this is a layout bug. */
  ok: boolean
  /** true = route only exists with reduced clearance — render amber. */
  squeeze: boolean
  /** Index of the door waypoint (splits foyer leg from hall leg); -1 if none. */
  doorIndex: number
}

interface Grid {
  minX: number
  minY: number
  cols: number
  rows: number
  blocked: Uint8Array
}

const idx = (g: Grid, cx: number, cy: number) => cy * g.cols + cx
const toCell = (g: Grid, p: Pt): [number, number] => [
  Math.floor((p.x - g.minX) / CELL),
  Math.floor((p.y - g.minY) / CELL),
]
const toWorld = (g: Grid, cx: number, cy: number): Pt => ({
  x: g.minX + (cx + 0.5) * CELL,
  y: g.minY + (cy + 0.5) * CELL,
})
const inGrid = (g: Grid, cx: number, cy: number) =>
  cx >= 0 && cy >= 0 && cx < g.cols && cy < g.rows
const isBlocked = (g: Grid, cx: number, cy: number) =>
  !inGrid(g, cx, cy) || g.blocked[idx(g, cx, cy)] === 1

/**
 * Occupancy grid. Bounds include walls, tables, the DOOR and the
 * REGISTRATION DESK — the desk is outside the hall, and a bbox computed from
 * walls alone would exclude it and A* would have nowhere to start.
 */
export function buildGrid(
  venue: Venue,
  tables: TableObj[],
  clear: number,
  goalId: string | null,
): Grid {
  const xs: number[] = []
  const ys: number[] = []
  for (const w of venue.walls) xs.push(w.x1, w.x2), ys.push(w.y1, w.y2)
  for (const t of tables) xs.push(t.x - 4, t.x + 4), ys.push(t.y - 4, t.y + 4)
  if (venue.door) xs.push(venue.door.x), ys.push(venue.door.y)
  if (venue.registration) xs.push(venue.registration.x), ys.push(venue.registration.y)
  if (venue.stage) {
    xs.push(venue.stage.x, venue.stage.x + venue.stage.w)
    ys.push(venue.stage.y, venue.stage.y + venue.stage.h)
  }
  if (xs.length === 0) xs.push(0, 10), ys.push(0, 10)
  const pad = 1.5
  const minX = Math.min(...xs) - pad
  const minY = Math.min(...ys) - pad
  const cols = Math.max(1, Math.ceil((Math.max(...xs) + pad - minX) / CELL))
  const rows = Math.max(1, Math.ceil((Math.max(...ys) + pad - minY) / CELL))
  const g: Grid = { minX, minY, cols, rows, blocked: new Uint8Array(cols * rows) }

  const blockCircle = (px: number, py: number, r: number) => {
    const [c0x, c0y] = toCell(g, { x: px - r, y: py - r })
    const [c1x, c1y] = toCell(g, { x: px + r, y: py + r })
    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        if (!inGrid(g, cx, cy)) continue
        const c = toWorld(g, cx, cy)
        if (Math.hypot(c.x - px, c.y - py) <= r) g.blocked[idx(g, cx, cy)] = 1
      }
    }
  }

  // walls, skipping the door gap
  const door = venue.door
  const doorR = venue.door_width_m / 2
  for (const w of venue.walls) {
    const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1)
    const steps = Math.max(1, Math.ceil(len / (CELL / 2)))
    for (let i = 0; i <= steps; i++) {
      const px = w.x1 + ((w.x2 - w.x1) * i) / steps
      const py = w.y1 + ((w.y2 - w.y1) * i) / steps
      if (door && Math.hypot(px - door.x, py - door.y) < doorR) continue // ← the gap
      blockCircle(px, py, WALL_THICK)
    }
  }
  // Re-open the doorway: the wall thickening bleeds back in from both jambs
  // and can seal a narrow door.
  if (door) {
    const [c0x, c0y] = toCell(g, { x: door.x - doorR, y: door.y - doorR })
    const [c1x, c1y] = toCell(g, { x: door.x + doorR, y: door.y + doorR })
    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        if (!inGrid(g, cx, cy)) continue
        const c = toWorld(g, cx, cy)
        if (Math.hypot(c.x - door.x, c.y - door.y) <= doorR * 0.9)
          g.blocked[idx(g, cx, cy)] = 0
      }
    }
  }

  // stage blocks
  if (venue.stage) {
    const s = venue.stage
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const c = toWorld(g, cx, cy)
        if (
          c.x >= s.x - clear &&
          c.x <= s.x + s.w + clear &&
          c.y >= s.y - clear &&
          c.y <= s.y + s.h + clear
        )
          g.blocked[idx(g, cx, cy)] = 1
      }
    }
  }

  // tables — shape-aware; the GOAL table does not block itself
  for (const t of tables) {
    if (t.id === goalId) continue
    const [c0x, c0y] = toCell(g, { x: t.x - 5, y: t.y - 5 })
    const [c1x, c1y] = toCell(g, { x: t.x + 5, y: t.y + 5 })
    for (let cy = Math.max(0, c0y); cy <= Math.min(rows - 1, c1y); cy++) {
      for (let cx = Math.max(0, c0x); cx <= Math.min(cols - 1, c1x); cx++) {
        const c = toWorld(g, cx, cy)
        if (blocksPoint(t, c.x, c.y, clear)) g.blocked[idx(g, cx, cy)] = 1
      }
    }
  }

  return g
}

/** Nearest unblocked cell to a world point (spiral search). */
function nearestOpenCell(g: Grid, p: Pt): [number, number] | null {
  const [cx, cy] = toCell(g, p)
  for (let r = 0; r < 12; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
        if (inGrid(g, cx + dx, cy + dy) && !isBlocked(g, cx + dx, cy + dy))
          return [cx + dx, cy + dy]
      }
    }
  }
  return null
}

/** 8-directional A*, Euclidean heuristic, NO diagonal corner-cutting. */
export function solve(g: Grid, from: Pt, to: Pt): Pt[] | null {
  const start = nearestOpenCell(g, from)
  const goal = nearestOpenCell(g, to)
  if (!start || !goal) return null
  const [sx, sy] = start
  const [gx, gy] = goal
  const n = g.cols * g.rows
  const gScore = new Float64Array(n).fill(Infinity)
  const parent = new Int32Array(n).fill(-1)
  const closed = new Uint8Array(n)
  const h = (cx: number, cy: number) => Math.hypot(cx - gx, cy - gy)

  const open: number[] = [idx(g, sx, sy)]
  const f = new Float64Array(n).fill(Infinity)
  gScore[idx(g, sx, sy)] = 0
  f[idx(g, sx, sy)] = h(sx, sy)

  const DIRS = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ]

  while (open.length > 0) {
    let bi = 0
    for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i
    const cur = open.splice(bi, 1)[0]
    if (closed[cur]) continue
    closed[cur] = 1
    const cx = cur % g.cols
    const cy = Math.floor(cur / g.cols)
    if (cx === gx && cy === gy) {
      const path: Pt[] = []
      let c = cur
      while (c !== -1) {
        path.push(toWorld(g, c % g.cols, Math.floor(c / g.cols)))
        c = parent[c]
      }
      path.reverse()
      return path
    }
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx
      const ny = cy + dy
      if (isBlocked(g, nx, ny)) continue
      // no corner-cutting: a diagonal is illegal if either orthogonal
      // neighbour is blocked — in the real world that gap doesn't exist
      if (dx !== 0 && dy !== 0 && (isBlocked(g, cx + dx, cy) || isBlocked(g, cx, cy + dy)))
        continue
      const ni = idx(g, nx, ny)
      if (closed[ni]) continue
      const cost = gScore[cur] + Math.hypot(dx, dy)
      if (cost < gScore[ni]) {
        gScore[ni] = cost
        f[ni] = cost + h(nx, ny)
        parent[ni] = cur
        open.push(ni)
      }
    }
  }
  return null
}

/** Line-of-sight against the blocked grid (fine sampling). */
function los(g: Grid, a: Pt, b: Pt): boolean {
  const d = Math.hypot(b.x - a.x, b.y - a.y)
  const steps = Math.max(1, Math.ceil(d / (CELL / 3)))
  for (let i = 0; i <= steps; i++) {
    const p = { x: a.x + ((b.x - a.x) * i) / steps, y: a.y + ((b.y - a.y) * i) / steps }
    const [cx, cy] = toCell(g, p)
    if (isBlocked(g, cx, cy)) return false
  }
  return true
}

/** Drop every waypoint you can see past — staircase → real turns. */
export function stringPull(path: Pt[], g: Grid): Pt[] {
  if (path.length <= 2) return path
  const out: Pt[] = [path[0]]
  let anchor = 0
  for (let i = 2; i < path.length; i++) {
    if (!los(g, path[anchor], path[i])) {
      out.push(path[i - 1])
      anchor = i - 1
    }
  }
  out.push(path[path.length - 1])
  return out
}

function indexNearest(path: Pt[], p: Pt): number {
  let best = 0
  let bd = Infinity
  for (let i = 0; i < path.length; i++) {
    const d = Math.hypot(path[i].x - p.x, path[i].y - p.y)
    if (d < bd) {
      bd = d
      best = i
    }
  }
  return best
}

/**
 * The full route: origin (registration ?? door) → door → table.
 * Retry ladder — never fall back to a straight line silently.
 */
export function findPath(
  venue: Venue,
  tables: TableObj[],
  targetId: string,
): RouteResult | null {
  const target = tables.find((t) => t.id === targetId)
  if (!target) return null
  const origin = venue.registration ?? venue.door
  if (!origin) return null
  const from: Pt = { x: origin.x, y: origin.y }
  const to: Pt = { x: target.x, y: target.y }

  for (const [clear, squeeze] of [
    [venue.clear_m ?? 0.25, false],
    [0.12, true],
    [0.02, true],
  ] as [number, boolean][]) {
    const grid = buildGrid(venue, tables, clear, targetId)
    const raw = solve(grid, from, to)
    if (!raw) continue

    // ⚠️ Pin the door before string-pulling — the smoother only tests grid
    // cells and a diagonal can slip through the one open door cell while
    // visually cutting the corner through solid wall.
    let path: Pt[]
    let doorIndex = -1
    if (venue.door && venue.registration) {
      const doorPt: Pt = { x: venue.door.x, y: venue.door.y }
      const di = indexNearest(raw, doorPt)
      const legA = stringPull(raw.slice(0, di + 1), grid)
      const legB = stringPull(raw.slice(di), grid)
      path = [...legA.slice(0, -1), doorPt, ...legB.slice(1)]
      doorIndex = legA.length - 1
    } else {
      path = stringPull(raw, grid)
      doorIndex = venue.door ? 0 : -1
    }

    // exact start
    path[0] = from

    // Endpoint from the ARRIVAL direction (second-to-last waypoint), not the
    // straight-line bearing from the origin — when a route curves, they differ.
    if (path.length >= 2) {
      const prev = path[path.length - 2]
      const arrival = Math.atan2(to.y - prev.y, to.x - prev.x)
      const stop = edgeDist(target, arrival + Math.PI) + STOP_GAP
      // walk back from the table centre along the arrival direction
      path[path.length - 1] = {
        x: to.x - Math.cos(arrival) * stop,
        y: to.y - Math.sin(arrival) * stop,
      }
    }

    return { path, ok: true, squeeze, doorIndex }
  }

  // loud failure — the UI renders this RED with "NO WALKABLE ROUTE"
  return { path: [from, to], ok: false, squeeze: false, doorIndex: -1 }
}
