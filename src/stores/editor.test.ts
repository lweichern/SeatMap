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

  it('fills a dragged rect with auto-spaced, row-numbered tables', () => {
    const s = useEditor.getState()
    s.setPlaceShape('round')
    // round spacing = 1.8 + 2.0 aisle = 3.8 → 15.2/3.8 = 4 cols, 7.6/3.8 = 2 rows
    s.applyGrid({ x: 2, y: 2, w: 15.2, h: 7.6 })
    const tables = useEditor.getState().tables
    expect(tables.length).toBe(8)
    expect(tables.map((t) => t.label)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8'])
    // row-major: first 4 share a y
    expect(new Set(tables.slice(0, 4).map((t) => t.y)).size).toBe(1)
  })

  it('serpentine numbering reverses odd rows', () => {
    const s = useEditor.getState()
    s.setPlaceShape('round')
    s.setGridOrder('serpentine')
    s.applyGrid({ x: 2, y: 2, w: 15.2, h: 7.6 })
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
    s.applyGrid({ x: 2, y: 2, w: 15.2, h: 7.6 })
    const tables = useEditor.getState().tables
    const col0 = tables.filter((t) => t.x === tables[0].x).sort((a, b) => a.y - b.y)
    expect(col0.map((t) => t.label)).toEqual(['1', '2'])
  })

  it('grid numbering continues after existing tables', () => {
    const s = useEditor.getState()
    s.setPlaceShape('round')
    s.placeTable(30, 30)
    s.applyGrid({ x: 2, y: 2, w: 7.6, h: 3.8 })
    const labels = useEditor.getState().tables.map((t) => t.label)
    expect(labels).toEqual(['1', '2', '3'])
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
