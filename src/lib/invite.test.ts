import { describe, it, expect } from 'vitest'
import { monogram, countdown, formatDate } from './invite'

describe('monogram', () => {
  it('splits on "&"', () => {
    expect(monogram('Adam & Eve')).toBe('A·E')
  })

  it('splits on "and" (case-insensitive)', () => {
    expect(monogram('Adam and Eve')).toBe('A·E')
    expect(monogram('Adam AND Eve')).toBe('A·E')
  })

  it('splits on the CJK connector 与 with no surrounding spaces', () => {
    expect(monogram('小明与小红')).toBe('小·小')
  })

  it('tolerates extra whitespace around the connector', () => {
    expect(monogram('  Adam   &   Eve  ')).toBe('A·E')
  })

  it('falls back to a single grapheme for a single name', () => {
    expect(monogram('Adam')).toBe('A')
  })

  it('does not false-split on "and" embedded without surrounding spaces', () => {
    // "Sandra" contains "and" but not as a standalone connector.
    expect(monogram('Sandra')).toBe('S')
  })
})

describe('countdown', () => {
  const now = new Date('2026-08-25T20:00:00')

  it('decomposes a future date into days/hours/minutes (floor)', () => {
    // Aug 25 20:00 -> Aug 28 00:00 = 52h = 2d4h0m
    expect(countdown('2026-08-28', now)).toEqual({ state: 'future', days: 2, hours: 4, minutes: 0 })
  })

  it('floors partial minutes out of the decomposition', () => {
    const preciseNow = new Date('2026-08-25T20:00:30')
    // Aug 25 20:00:30 -> Aug 26 00:00:00 = 3h59m30s -> floors to 3h59m
    expect(countdown('2026-08-26', preciseNow)).toEqual({ state: 'future', days: 0, hours: 3, minutes: 59 })
  })

  it('reports "today" when now is the same local calendar date', () => {
    expect(countdown('2026-08-25', now)).toEqual({ state: 'today' })
  })

  it('reports "today" even late in the event day', () => {
    expect(countdown('2026-08-25', new Date('2026-08-25T23:59:59'))).toEqual({ state: 'today' })
  })

  it('reports "past" once now is at/after the day following the event', () => {
    expect(countdown('2026-08-20', now)).toEqual({ state: 'past' })
    expect(countdown('2026-08-24', new Date('2026-08-25T00:00:00'))).toEqual({ state: 'past' })
  })

  it('returns null for an invalid date string', () => {
    expect(countdown('not-a-date', now)).toBeNull()
    expect(countdown('', now)).toBeNull()
  })
})

describe('formatDate', () => {
  it('formats an ISO date as "D Month YYYY" via en-GB', () => {
    expect(formatDate('2026-09-12')).toBe('12 September 2026')
  })

  it('handles single-digit days without zero-padding', () => {
    expect(formatDate('2026-01-05')).toBe('5 January 2026')
  })

  it('falls back to the raw string for an invalid date', () => {
    expect(formatDate('banana')).toBe('banana')
  })
})
