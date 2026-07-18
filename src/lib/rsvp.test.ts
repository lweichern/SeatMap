import { describe, it, expect } from 'vitest'
import { mergeRsvp, type RsvpSubmission } from './rsvp'
import type { Guest } from './types'

function guest(over: Partial<Guest>): Guest {
  return {
    id: 'g1',
    event_id: 'e1',
    name: 'Uncle Lim',
    phone: '012-345 6789',
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

const sub = (over: Partial<RsvpSubmission> = {}): RsvpSubmission => ({
  name: 'Aunty Tan',
  phone: '0198765432',
  party_size: 2,
  side: 'bride',
  attending: true,
  ...over,
})

describe('mergeRsvp', () => {
  it('creates a new guest with rsvp yes', () => {
    const g = mergeRsvp([], sub(), 'e1')
    expect(g.name).toBe('Aunty Tan')
    expect(g.rsvp).toBe('yes')
    expect(g.party_size).toBe(2)
    expect(g.event_id).toBe('e1')
    expect(g.id).toBeTruthy()
  })

  it('records declines too', () => {
    const g = mergeRsvp([], sub({ attending: false }), 'e1')
    expect(g.rsvp).toBe('no')
  })

  it('matches an existing guest by phone (formatting ignored) and UPDATES them', () => {
    const existing = guest({ id: 'gx', phone: '012-345 6789', name: 'Uncle Lim', table_id: 't3' })
    const g = mergeRsvp([existing], sub({ name: 'LIM AH KOW', phone: '0123456789', party_size: 4 }), 'e1')
    expect(g.id).toBe('gx') // update, not duplicate
    expect(g.rsvp).toBe('yes')
    expect(g.party_size).toBe(4)
    expect(g.table_id).toBe('t3') // planner's seating survives
    expect(g.name).toBe('Uncle Lim') // the imported name wins over the form's
  })

  it('falls back to case-insensitive name match when no phone', () => {
    const existing = guest({ id: 'gy', phone: null, name: 'Aunty Tan' })
    const g = mergeRsvp([existing], sub({ name: '  aunty tan ', phone: '' }), 'e1')
    expect(g.id).toBe('gy')
  })

  it('same name but different phone = a different person, new guest', () => {
    const existing = guest({ id: 'gz', phone: '0111111111', name: 'Aunty Tan' })
    const g = mergeRsvp([existing], sub({ name: 'Aunty Tan', phone: '0222222222' }), 'e1')
    expect(g.id).not.toBe('gz')
  })
})

describe('mergeRsvp dietary', () => {
  const base = { name: 'Dee', phone: '', party_size: 3, side: 'both' as const, attending: true }

  it('stores normalized dietary on a new guest, omitting empties', () => {
    const g = mergeRsvp([], { ...base, dietary: { veg: 2, halal: 0, allergy: ' ' } }, 'e1')
    expect(g.dietary).toEqual({ veg: 2 })
    const none = mergeRsvp([], { ...base, dietary: { veg: 0 } }, 'e1')
    expect(none.dietary).toBeUndefined()
  })

  it('replaces existing dietary when resubmitted, keeps it when absent', () => {
    const existing = mergeRsvp([], { ...base, dietary: { veg: 1 } }, 'e1')
    const updated = mergeRsvp([existing], { ...base, dietary: { halal: 2 } }, 'e1')
    expect(updated.id).toBe(existing.id)
    expect(updated.dietary).toEqual({ halal: 2 })
    const kept = mergeRsvp([existing], { ...base }, 'e1')
    expect(kept.dietary).toEqual({ veg: 1 })
  })
})
