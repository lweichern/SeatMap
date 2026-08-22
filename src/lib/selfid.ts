import type { Guest } from './types'

/**
 * Self-identification matching for the shared "Find my seat" entrance QR.
 * Pure functions — the /find page provides the UI and confirmation gate.
 */

/** Lowercase, strip diacritics, keep only letters/digits (CJK included). */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
}

/** '••••1234' for the confirm card; null when no usable phone. */
export function maskPhone(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (digits.length < 4) return null
  return `••••${digits.slice(-4)}`
}

/**
 * Candidates for "who scanned the poster": normalized name equality or
 * both-ways containment, narrowed by phone last-digits when they help.
 * A wrong digit must not hide an obvious name match, so an empty digit
 * filter falls back to the name matches. Declined guests never match.
 * Single-character input matches nothing — too broad to be useful.
 */
export function matchGuests(guests: Guest[], name: string, last4?: string): Guest[] {
  const n = normalizeName(name)
  if (n.length < 2) return []
  const byName = guests.filter((g) => {
    if (g.rsvp === 'no') return false
    const gn = normalizeName(g.name)
    return gn === n || gn.includes(n) || n.includes(gn)
  })
  const digits = (last4 ?? '').replace(/\D/g, '')
  if (digits.length >= 2) {
    const filtered = byName.filter((g) =>
      (g.phone ?? '').replace(/\D/g, '').endsWith(digits),
    )
    if (filtered.length > 0) return filtered
  }
  return byName
}
