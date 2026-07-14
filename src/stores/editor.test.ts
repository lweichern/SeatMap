import { describe, it, expect, beforeEach } from 'vitest'
import { useEditor } from './editor'

beforeEach(() => {
  useEditor.getState().reset()
})

const setScale = () => useEditor.getState().setScale(20)

describe('scale gating', () => {
  it('table/wall tools are refused until the scale is calibrated', () => {
    const s = useEditor.getState()
    s.setTool('place')
    expect(useEditor.getState().tool).toBe('select') // refused
    s.setTool('wall')
    expect(useEditor.getState().tool).toBe('select')
    setScale()
    useEditor.getState().setTool('place')
    expect(useEditor.getState().tool).toBe('place')
  })
})

describe('walls', () => {
  beforeEach(setScale)

  it('trace CLOSES the polygon on finish', () => {
    const s = useEditor.getState()
    s.addWallPoint(0, 0)
    s.addWallPoint(10, 0)
    s.addWallPoint(10, 8)
    s.finishWall()
    const walls = useEditor.getState().walls
    expect(walls.length).toBe(3) // 2 segments + the closing edge
    expect(walls[2]).toEqual({ x1: 10, y1: 8, x2: 0, y2: 0 })
  })

  it('two points make one open segment (no degenerate closer)', () => {
    const s = useEditor.getState()
    s.addWallPoint(0, 0)
    s.addWallPoint(10, 0)
    s.finishWall()
    expect(useEditor.getState().walls.length).toBe(1)
  })

  it('rectangle room = 4 walls in one gesture', () => {
    useEditor.getState().addRoomRect(2, 2, 16, 10)
    const walls = useEditor.getState().walls
    expect(walls.length).toBe(4)
    expect(walls[0]).toEqual({ x1: 2, y1: 2, x2: 18, y2: 2 })
    expect(walls[2]).toEqual({ x1: 18, y1: 12, x2: 2, y2: 12 })
  })
})

describe('door', () => {
  beforeEach(() => {
    setScale()
    useEditor.getState().addRoomRect(0, 0, 20, 12)
  })

  it('snaps onto the nearest wall segment', () => {
    useEditor.getState().setDoor(9.7, 12.9) // near the bottom wall
    const door = useEditor.getState().door
    expect(door).not.toBeNull()
    expect(door!.y).toBeCloseTo(12, 6) // projected ONTO the wall
    expect(door!.x).toBeCloseTo(9.7, 6)
  })

  it('is refused when there are no walls', () => {
    useEditor.getState().reset()
    setScale()
    useEditor.getState().setDoor(5, 5)
    expect(useEditor.getState().door).toBeNull()
  })
})

describe('placing tables', () => {
  beforeEach(setScale)

  it('seating tables get auto-numbers; service objects never consume one', () => {
    const s = useEditor.getState()
    s.setPlaceShape('round')
    s.placeTable(5, 5)
    s.placeTable(9, 5)
    s.setPlaceShape('buffet')
    s.placeTable(14, 5)
    s.setPlaceShape('round')
    s.placeTable(5, 9)
    const tables = useEditor.getState().tables
    expect(tables.map((t) => t.label)).toEqual(['1', '2', 'Buffet', '3'])
    expect(tables[2].kind).toBe('service')
    expect(tables[2].seats).toBeUndefined()
  })

  it('snaps to the 0.5m grid when snap is on, not when off', () => {
    const s = useEditor.getState()
    s.setPlaceShape('round')
    s.placeTable(5.26, 5.26)
    expect(useEditor.getState().tables[0].x).toBe(5.5)
    s.toggleSnap()
    s.placeTable(9.26, 5.26)
    expect(useEditor.getState().tables[1].x).toBeCloseTo(9.26)
  })
})

describe('grid tool', () => {
  beforeEach(setScale)

  it('places EXACTLY rows × cols tables, evenly spread over the rect', () => {
    const s = useEditor.getState()
    s.setPlaceShape('round')
    s.setGridRows(2)
    s.setGridCols(4)
    s.applyGrid({ x: 2, y: 2, w: 16, h: 8 })
    const tables = useEditor.getState().tables
    expect(tables.length).toBe(8)
    expect(tables.map((t) => t.label)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8'])
    // row-major: first 4 share a y
    const row0 = tables.slice(0, 4)
    expect(new Set(row0.map((t) => t.y)).size).toBe(1)
    // even spacing: pitch = 16/4 = 4, half-pitch margin → x = 4, 8, 12, 16
    expect(row0.map((t) => t.x)).toEqual([4, 8, 12, 16])
    // rows: pitch 8/2 = 4 → y = 4, 8
    expect(tables[0].y).toBe(4)
    expect(tables[4].y).toBe(8)
  })

  it('the count is honoured regardless of how big the rectangle is', () => {
    const s = useEditor.getState()
    s.setPlaceShape('round')
    s.setGridRows(5)
    s.setGridCols(6)
    s.applyGrid({ x: 0, y: 0, w: 9, h: 6 }) // tiny rect, still 30 tables
    expect(useEditor.getState().tables.length).toBe(30)
  })

  it('serpentine numbering reverses odd rows', () => {
    const s = useEditor.getState()
    s.setPlaceShape('round')
    s.setGridOrder('serpentine')
    s.setGridRows(2)
    s.setGridCols(4)
    s.applyGrid({ x: 2, y: 2, w: 16, h: 8 })
    const tables = useEditor.getState().tables
    const row0 = tables.filter((t) => t.y === tables[0].y).sort((a, b) => a.x - b.x)
    const row1 = tables.filter((t) => t.y !== tables[0].y).sort((a, b) => a.x - b.x)
    expect(row0.map((t) => t.label)).toEqual(['1', '2', '3', '4'])
    expect(row1.map((t) => t.label)).toEqual(['8', '7', '6', '5'])
  })

  it('column-major numbering goes down the columns', () => {
    const s = useEditor.getState()
    s.setPlaceShape('round')
    s.setGridOrder('cols')
    s.setGridRows(2)
    s.setGridCols(4)
    s.applyGrid({ x: 2, y: 2, w: 16, h: 8 })
    const tables = useEditor.getState().tables
    const col0 = tables.filter((t) => t.x === tables[0].x).sort((a, b) => a.y - b.y)
    expect(col0.map((t) => t.label)).toEqual(['1', '2'])
  })

  it('grid numbering continues after existing tables', () => {
    const s = useEditor.getState()
    s.setPlaceShape('round')
    s.placeTable(30, 30)
    s.setGridRows(1)
    s.setGridCols(2)
    s.applyGrid({ x: 2, y: 2, w: 8, h: 4 })
    const labels = useEditor.getState().tables.map((t) => t.label)
    expect(labels).toEqual(['1', '2', '3'])
  })
})

describe('undo / redo', () => {
  beforeEach(setScale)

  it('undo removes a placed table; redo restores it', () => {
    const s = useEditor.getState()
    s.setPlaceShape('round')
    s.placeTable(5, 5)
    expect(useEditor.getState().tables.length).toBe(1)
    s.undo()
    expect(useEditor.getState().tables.length).toBe(0)
    s.redo()
    expect(useEditor.getState().tables.length).toBe(1)
    expect(useEditor.getState().tables[0].label).toBe('1')
  })

  it('a whole grid placement is ONE undo step', () => {
    const s = useEditor.getState()
    s.setPlaceShape('round')
    s.setGridRows(2)
    s.setGridCols(3)
    s.applyGrid({ x: 2, y: 2, w: 12, h: 8 })
    expect(useEditor.getState().tables.length).toBe(6)
    s.undo()
    expect(useEditor.getState().tables.length).toBe(0)
  })

  it('undo restores an inspector edit and a delete', () => {
    const s = useEditor.getState()
    s.setPlaceShape('round')
    s.placeTable(5, 5)
    const id = useEditor.getState().tables[0].id
    s.updateTable(id, { seats: 6 })
    expect(useEditor.getState().tables[0].seats).toBe(6)
    s.undo()
    expect(useEditor.getState().tables[0].seats).toBe(10)
    s.setSelection([id])
    s.removeSelected()
    expect(useEditor.getState().tables.length).toBe(0)
    s.undo()
    expect(useEditor.getState().tables.length).toBe(1)
  })

  it('undo covers venue geometry (door / stage / walls)', () => {
    const s = useEditor.getState()
    s.addRoomRect(0, 0, 20, 12)
    s.setDoor(10, 12.4)
    expect(useEditor.getState().door).not.toBeNull()
    s.undo()
    expect(useEditor.getState().door).toBeNull()
    s.undo()
    expect(useEditor.getState().walls.length).toBe(0)
  })

  it('a new action clears the redo stack', () => {
    const s = useEditor.getState()
    s.setPlaceShape('round')
    s.placeTable(5, 5)
    s.undo()
    s.placeTable(9, 5)
    expect(useEditor.getState().future.length).toBe(0)
    s.redo() // noop
    expect(useEditor.getState().tables.length).toBe(1)
  })

  it('undo with an empty history is a safe no-op', () => {
    useEditor.getState().undo()
    expect(useEditor.getState().tables.length).toBe(0)
  })
})

describe('tool escape', () => {
  it('setTool back to select is always allowed', () => {
    setScale()
    const s = useEditor.getState()
    s.setTool('place')
    expect(useEditor.getState().tool).toBe('place')
    s.setTool('select')
    expect(useEditor.getState().tool).toBe('select')
  })
})

describe('copy / paste', () => {
  beforeEach(setScale)

  it('pastes clones with fresh ids and fresh table numbers', () => {
    const s = useEditor.getState()
    s.setPlaceShape('round')
    s.placeTable(5, 5)
    s.placeTable(9, 5)
    const ids = useEditor.getState().tables.map((t) => t.id)
    s.setSelection(ids)
    s.copySelection()
    s.pasteClipboard()
    const tables = useEditor.getState().tables
    expect(tables.length).toBe(4)
    expect(tables.map((t) => t.label)).toEqual(['1', '2', '3', '4'])
    expect(new Set(tables.map((t) => t.id)).size).toBe(4)
    // default paste offsets +1m,+1m and keeps relative layout
    expect(tables[2].x).toBe(6)
    expect(tables[3].x - tables[2].x).toBe(4)
    // pasted copies become the selection
    expect(useEditor.getState().selectedIds).toEqual([tables[2].id, tables[3].id])
  })

  it('pastes at a point: centroid moves there, relative layout intact', () => {
    const s = useEditor.getState()
    s.setPlaceShape('round')
    s.placeTable(4, 4)
    s.placeTable(8, 4)
    s.setSelection(useEditor.getState().tables.map((t) => t.id))
    s.copySelection()
    s.pasteClipboard({ x: 20, y: 10 }) // centroid (6,4) → (20,10)
    const pasted = useEditor.getState().tables.slice(2)
    expect(pasted[0].x).toBe(18)
    expect(pasted[1].x).toBe(22)
    expect(pasted[0].y).toBe(10)
  })

  it('service copies keep their name and never take a table number', () => {
    const s = useEditor.getState()
    s.setPlaceShape('buffet')
    s.placeTable(5, 5)
    const id = useEditor.getState().tables[0].id
    s.updateTable(id, { label: 'Buffet — Seafood' })
    s.setSelection([id])
    s.copySelection()
    s.pasteClipboard()
    const tables = useEditor.getState().tables
    expect(tables[1].label).toBe('Buffet — Seafood')
    expect(tables[1].seats).toBeUndefined()
    s.setPlaceShape('round')
    s.placeTable(15, 15)
    expect(useEditor.getState().tables[2].label).toBe('1') // numbers untouched
  })

  it('paste is one undo step', () => {
    const s = useEditor.getState()
    s.setPlaceShape('round')
    s.placeTable(5, 5)
    s.setSelection([useEditor.getState().tables[0].id])
    s.copySelection()
    s.pasteClipboard()
    s.pasteClipboard()
    expect(useEditor.getState().tables.length).toBe(3)
    s.undo()
    expect(useEditor.getState().tables.length).toBe(2)
    s.undo()
    expect(useEditor.getState().tables.length).toBe(1)
  })

  it('paste with an empty clipboard is a no-op', () => {
    const before = useEditor.getState().past.length
    useEditor.getState().pasteClipboard()
    expect(useEditor.getState().tables.length).toBe(0)
    expect(useEditor.getState().past.length).toBe(before) // no phantom undo step
  })
})

describe('inspector edits', () => {
  beforeEach(setScale)

  it('updateTable patches and re-derives nothing it should not', () => {
    const s = useEditor.getState()
    s.setPlaceShape('banquet')
    s.placeTable(5, 5)
    const id = useEditor.getState().tables[0].id
    s.updateTable(id, { seats: 6, rot: 45 })
    const t = useEditor.getState().tables[0]
    expect(t.seats).toBe(6)
    expect(t.rot).toBe(45)
    expect(t.kind).toBe('seat')
  })
})
