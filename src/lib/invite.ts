/** Splits couple names on "&" / "and" (spaced) or the CJK connector 与 (unspaced). */
const CONNECTOR = /\s+(?:&|and)\s+|与/i

/** Shared splitting logic behind `monogram` and `splitCouple`. */
function splitSides(coupleNames: string): string[] {
  return coupleNames
    .split(CONNECTOR)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** "Adam & Eve" → "A·E"; "小明与小红" → "小·小"; single name → single grapheme. */
export function monogram(coupleNames: string): string {
  const sides = splitSides(coupleNames)
  return sides
    .map((s) => ([...s][0] ?? '').toUpperCase())
    .join('·')
}

/** "Adam & Eve" → {bride: 'Adam', groom: 'Eve'}; no connector → {}. */
export function splitCouple(coupleNames: string): { bride?: string; groom?: string } {
  const sides = splitSides(coupleNames)
  if (sides.length !== 2) return {}
  return { bride: sides[0], groom: sides[1] }
}

export type CountdownState =
  | { state: 'future'; days: number; hours: number; minutes: number; seconds: number }
  | { state: 'today' }
  | { state: 'past' }

/** eventDate "YYYY-MM-DD" local midnight target; invalid → null. */
export function countdown(eventDate: string, now: Date): CountdownState | null {
  const target = new Date(`${eventDate}T00:00:00`)
  if (isNaN(target.getTime())) return null

  const sameLocalDate =
    now.getFullYear() === target.getFullYear() &&
    now.getMonth() === target.getMonth() &&
    now.getDate() === target.getDate()
  if (sameLocalDate) return { state: 'today' }

  const nextDay = new Date(target)
  nextDay.setDate(nextDay.getDate() + 1)
  if (now.getTime() >= nextDay.getTime()) return { state: 'past' }

  const totalSeconds = Math.floor((target.getTime() - now.getTime()) / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return { state: 'future', days, hours, minutes, seconds }
}

/** "2026-09-12" → "12 September 2026" (falls back to the raw string). */
export function formatDate(d: string): string {
  const t = new Date(`${d}T00:00:00`)
  return isNaN(t.getTime())
    ? d
    : t.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export interface CalendarGrid {
  monthLabel: string
  day: number
  weeks: (number | null)[][]
}

/**
 * Monday-first calendar matrix for the month of `eventDate`.
 * monthLabel is "M / D" (month/day of the wedding itself); day is that same
 * day, circled by the caller. Invalid input → null.
 */
export function calendarGrid(eventDate: string): CalendarGrid | null {
  const target = new Date(`${eventDate}T00:00:00`)
  if (isNaN(target.getTime())) return null

  const year = target.getFullYear()
  const month = target.getMonth() // 0-indexed
  const day = target.getDate()

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDow = new Date(year, month, 1).getDay() // 0=Sun..6=Sat
  const leading = (firstDow + 6) % 7 // Monday-first offset

  const cells: (number | null)[] = [
    ...Array(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }

  return { monthLabel: `${month + 1} / ${day}`, day, weeks }
}

/** Fallback letter copy for the invite (EN, 6-line arc). */
export const DEFAULT_LETTER: string[] = [
  'Life is a wonderful journey,',
  'and you are the most beautiful part of ours.',
  'By the time this invitation reaches you,',
  'our wedding will already be counting down.',
  'A wedding is one of the few true reunions.',
  'Long time no see — see you at our wedding.',
]
