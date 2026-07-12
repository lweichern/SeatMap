import { create } from 'zustand'
import { snapToGrid } from '@/lib/geometry'
import {
  alignTables,
  distributeTables,
  duplicateGrid,
  newTableId,
  nextLabel,
  type GridOpts,
} from '@/lib/layout-ops'
import {
  TABLE_DEFAULTS,
  type Entrance,
  type Stage,
  type VenueTable,
  type Wall,
} from '@/lib/types'

export type Tool = 'select' | 'table' | 'wall' | 'entrance' | 'stage' | 'scale'

interface EditorState {
  // identity of what's being edited
  venueId: string | null
  layoutId: string | null
  layoutName: string
  // venue-level geometry (metres)
  walls: Wall[]
  draftWall: { x: number; y: number }[]
  entrance: Entrance | null
  stage: Stage | null
  floorplanUrl: string | null
  scalePxPerM: number | null
  // layout-level
  tables: VenueTable[]
  // editor UI
  tool: Tool
  selectedIds: string[]
  dirty: boolean

  reset(): void
  loadLayout(data: {
    venueId: string
    layoutId: string
    layoutName: string
    walls: Wall[]
    entrance: Entrance | null
    stage: Stage | null
    floorplanUrl: string | null
    scalePxPerM: number | null
    tables: VenueTable[]
  }): void
  markSaved(): void

  setTool(tool: Tool): void
  addTable(xM: number, yM: number): void
  moveTable(id: string, xM: number, yM: number): void
  updateTable(id: string, patch: Partial<VenueTable>): void
  removeSelected(): void
  setSelection(ids: string[]): void
  toggleSelection(id: string): void
  align(axis: 'x' | 'y'): void
  distribute(axis: 'x' | 'y'): void
  duplicateGrid(opts: GridOpts): void

  addWallPoint(xM: number, yM: number): void
  finishWall(): void
  clearWalls(): void
  setEntrance(e: Entrance | null): void
  setStage(s: Stage | null): void
  setFloorplanUrl(url: string | null): void
  setScale(pxPerM: number): void
}

const INITIAL = {
  venueId: null,
  layoutId: null,
  layoutName: '',
  walls: [] as Wall[],
  draftWall: [] as { x: number; y: number }[],
  entrance: null,
  stage: null,
  floorplanUrl: null,
  scalePxPerM: null,
  tables: [] as VenueTable[],
  tool: 'select' as Tool,
  selectedIds: [] as string[],
  dirty: false,
}

export const useEditor = create<EditorState>((set, get) => ({
  ...INITIAL,

  reset: () => set({ ...INITIAL }),

  loadLayout: (data) =>
    set({
      ...INITIAL,
      venueId: data.venueId,
      layoutId: data.layoutId,
      layoutName: data.layoutName,
      walls: data.walls,
      entrance: data.entrance,
      stage: data.stage,
      floorplanUrl: data.floorplanUrl,
      scalePxPerM: data.scalePxPerM,
      tables: data.tables,
    }),

  markSaved: () => set({ dirty: false }),

  setTool: (tool) => set({ tool }),

  addTable: (xM, yM) => {
    const { tables, layoutId } = get()
    const table: VenueTable = {
      id: newTableId(),
      layout_id: layoutId ?? '',
      label: nextLabel(tables.map((t) => t.label)),
      x: snapToGrid(xM),
      y: snapToGrid(yM),
      ...TABLE_DEFAULTS,
    }
    set({ tables: [...tables, table], selectedIds: [table.id], dirty: true })
  },

  moveTable: (id, xM, yM) =>
    set((s) => ({
      tables: s.tables.map((t) =>
        t.id === id ? { ...t, x: snapToGrid(xM), y: snapToGrid(yM) } : t,
      ),
      dirty: true,
    })),

  updateTable: (id, patch) =>
    set((s) => ({
      tables: s.tables.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      dirty: true,
    })),

  removeSelected: () =>
    set((s) => ({
      tables: s.tables.filter((t) => !s.selectedIds.includes(t.id)),
      selectedIds: [],
      dirty: true,
    })),

  setSelection: (ids) => set({ selectedIds: ids }),

  toggleSelection: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds.filter((x) => x !== id)
        : [...s.selectedIds, id],
    })),

  align: (axis) =>
    set((s) => ({
      tables: alignTables(s.tables, s.selectedIds, axis),
      dirty: true,
    })),

  distribute: (axis) =>
    set((s) => ({
      tables: distributeTables(s.tables, s.selectedIds, axis),
      dirty: true,
    })),

  duplicateGrid: (opts) =>
    set((s) => ({
      tables: duplicateGrid(s.tables, s.selectedIds, opts),
      dirty: true,
    })),

  addWallPoint: (xM, yM) =>
    set((s) => ({
      draftWall: [...s.draftWall, { x: snapToGrid(xM), y: snapToGrid(yM) }],
    })),

  finishWall: () =>
    set((s) => {
      const pts = s.draftWall
      if (pts.length < 2) return { draftWall: [] }
      const walls: Wall[] = [...s.walls]
      for (let i = 0; i < pts.length - 1; i++) {
        walls.push({ x1: pts[i].x, y1: pts[i].y, x2: pts[i + 1].x, y2: pts[i + 1].y })
      }
      return { walls, draftWall: [], dirty: true }
    }),

  clearWalls: () => set({ walls: [], draftWall: [], dirty: true }),

  setEntrance: (entrance) => set({ entrance, dirty: true }),

  setStage: (stage) => set({ stage, dirty: true }),

  setFloorplanUrl: (floorplanUrl) => set({ floorplanUrl, dirty: true }),

  setScale: (scalePxPerM) => set({ scalePxPerM, dirty: true }),
}))
