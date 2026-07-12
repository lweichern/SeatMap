import { describe, it, expect } from 'vitest'
import { allocate } from './allocate'
import type { Guest, GuestConstraint, VenueTable } from './types'

let seq = 0
function guest(over: Partial<Guest> = {}): Guest {
  seq++
  return {
    id: over.id ?? `g${seq}`,
    event_id: 'e1',
    name: over.name ?? `Guest ${seq}`,
    phone: null,
    email: null,
    party_size: 1,
    side: 'both',
    group_tag: null,
    is_vip: false,
    table_id: null,
    qr_token: null,
    checked_in_at: null,
    locked: false,
    ...over,
  }
}

function table(id: string, x: number, y: number, seats = 10): VenueTable {
  return {
    id,
    layout_id: 'l1',
    label: id,
    x,
    y,
    seats,
    shape: 'round',
    diameter_m: 1.8,
  }
}

const STAGE = { x: 0, y: 0, w: 4, h: 2 }

function pair(a: string, b: string, type: GuestConstraint['type']): GuestConstraint {
  return { id: `${a}-${b}`, event_id: 'e1', guest_a_id: a, guest_b_id: b, type }
}

describe('allocate', () => {
  it('seats everyone when capacity allows', () => {
    const guests = Array.from({ length: 25 }, () => guest())
    const tables = [table('t1', 5, 5), table('t2', 10, 5), table('t3', 15, 5)]
    const r = allocate({ guests, tables, constraints: [], stage: null, seed: 1 })
    expect(r.unseated).toEqual([])
    expect(Object.keys(r.assignments).length).toBe(25)
    // capacity respected
    for (const t of tables) {
      const used = guests
        .filter((g) => r.assignments[g.id] === t.id)
        .reduce((s, g) => s + g.party_size, 0)
      expect(used).toBeLessThanOrEqual(t.seats)
    }
  })

  it('keeps must_sit_together pairs at one table', () => {
    const a = guest({ id: 'a' })
    const b = guest({ id: 'b' })
    const rest = Array.from({ length: 18 }, () => guest())
    const r = allocate({
      guests: [a, b, ...rest],
      tables: [table('t1', 5, 5), table('t2', 10, 5)],
      constraints: [pair('a', 'b', 'must_sit_together')],
      stage: null,
      seed: 2,
    })
    expect(r.assignments['a']).toBe(r.assignments['b'])
    expect(r.broken).toEqual([])
  })

  it('separates must_not_sit_together pairs', () => {
    const a = guest({ id: 'a' })
    const b = guest({ id: 'b' })
    const r = allocate({
      guests: [a, b, ...Array.from({ length: 10 }, () => guest())],
      tables: [table('t1', 5, 5), table('t2', 10, 5)],
      constraints: [pair('a', 'b', 'must_not_sit_together')],
      stage: null,
      seed: 3,
    })
    expect(r.assignments['a']).not.toBe(r.assignments['b'])
    expect(r.broken).toEqual([])
  })

  it('party_size consumes seats', () => {
    // 4 guests of party 3 = 12 pax; one table of 10 can hold at most 3 of them
    const guests = Array.from({ length: 4 }, () => guest({ party_size: 3 }))
    const r = allocate({
      guests,
      tables: [table('t1', 5, 5, 10)],
      constraints: [],
      stage: null,
      seed: 4,
    })
    const seated = guests.filter((g) => r.assignments[g.id])
    const pax = seated.reduce((s, g) => s + g.party_size, 0)
    expect(pax).toBeLessThanOrEqual(10)
    expect(r.unseated.length).toBe(1)
  })

  it('puts VIPs nearest the stage', () => {
    const vip = guest({ id: 'vip', is_vip: true })
    const plebs = Array.from({ length: 19 }, () => guest())
    const near = table('near', 1, 1)
    const far = table('far', 30, 20)
    const r = allocate({
      guests: [vip, ...plebs],
      tables: [far, near],
      constraints: [],
      stage: STAGE,
      seed: 5,
    })
    expect(r.assignments['vip']).toBe('near')
  })

  it('clusters group_tag members', () => {
    const uni = Array.from({ length: 8 }, () => guest({ group_tag: 'uni' }))
    const work = Array.from({ length: 8 }, () => guest({ group_tag: 'work' }))
    const r = allocate({
      guests: [...uni, ...work],
      tables: [table('t1', 5, 5), table('t2', 10, 5)],
      constraints: [],
      stage: null,
      seed: 6,
    })
    const uniTables = new Set(uni.map((g) => r.assignments[g.id]))
    const workTables = new Set(work.map((g) => r.assignments[g.id]))
    expect(uniTables.size).toBe(1)
    expect(workTables.size).toBe(1)
    expect([...uniTables][0]).not.toBe([...workTables][0])
  })

  it('locked guests stay where they are', () => {
    const locked = guest({ id: 'locked', locked: true, table_id: 'far' })
    const r = allocate({
      guests: [locked, ...Array.from({ length: 5 }, () => guest())],
      tables: [table('near', 1, 1), table('far', 30, 20)],
      constraints: [],
      stage: STAGE,
      seed: 7,
    })
    expect(r.assignments['locked']).toBe('far')
  })

  it('reports unsatisfiable must_not when only one table exists', () => {
    const a = guest({ id: 'a' })
    const b = guest({ id: 'b' })
    const r = allocate({
      guests: [a, b],
      tables: [table('t1', 5, 5)],
      constraints: [pair('a', 'b', 'must_not_sit_together')],
      stage: null,
      seed: 8,
    })
    expect(r.broken.length).toBe(1)
    // both still seated — surfacing beats silently dropping a guest
    expect(r.assignments['a']).toBe('t1')
    expect(r.assignments['b']).toBe('t1')
  })

  it('is deterministic for a given seed', () => {
    const guests = Array.from({ length: 30 }, () => guest())
    const tables = [table('t1', 5, 5), table('t2', 10, 5), table('t3', 15, 5), table('t4', 20, 5)]
    const r1 = allocate({ guests, tables, constraints: [], stage: null, seed: 42 })
    const r2 = allocate({ guests, tables, constraints: [], stage: null, seed: 42 })
    expect(r1.assignments).toEqual(r2.assignments)
  })

  it('handles 300 guests across 30 tables quickly', () => {
    const guests = Array.from({ length: 300 }, (_, i) =>
      guest({
        party_size: 1,
        group_tag: `grp${i % 15}`,
        is_vip: i < 10,
      }),
    )
    const tables = Array.from({ length: 30 }, (_, i) =>
      table(`t${i}`, (i % 6) * 5 + 3, Math.floor(i / 6) * 5 + 3),
    )
    const start = performance.now()
    const r = allocate({ guests, tables, constraints: [], stage: STAGE, seed: 9 })
    const ms = performance.now() - start
    expect(r.unseated).toEqual([])
    expect(ms).toBeLessThan(2000)
  })
})
