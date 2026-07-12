import { describe, it, expect, beforeEach } from 'vitest'
import { useEditor } from './editor'

beforeEach(() => {
  useEditor.getState().reset()
})

describe('editor store — tables', () => {
  it('addTable snaps to the 0.5m grid and auto-labels', () => {
    const s = useEditor.getState()
    s.addTable(3.26, 7.74)
    s.addTable(6.0, 7.5)
    const tables = useEditor.getState().tables
    expect(tables.length).toBe(2)
    expect(tables[0].x).toBe(3.5)
    expect(tables[0].y).toBe(7.5)
    expect(tables[0].label).toBe('1')
    expect(tables[1].label).toBe('2')
    expect(tables[0].seats).toBe(10)
    expect(tables[0].diameter_m).toBe(1.8)
  })

  it('moveTable snaps', () => {
    const s = useEditor.getState()
    s.addTable(2, 2)
    const id = useEditor.getState().tables[0].id
    s.moveTable(id, 4.9, 1.1)
    const t = useEditor.getState().tables[0]
    expect(t.x).toBe(5)
    expect(t.y).toBe(1)
  })

  it('removeSelected deletes tables and clears selection', () => {
    const s = useEditor.getState()
    s.addTable(1, 1)
    s.addTable(2, 2)
    const [a] = useEditor.getState().tables
    s.setSelection([a.id])
    s.removeSelected()
    expect(useEditor.getState().tables.length).toBe(1)
    expect(useEditor.getState().selectedIds).toEqual([])
  })

  it('marks state dirty on edits and clean after markSaved', () => {
    const s = useEditor.getState()
    expect(useEditor.getState().dirty).toBe(false)
    s.addTable(1, 1)
    expect(useEditor.getState().dirty).toBe(true)
    s.markSaved()
    expect(useEditor.getState().dirty).toBe(false)
  })
})

describe('editor store — selection ops', () => {
  it('align delegates to alignTables', () => {
    const s = useEditor.getState()
    s.addTable(1, 1)
    s.addTable(3, 3)
    const ids = useEditor.getState().tables.map((t) => t.id)
    s.setSelection(ids)
    s.align('y')
    expect(useEditor.getState().tables.every((t) => t.y === 2)).toBe(true)
  })

  it('duplicateGrid grows the table set', () => {
    const s = useEditor.getState()
    s.addTable(2, 2)
    s.setSelection([useEditor.getState().tables[0].id])
    s.duplicateGrid({ rows: 2, cols: 3, gapM: 2.5 })
    expect(useEditor.getState().tables.length).toBe(6)
  })
})

describe('editor store — venue geometry', () => {
  it('builds walls from placed points', () => {
    const s = useEditor.getState()
    s.addWallPoint(0, 0)
    s.addWallPoint(10, 0)
    s.addWallPoint(10, 8)
    s.finishWall()
    const walls = useEditor.getState().walls
    expect(walls).toEqual([
      { x1: 0, y1: 0, x2: 10, y2: 0 },
      { x1: 10, y1: 0, x2: 10, y2: 8 },
    ])
    expect(useEditor.getState().draftWall).toEqual([])
  })

  it('drops zero-length segments left by a double-click duplicate point', () => {
    const s = useEditor.getState()
    s.addWallPoint(0, 0)
    s.addWallPoint(10, 0)
    s.addWallPoint(10, 0) // double-click leaves a duplicate
    s.finishWall()
    expect(useEditor.getState().walls).toEqual([{ x1: 0, y1: 0, x2: 10, y2: 0 }])
  })

  it('stores entrance and scale', () => {
    const s = useEditor.getState()
    s.setEntrance({ x: 5, y: 0, facing_deg: 180 })
    s.setScale(21.5)
    expect(useEditor.getState().entrance?.facing_deg).toBe(180)
    expect(useEditor.getState().scalePxPerM).toBe(21.5)
  })
})
