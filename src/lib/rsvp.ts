import { newTableId } from './layout-ops'
import type { Guest, GuestSide } from './types'

export interface RsvpSubmission {
  name: string
  phone: string
  party_size: number
  side: GuestSide
  attending: boolean
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
  }
}
