import { describe, expect, it } from 'vitest'
import {
  buildKitchenSheet,
  clampedCount,
  normalizeDietary,
  summarizeDietary,
} from './kitchen'
import type { Guest, VenueTable } from './types'

const guest = (over: Partial<Guest>): Guest => ({
  id: 'g1',
  event_id: 'e1',
  name: 'Guest',
  phone: null,
  email: null,
  party_size: 4,
  side: 'both',
  group_tag: null,
  is_vip: false,
  table_id: null,
  qr_token: null,
  checked_in_at: null,
  locked: false,
  ...over,
})

const table = (over: Partial<VenueTable>): VenueTable => ({
  id: 't1',
  layout_id: 'l1',
  label: '1',
  shape: 'round',
  kind: 'seat',
  x: 0,
  y: 0,
  rot: 0,
  seats: 10,
  dia: 1.8,
  locked: false,
  ...over,
})

describe('normalizeDietary', () => {
  it('drops zero counts and empty allergy; undefined when nothing remains', () => {
    expect(normalizeDietary({ veg: 0, halal: 0, allergy: '  ' })).toBeUndefined()
    expect(normalizeDietary(null)).toBeUndefined()
    expect(normalizeDietary({ veg: 2, halal: 0, allergy: '' })).toEqual({ veg: 2 })
    expect(normalizeDietary({ allergy: ' peanut ' })).toEqual({ allergy: 'peanut' })
  })
})

describe('clampedCount', () => {
  it('caps counts at party_size (party may shrink after RSVP)', () => {
    const g = guest({ party_size: 2, dietary: { veg: 5 } })
    expect(clampedCount(g, 'veg')).toBe(2)
    expect(clampedCount(guest({ dietary: null }), 'veg')).toBe(0)
  })
})

describe('summarizeDietary', () => {
  it('renders compact chips text', () => {
    expect(summarizeDietary({ veg: 2, child: 1 })).toBe('🌱2 · 🧒1')
    expect(summarizeDietary({})).toBe('')
    expect(summarizeDietary(undefined)).toBe('')
  })
})

describe('buildKitchenSheet', () => {
  const tables = [
    table({ id: 't2', label: '10' }),
    table({ id: 't1', label: '2' }),
    table({ id: 'svc', label: 'Buffet', kind: 'service' }),
  ]

  it('rolls up counts per table, sorts labels numerically, excludes service tables', () => {
    const guests = [
      guest({ id: 'a', table_id: 't1', party_size: 4, dietary: { veg: 2 } }),
      guest({ id: 'b', table_id: 't1', party_size: 2, dietary: { veg: 1, halal: 1 } }),
      guest({ id: 'c', table_id: 't2', party_size: 3 }),
    ]
    const s = buildKitchenSheet(tables, guests)
    expect(s.rows.map((r) => r.label)).toEqual(['2', '10'])
    expect(s.rows[0]).toMatchObject({ pax: 6, counts: { veg: 3, halal: 1, no_beef: 0, child: 0 } })
    expect(s.totals).toMatchObject({ pax: 9, counts: { veg: 3, halal: 1, no_beef: 0, child: 0 } })
  })

  it('collects allergy notes with guest names and counts them in totals', () => {
    const guests = [guest({ id: 'a', name: '陈美玲', table_id: 't1', dietary: { allergy: 'peanut' } })]
    const s = buildKitchenSheet(tables, guests)
    expect(s.rows[0].allergies).toEqual([{ guestName: '陈美玲', note: 'peanut' }])
    expect(s.totals.allergies).toBe(1)
  })

  it('buckets unassigned guests and excludes declined RSVPs entirely', () => {
    const guests = [
      guest({ id: 'a', table_id: null, party_size: 2, dietary: { halal: 1 } }),
      guest({ id: 'b', table_id: 't1', party_size: 5, rsvp: 'no', dietary: { veg: 5 } }),
    ]
    const s = buildKitchenSheet(tables, guests)
    expect(s.unassigned.pax).toBe(2)
    expect(s.unassigned.counts.halal).toBe(1)
    expect(s.totals.pax).toBe(2)
    expect(s.totals.counts.veg).toBe(0)
  })

  it('flags guests whose counts were clamped', () => {
    const guests = [guest({ id: 'a', name: 'Shrunk', table_id: 't1', party_size: 1, dietary: { veg: 3 } })]
    const s = buildKitchenSheet(tables, guests)
    expect(s.rows[0].counts.veg).toBe(1)
    expect(s.clampedGuests).toEqual(['Shrunk'])
  })
})
