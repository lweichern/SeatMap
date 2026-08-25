import { describe, it, expect } from 'vitest'
import { monogram, countdown, formatDate, splitCouple, calendarGrid, DEFAULT_LETTER } from './invite'

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

  it('decomposes a future date into days/hours/minutes/seconds (floor)', () => {
    // Aug 25 20:00 -> Aug 28 00:00 = 52h = 2d4h0m0s
    expect(countdown('2026-08-28', now)).toEqual({ state: 'future', days: 2, hours: 4, minutes: 0, seconds: 0 })
  })

  it('decomposes partial seconds correctly (no flooring into minutes)', () => {
    const preciseNow = new Date('2026-08-25T20:00:30')
    // Aug 25 20:00:30 -> Aug 26 00:00:00 = 3h59m30s
    expect(countdown('2026-08-26', preciseNow)).toEqual({ state: 'future', days: 0, hours: 3, minutes: 59, seconds: 30 })
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

describe('splitCouple', () => {
  it('splits on "&" into trimmed bride/groom', () => {
    expect(splitCouple('Adam & Eve')).toEqual({ bride: 'Adam', groom: 'Eve' })
  })

  it('splits on "and" (case-insensitive)', () => {
    expect(splitCouple('Adam and Eve')).toEqual({ bride: 'Adam', groom: 'Eve' })
    expect(splitCouple('Adam AND Eve')).toEqual({ bride: 'Adam', groom: 'Eve' })
  })

  it('splits on the CJK connector 与 with no surrounding spaces', () => {
    expect(splitCouple('小明与小红')).toEqual({ bride: '小明', groom: '小红' })
  })

  it('trims extra whitespace around the connector', () => {
    expect(splitCouple('  Adam   &   Eve  ')).toEqual({ bride: 'Adam', groom: 'Eve' })
  })

  it('returns {} when there is no connector', () => {
    expect(splitCouple('Adam')).toEqual({})
  })

  it('does not false-split on "and" embedded without surrounding spaces', () => {
    expect(splitCouple('Sandra')).toEqual({})
  })
})

describe('calendarGrid', () => {
  it('builds a Monday-first matrix for October 2026 (1 Oct 2026 is a Thursday)', () => {
    const grid = calendarGrid('2026-10-24')
    expect(grid).not.toBeNull()
    expect(grid!.monthLabel).toBe('10 / 24')
    expect(grid!.day).toBe(24)
    expect(grid!.weeks[0]).toEqual([null, null, null, 1, 2, 3, 4])
    expect(grid!.weeks).toEqual([
      [null, null, null, 1, 2, 3, 4],
      [5, 6, 7, 8, 9, 10, 11],
      [12, 13, 14, 15, 16, 17, 18],
      [19, 20, 21, 22, 23, 24, 25],
      [26, 27, 28, 29, 30, 31, null],
    ])
  })

  it('handles a February leap year', () => {
    // 2028 is a leap year: Feb 2028 has 29 days.
    const grid = calendarGrid('2028-02-29')
    expect(grid).not.toBeNull()
    expect(grid!.monthLabel).toBe('2 / 29')
    expect(grid!.day).toBe(29)
    const flat = grid!.weeks.flat()
    expect(flat.filter((d) => d === 29).length).toBe(1)
    expect(Math.max(...(flat.filter((d): d is number => d !== null)))).toBe(29)
  })

  it('returns null for an invalid date string', () => {
    expect(calendarGrid('not-a-date')).toBeNull()
    expect(calendarGrid('')).toBeNull()
  })
})

describe('DEFAULT_LETTER', () => {
  it('has 6 lines forming the reference arc', () => {
    expect(DEFAULT_LETTER).toEqual([
      'Life is a wonderful journey,',
      'and you are the most beautiful part of ours.',
      'By the time this invitation reaches you,',
      'our wedding will already be counting down.',
      'A wedding is one of the few true reunions.',
      'Long time no see — see you at our wedding.',
    ])
  })
})
