import type { Dietary, Guest, VenueTable } from './types'

/** Fixed v1 category set — agreed in the spec; no custom categories. */
export const DIETARY_CATEGORIES = [
  { key: 'veg', label: 'Vegetarian', emoji: '🌱' },
  { key: 'halal', label: 'Halal', emoji: '☪️' },
  { key: 'no_beef', label: 'No beef', emoji: '🚫🥩' },
  { key: 'child', label: 'Child meal', emoji: '🧒' },
] as const

export type DietaryCountKey = (typeof DIETARY_CATEGORIES)[number]['key']

const KEYS = DIETARY_CATEGORIES.map((c) => c.key)

/** Drop zero counts and blank allergy; undefined when nothing remains. */
export function normalizeDietary(d: Dietary | null | undefined): Dietary | undefined {
  if (!d) return undefined
  const out: Dietary = {}
  for (const k of KEYS) {
    const n = d[k] ?? 0
    if (n > 0) out[k] = n
  }
  const allergy = (d.allergy ?? '').trim()
  if (allergy) out.allergy = allergy
  return Object.keys(out).length > 0 ? out : undefined
}

/** A count never exceeds the party — the party may shrink after RSVP. */
export function clampedCount(g: Guest, key: DietaryCountKey): number {
  return Math.min(g.dietary?.[key] ?? 0, g.party_size)
}

/** Compact chips text for list rows, e.g. "🌱2 · ☪️1". Empty string when none. */
export function summarizeDietary(d: Dietary | null | undefined): string {
  if (!d) return ''
  return DIETARY_CATEGORIES.filter((c) => (d[c.key] ?? 0) > 0)
    .map((c) => `${c.emoji}${d[c.key]}`)
    .join(' · ')
}

export interface KitchenRow {
  tableId: string
  label: string
  pax: number
  counts: Record<DietaryCountKey, number>
  allergies: { guestName: string; note: string }[]
}

export interface KitchenSheet {
  totals: { pax: number; counts: Record<DietaryCountKey, number>; allergies: number }
  rows: KitchenRow[]
  /** Pseudo-row for guests not yet assigned to a table. */
  unassigned: KitchenRow
  /** Names whose stored counts exceeded party_size (shown as a warning). */
  clampedGuests: string[]
}

const zeroCounts = (): Record<DietaryCountKey, number> =>
  Object.fromEntries(KEYS.map((k) => [k, 0])) as Record<DietaryCountKey, number>

const emptyRow = (tableId: string, label: string): KitchenRow => ({
  tableId,
  label,
  pax: 0,
  counts: zeroCounts(),
  allergies: [],
})

/** Numeric-aware label ordering: "2" before "10", text labels last. */
const byLabel = (a: KitchenRow, b: KitchenRow) => {
  const na = Number(a.label)
  const nb = Number(b.label)
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb
  if (!Number.isNaN(na)) return -1
  if (!Number.isNaN(nb)) return 1
  return a.label.localeCompare(b.label)
}

/**
 * Roll the guest list up into the caterer's view. Declined RSVPs are
 * excluded (they never reach seating); service tables (buffet lines) carry
 * no guests and are omitted.
 */
export function buildKitchenSheet(tables: VenueTable[], guests: Guest[]): KitchenSheet {
  const rows = new Map<string, KitchenRow>()
  for (const t of tables) {
    if (t.kind !== 'service') rows.set(t.id, emptyRow(t.id, t.label))
  }
  const unassigned = emptyRow('', 'Unassigned')
  const clampedGuests: string[] = []

  for (const g of guests) {
    if (g.rsvp === 'no') continue
    const row = (g.table_id && rows.get(g.table_id)) || unassigned
    row.pax += g.party_size
    for (const k of KEYS) {
      const clamped = clampedCount(g, k)
      if ((g.dietary?.[k] ?? 0) > clamped && !clampedGuests.includes(g.name)) {
        clampedGuests.push(g.name)
      }
      row.counts[k] += clamped
    }
    const note = (g.dietary?.allergy ?? '').trim()
    if (note) row.allergies.push({ guestName: g.name, note })
  }

  const sorted = [...rows.values()].sort(byLabel)
  const totals = { pax: unassigned.pax, counts: zeroCounts(), allergies: unassigned.allergies.length }
  for (const k of KEYS) totals.counts[k] = unassigned.counts[k]
  for (const r of sorted) {
    totals.pax += r.pax
    totals.allergies += r.allergies.length
    for (const k of KEYS) totals.counts[k] += r.counts[k]
  }

  return { totals, rows: sorted, unassigned, clampedGuests }
}
