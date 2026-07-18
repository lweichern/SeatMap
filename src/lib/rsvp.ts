import { newTableId } from './layout-ops'
import { normalizeDietary } from './kitchen'
import type { Dietary, Guest, GuestSide } from './types'

/** Clamp each dietary count to the party size before normalizing — a guest
 *  may lower the party picker after setting steppers, and stored counts
 *  must never exceed the party they belong to. */
const clampDietary = (d: Dietary | undefined, max: number): Dietary | undefined =>
  d && {
    ...d,
    ...Object.fromEntries(
      (['veg', 'halal', 'no_beef', 'child'] as const).map((k) => [k, Math.min(d[k] ?? 0, max)]),
    ),
  }

export interface RsvpSubmission {
  name: string
  phone: string
  party_size: number
  side: GuestSide
  attending: boolean
  dietary?: Dietary
}

const digits = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '')
const norm = (s: string) => s.trim().toLowerCase()

/**
 * Fold an RSVP submission into the guest list: update the matching guest if
 * one exists (phone first — formatting ignored — then exact name when no
 * phone is involved), otherwise create a new one. Planner-owned fields
 * (name spelling, table, VIP, group) survive an update; the RSVP only
 * contributes attendance, party size and a phone if missing.
 */
export function mergeRsvp(
  existing: Guest[],
  sub: RsvpSubmission,
  eventId: string,
): Guest {
  const subPhone = digits(sub.phone)
  const match =
    (subPhone &&
      existing.find((g) => digits(g.phone) && digits(g.phone) === subPhone)) ||
    (!subPhone &&
      existing.find((g) => !digits(g.phone) && norm(g.name) === norm(sub.name))) ||
    null

  const rsvp = sub.attending ? ('yes' as const) : ('no' as const)

  if (match) {
    return {
      ...match,
      rsvp,
      party_size: sub.party_size,
      phone: match.phone ?? (subPhone ? sub.phone.trim() : null),
      side: match.side === 'both' ? sub.side : match.side,
      dietary: normalizeDietary(clampDietary(sub.dietary, sub.party_size)) ?? match.dietary,
    }
  }

  return {
    id: newTableId(),
    event_id: eventId,
    name: sub.name.trim(),
    phone: subPhone ? sub.phone.trim() : null,
    email: null,
    party_size: sub.party_size,
    side: sub.side,
    group_tag: null,
    is_vip: false,
    table_id: null,
    qr_token: null,
    checked_in_at: null,
    locked: false,
    rsvp,
    dietary: normalizeDietary(clampDietary(sub.dietary, sub.party_size)),
  }
}
