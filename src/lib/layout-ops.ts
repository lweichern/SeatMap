import { snapToGrid } from './geometry'
import type { TableObj, VenueTable } from './types'

/** Seat count that is safe to sum: service stations contribute 0, always. */
export function seatsOf(t: TableObj): number {
  return t.kind === 'service' ? 0 : (t.seats ?? 0)
}

/**
 * Next table number, walking SEATING tables only — a buffet must never
 * consume number 13, or the guest sent to Table 13 finds a tray of prawns.
 */
export function nextTableNumber(tables: TableObj[]): string {
  return nextLabel(tables.filter((t) => t.kind === 'seat').map((t) => t.label))
}

/** Smallest positive integer (as a string) not already used as a label. */
export function nextLabel(existing: string[]): string {
  const used = new Set(
    existing
      .map((l) => Number(l))
      .filter((n) => Number.isInteger(n) && n > 0),
  )
  let n = 1
  while (used.has(n)) n++
  return String(n)
}

export function newTableId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
}

type Axis = 'x' | 'y'

/** Set every selected table's axis coordinate to the selection's mean. */
export function alignTables(
  tables: VenueTable[],
  ids: string[],
  axis: Axis,
): VenueTable[] {
  const sel = tables.filter((t) => ids.includes(t.id))
  if (sel.length < 2) return tables
  // snap the mean so aligned tables stay on the 0.5m grid
  const mean = snapToGrid(sel.reduce((s, t) => s + t[axis], 0) / sel.length)
  return tables.map((t) =>
    ids.includes(t.id) ? { ...t, [axis]: mean } : t,
  )
}

/** Evenly space selected tables between the selection's min and max on the axis. */
export function distributeTables(
  tables: VenueTable[],
  ids: string[],
  axis: Axis,
): VenueTable[] {
  const sel = tables
    .filter((t) => ids.includes(t.id))
    .sort((a, b) => a[axis] - b[axis])
  if (sel.length < 3) return tables
  const min = sel[0][axis]
  const max = sel[sel.length - 1][axis]
  const step = (max - min) / (sel.length - 1)
  const target = new Map(sel.map((t, i) => [t.id, min + step * i]))
  return tables.map((t) =>
    target.has(t.id) ? { ...t, [axis]: target.get(t.id)! } : t,
  )
}

export interface GridOpts {
  rows: number
  cols: number
  gapM: number
}

/**
 * Clone the selection into a rows x cols grid. The selection itself occupies
 * the [0,0] cell; every other cell gets a copy with a fresh id + label.
 */
export function duplicateGrid(
  tables: VenueTable[],
  ids: string[],
  { rows, cols, gapM }: GridOpts,
): VenueTable[] {
  const sel = tables.filter((t) => ids.includes(t.id))
  if (sel.length === 0 || rows < 1 || cols < 1) return tables
  const out = [...tables]
  const labels = tables.map((t) => t.label)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === 0 && c === 0) continue
      for (const t of sel) {
        const label = nextLabel(labels)
        labels.push(label)
        out.push({
          ...t,
          id: newTableId(),
          label,
          x: t.x + c * gapM,
          y: t.y + r * gapM,
        })
      }
    }
  }
  return out
}
