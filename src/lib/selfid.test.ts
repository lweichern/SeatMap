import { describe, expect, it } from 'vitest'
import { matchGuests, maskPhone, normalizeName } from './selfid'
import type { Guest } from './types'

const guest = (over: Partial<Guest>): Guest => ({
  id: 'g1',
  event_id: 'e1',
  name: 'Guest',
  phone: null,
  email: null,
  party_size: 2,
  side: 'both',
  group_tag: null,
  is_vip: false,
  table_id: null,
  qr_token: null,
  checked_in_at: null,
  locked: false,
  ...over,
})

describe('normalizeName', () => {
  it('ignores case, spacing, punctuation and diacritics', () => {
    expect(normalizeName('  David  TAN ')).toBe('davidtan')
    expect(normalizeName('José-Luís')).toBe('joseluis')
    expect(normalizeName('陈美玲')).toBe('陈美玲')
  })
})

describe('maskPhone', () => {
  it('masks to last 4 digits, null when too short/absent', () => {
    expect(maskPhone('012-345 6789')).toBe('••••6789')
    expect(maskPhone('123')).toBeNull()
    expect(maskPhone(null)).toBeNull()
  })
})

describe('matchGuests', () => {
  const guests = [
    guest({ id: 'a', name: 'David Tan', phone: '012-111 2222' }),
    guest({ id: 'b', name: 'David Tan', phone: '019-333 4444' }),
    guest({ id: 'c', name: '陈美玲', phone: '019-888 7777' }),
    guest({ id: 'd', name: 'Kelly Teo', rsvp: 'no' }),
  ]

  it('matches by normalized name, both-ways contains', () => {
    expect(matchGuests(guests, 'david tan').map((g) => g.id)).toEqual(['a', 'b'])
    expect(matchGuests(guests, 'DAVID').map((g) => g.id)).toEqual(['a', 'b'])
    expect(matchGuests(guests, '陈美玲').map((g) => g.id)).toEqual(['c'])
  })

  it('last-4 digits narrow the candidates', () => {
    expect(matchGuests(guests, 'david tan', '4444').map((g) => g.id)).toEqual(['b'])
  })

  it('wrong digits fall back to name-only matches', () => {
    expect(matchGuests(guests, 'david tan', '9999').map((g) => g.id)).toEqual(['a', 'b'])
  })

  it('excludes declined guests and empty input', () => {
    expect(matchGuests(guests, 'kelly teo')).toEqual([])
    expect(matchGuests(guests, '   ')).toEqual([])
  })

  it('single-character input matches nothing', () => {
    expect(matchGuests(guests, 't')).toEqual([])
    expect(matchGuests(guests, '陈')).toEqual([])
  })
})
