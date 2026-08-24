/** Splits couple names on "&" / "and" (spaced) or the CJK connector 与 (unspaced). */
const CONNECTOR = /\s+(?:&|and)\s+|与/i

/** "Adam & Eve" → "A·E"; "小明与小红" → "小·小"; single name → single grapheme. */
export function monogram(coupleNames: string): string {
  const sides = coupleNames
    .split(CONNECTOR)
    .map((s) => s.trim())
    .filter(Boolean)
  return sides
    .map((s) => ([...s][0] ?? '').toUpperCase())
    .join('·')
}

export type CountdownState =
  | { state: 'future'; days: number; hours: number; minutes: number }
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

  const totalMinutes = Math.floor((target.getTime() - now.getTime()) / 60000)
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minutes = totalMinutes % 60
  return { state: 'future', days, hours, minutes }
}

/** "2026-09-12" → "12 September 2026" (falls back to the raw string). */
export function formatDate(d: string): string {
  const t = new Date(`${d}T00:00:00`)
  return isNaN(t.getTime())
    ? d
    : t.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}
