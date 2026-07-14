import { create } from 'zustand'
import { nearestPointOnWalls, snapToGrid } from '@/lib/geometry'
import { newTableId, nextTableNumber } from '@/lib/layout-ops'
import { SHAPES, type Shape, type Stage, type TableObj, type Wall } from '@/lib/types'

export type Tool =
  | 'select'
  | 'calibrate'
  | 'wall'
  | 'room'
  | 'door'
  | 'registration'
  | 'stage'
  | 'place'
  | 'grid'

export type GridOrder = 'rows' | 'serpentine' | 'cols'

/** Default aisle between table footprints when the grid tool auto-spaces. */
export const DEFAULT_GRID_AISLE = 2.0
/** Tools that stay usable before the scale is calibrated. */
const UNGATED: Tool[] = ['select', 'calibrate']

interface EditorState {
  venueId: string | null
  layoutId: string | null
  layoutName: string
  floorplanUrl: string | null
  scalePxPerM: number | null
  walls: Wall[]
  draftWall: { x: number; y: number }[]
  door: { x: number; y: number } | null
  doorWidthM: number
  registration: { x: number; y: number; rot?: number } | null
  stage: Stage | null
  clearM: number
  tables: TableObj[]
  tool: Tool
  placeShape: Shape
  snapOn: boolean
  gridOrder: GridOrder
  gridRot: 0 | 45 | 90
  /** The grid tool places EXACTLY rows × cols, evenly spread over the drag. */
  gridRows: number
  gridCols: number
  selectedIds: string[]
  /** Stage / registration selected for the inspector (exclusive with tables). */
  selectedFixture: 'stage' | 'registration' | null
  routeTargetId: string | null
  dirty: boolean
  past: EditorSnapshot[]
  future: EditorSnapshot[]

  reset(): void
  loadVenueLayout(data: {
    venueId: string
    layoutId: string
    layoutName: string
    floorplanUrl: string | null
    scalePxPerM: number | null
    walls: Wall[]
    door: { x: number; y: number } | null
    doorWidthM: number
    registration: { x: number; y: number; rot?: number } | null
    stage: Stage | null
    clearM: number
    tables: TableObj[]
  }): void
  markSaved(): void

  setTool(tool: Tool): void
  setScale(pxPerM: number): void
  setFloorplanUrl(url: string | null): void
  toggleSnap(): void
  setPlaceShape(shape: Shape): void
  setGridOrder(order: GridOrder): void
  setGridRot(rot: 0 | 45 | 90): void
  setGridRows(n: number): void
  setGridCols(n: number): void
  setDoorWidth(m: number): void
  setClearM(m: number): void

  addWallPoint(x: number, y: number): void
  finishWall(): void
  cancelWall(): void
  addRoomRect(x: number, y: number, w: number, h: number): void
  clearWalls(): void
  setDoor(x: number, y: number): void
  setRegistration(p: { x: number; y: number; rot?: number } | null): void
  setStage(s: Stage | null): void

  placeTable(x: number, y: number): void
  applyGrid(rect: { x: number; y: number; w: number; h: number }): void
  moveTable(id: string, x: number, y: number): void
  /** Batch move (group drag) — positions are applied as-is, no per-table snap. */
  moveTables(updates: { id: string; x: number; y: number }[]): void
  updateTable(id: string, patch: Partial<TableObj>): void
  removeSelected(): void
  setSelection(ids: string[]): void
  toggleSelection(id: string): void
  setSelectedFixture(f: 'stage' | 'registration' | null): void
  setRouteTarget(id: string | null): void

  /** Push the current geometry onto the undo stack (call BEFORE mutating). */
  checkpoint(): void
  undo(): void
  redo(): void
}

/** The undoable slice — geometry only, never UI state like tool/selection. */
export interface EditorSnapshot {
  scalePxPerM: number | null
  floorplanUrl: string | null
  walls: Wall[]
  door: { x: number; y: number } | null
  doorWidthM: number
  registration: { x: number; y: number } | null
  stage: Stage | null
  clearM: number
  tables: TableObj[]
}

const HISTORY_LIMIT = 50

function takeSnapshot(s: {
  scalePxPerM: number | null
  floorplanUrl: string | null
  walls: Wall[]
  door: { x: number; y: number } | null
  doorWidthM: number
  registration: { x: number; y: number } | null
  stage: Stage | null
  clearM: number
  tables: TableObj[]
}): EditorSnapshot {
  return {
    scalePxPerM: s.scalePxPerM,
    floorplanUrl: s.floorplanUrl,
    walls: s.walls,
    door: s.door,
    doorWidthM: s.doorWidthM,
    registration: s.registration,
    stage: s.stage,
    clearM: s.clearM,
    tables: s.tables,
  }
}

const INITIAL = {
  venueId: null,
  layoutId: null,
  layoutName: '',
  floorplanUrl: null,
  scalePxPerM: null,
  walls: [] as Wall[],
  draftWall: [] as { x: number; y: number }[],
  door: null,
  doorWidthM: 2.4,
  registration: null,
  stage: null,
  clearM: 0.25,
  tables: [] as TableObj[],
  tool: 'select' as Tool,
  placeShape: 'round' as Shape,
  snapOn: true,
  gridOrder: 'rows' as GridOrder,
  gridRot: 0 as const,
  gridRows: 3,
  gridCols: 5,
  selectedIds: [] as string[],
  selectedFixture: null,
  routeTargetId: null,
  dirty: false,
  past: [] as EditorSnapshot[],
  future: [] as EditorSnapshot[],
}

/**
 * Grid positions in NUMBERING ORDER — shared by the live ghost preview and
 * applyGrid so what you see is exactly what you get. Exactly rows × cols
 * tables, evenly spread over the dragged rectangle (half-pitch margins).
 */
export function computeGridPositions(
  rect: { x: number; y: number; w: number; h: number },
  rows: number,
  cols: number,
  order: GridOrder,
): { x: number; y: number; rows: number; cols: number }[] {
  rows = Math.max(1, Math.round(rows))
  cols = Math.max(1, Math.round(cols))
  const sx = rect.w / cols
  const sy = rect.h / rows
  const ox = rect.x + sx / 2
  const oy = rect.y + sy / 2
  const cells: [number, number][] = []
  if (order === 'cols') {
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) cells.push([r, c])
  } else {
    for (let r = 0; r < rows; r++) {
      const rowCells: [number, number][] = []
      for (let c = 0; c < cols; c++) rowCells.push([r, c])
      if (order === 'serpentine' && r % 2 === 1) rowCells.reverse()
      cells.push(...rowCells)
    }
  }
  return cells.map(([r, c]) => ({ x: ox + c * sx, y: oy + r * sy, rows, cols }))
}

function makeTable(
  shape: Shape,
  x: number,
  y: number,
  rot: number,
  tables: TableObj[],
  layoutId: string | null,
): TableObj {
  const def = SHAPES[shape]
  const base: TableObj = {
    id: newTableId(),
    layout_id: layoutId ?? '',
    shape,
    kind: def.kind,
    label: def.kind === 'seat' ? nextTableNumber(tables) : def.label,
    x,
    y,
    rot,
    ...def.defaults,
  }
  if (def.kind === 'service') delete base.seats // seats IS NULL for service
  return base
}

export const useEditor = create<EditorState>((set, get) => ({
  ...INITIAL,

  reset: () => set({ ...INITIAL }),

  loadVenueLayout: (d) =>
    set({
      ...INITIAL,
      venueId: d.venueId,
      layoutId: d.layoutId,
      layoutName: d.layoutName,
      floorplanUrl: d.floorplanUrl,
      scalePxPerM: d.scalePxPerM,
      walls: d.walls,
      door: d.door,
      doorWidthM: d.doorWidthM,
      registration: d.registration,
      stage: d.stage,
      clearM: d.clearM,
      tables: d.tables,
    }),

  markSaved: () => set({ dirty: false }),

  setTool: (tool) => {
    // ⚠️ the calibration step gates everything downstream
    if (get().scalePxPerM === null && !UNGATED.includes(tool)) return
    set({ tool, draftWall: [] })
  },

  setScale: (scalePxPerM) => {
    get().checkpoint()
    set({ scalePxPerM, dirty: true })
  },
  setFloorplanUrl: (floorplanUrl) => {
    get().checkpoint()
    set({ floorplanUrl, dirty: true })
  },
  toggleSnap: () => set((s) => ({ snapOn: !s.snapOn })),
  setPlaceShape: (placeShape) => set({ placeShape }),
  setGridOrder: (gridOrder) => set({ gridOrder }),
  setGridRot: (gridRot) => set({ gridRot }),
  setGridRows: (gridRows) => set({ gridRows: Math.max(1, Math.min(20, Math.round(gridRows))) }),
  setGridCols: (gridCols) => set({ gridCols: Math.max(1, Math.min(20, Math.round(gridCols))) }),
  setDoorWidth: (doorWidthM) => {
    get().checkpoint()
    set({ doorWidthM, dirty: true })
  },
  setClearM: (clearM) => {
    get().checkpoint()
    set({ clearM, dirty: true })
  },

  addWallPoint: (x, y) =>
    set((s) => ({
      draftWall: [...s.draftWall, s.snapOn ? { x: snapToGrid(x), y: snapToGrid(y) } : { x, y }],
    })),

  finishWall: () => {
    if (get().draftWall.length >= 2) get().checkpoint()
    set((s) => {
      const pts = s.draftWall
      if (pts.length < 2) return { draftWall: [] }
      const walls: Wall[] = [...s.walls]
      for (let i = 0; i < pts.length - 1; i++) {
        if (pts[i].x === pts[i + 1].x && pts[i].y === pts[i + 1].y) continue
        walls.push({ x1: pts[i].x, y1: pts[i].y, x2: pts[i + 1].x, y2: pts[i + 1].y })
      }
      // trace tool CLOSES the polygon
      if (pts.length >= 3) {
        const a = pts[pts.length - 1]
        const b = pts[0]
        if (a.x !== b.x || a.y !== b.y) walls.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })
      }
      return { walls, draftWall: [], dirty: true }
    })
  },

  cancelWall: () => set({ draftWall: [] }),

  addRoomRect: (x, y, w, h) => {
    get().checkpoint()
    set((s) => {
      const sn = (v: number) => (s.snapOn ? snapToGrid(v) : v)
      const x1 = sn(x)
      const y1 = sn(y)
      const x2 = sn(x + w)
      const y2 = sn(y + h)
      if (x1 === x2 || y1 === y2) return {}
      return {
        walls: [
          ...s.walls,
          { x1, y1, x2, y2: y1 },
          { x1: x2, y1, x2, y2 },
          { x1: x2, y1: y2, x2: x1, y2 },
          { x1, y1: y2, x2: x1, y2: y1 },
        ],
        dirty: true,
      }
    })
  },

  clearWalls: () => {
    get().checkpoint()
    set({ walls: [], draftWall: [], door: null, dirty: true })
  },

  setDoor: (x, y) => {
    get().checkpoint()
    set((s) => {
      // the door must sit ON a wall — project the click onto the nearest one
      const hit = nearestPointOnWalls(s.walls, x, y)
      if (!hit) return {}
      return { door: { x: hit.x, y: hit.y }, dirty: true }
    })
  },

  setRegistration: (registration) => {
    get().checkpoint()
    set({ registration, dirty: true })
  },
  setStage: (stage) => {
    get().checkpoint()
    set({ stage, dirty: true })
  },

  placeTable: (x, y) => {
    get().checkpoint()
    set((s) => {
      const px = s.snapOn ? snapToGrid(x) : x
      const py = s.snapOn ? snapToGrid(y) : y
      const t = makeTable(s.placeShape, px, py, s.gridRot, s.tables, s.layoutId)
      return { tables: [...s.tables, t], selectedIds: [t.id], dirty: true }
    })
  },

  applyGrid: (rect) => {
    get().checkpoint()
    set((s) => {
      const positions = computeGridPositions(rect, s.gridRows, s.gridCols, s.gridOrder)
      const tables = [...s.tables]
      // no per-table snapping here — even spacing beats grid alignment,
      // and the computed pitch is already perfectly regular
      for (const p of positions) {
        tables.push(makeTable(s.placeShape, p.x, p.y, s.gridRot, tables, s.layoutId))
      }
      return { tables, dirty: true }
    })
  },

  moveTable: (id, x, y) =>
    set((s) => ({
      tables: s.tables.map((t) =>
        t.id === id
          ? { ...t, x: s.snapOn ? snapToGrid(x) : x, y: s.snapOn ? snapToGrid(y) : y }
          : t,
      ),
      dirty: true,
    })),

  moveTables: (updates) =>
    set((s) => {
      const byId = new Map(updates.map((u) => [u.id, u]))
      return {
        tables: s.tables.map((t) => {
          const u = byId.get(t.id)
          return u ? { ...t, x: u.x, y: u.y } : t
        }),
        dirty: true,
      }
    }),

  updateTable: (id, patch) => {
    get().checkpoint()
    set((s) => ({
      tables: s.tables.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      dirty: true,
    }))
  },

  removeSelected: () => {
    if (get().selectedIds.length > 0) get().checkpoint()
    set((s) => ({
      tables: s.tables.filter((t) => !s.selectedIds.includes(t.id)),
      selectedIds: [],
      routeTargetId: s.selectedIds.includes(s.routeTargetId ?? '') ? null : s.routeTargetId,
      dirty: true,
    }))
  },

  setSelection: (selectedIds) => set({ selectedIds, selectedFixture: null }),

  setSelectedFixture: (selectedFixture) =>
    set({ selectedFixture, selectedIds: [], routeTargetId: null }),

  toggleSelection: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds.filter((x) => x !== id)
        : [...s.selectedIds, id],
    })),

  setRouteTarget: (routeTargetId) => set({ routeTargetId }),

  checkpoint: () =>
    set((s) => ({
      past: [...s.past.slice(-(HISTORY_LIMIT - 1)), takeSnapshot(s)],
      future: [],
    })),

  undo: () =>
    set((s) => {
      const prev = s.past[s.past.length - 1]
      if (!prev) return {}
      return {
        ...prev,
        past: s.past.slice(0, -1),
        future: [...s.future, takeSnapshot(s)],
        selectedIds: [],
        routeTargetId: null,
        draftWall: [],
        dirty: true,
      }
    }),

  redo: () =>
    set((s) => {
      const next = s.future[s.future.length - 1]
      if (!next) return {}
      return {
        ...next,
        future: s.future.slice(0, -1),
        past: [...s.past, takeSnapshot(s)],
        selectedIds: [],
        routeTargetId: null,
        draftWall: [],
        dirty: true,
      }
    }),
}))

// Debug handle for development tooling / e2e tests
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  ;(window as unknown as Record<string, unknown>).__editor = useEditor
}
