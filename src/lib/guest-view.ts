import { getRepo } from './repo'
import { peekToken, verifyToken } from './token'
import type { Guest, Venue, VenueTable, WeddingEvent } from './types'

export interface GuestView {
  guest: Guest
  event: WeddingEvent
  venue: Venue
  tables: VenueTable[]
  table: VenueTable | null
}

export async function resolveGuest(token: string): Promise<GuestView | null> {
  const eventId = peekToken(token)?.event_id ?? null
  if (!eventId) return null
  const repo = getRepo()
  const event = await repo.getEvent(eventId)
  if (!event) return null
  const payload = await verifyToken(token, event.guest_token_secret)
  if (!payload) return null
  const [guests, venue, layout] = await Promise.all([
    repo.listGuests(eventId),
    repo.getVenue(event.venue_id),
    repo.getLayout(event.layout_id),
  ])
  const guest = guests.find((g) => g.id === payload.guest_id)
  if (!guest || !venue) return null
  const tables = layout?.tables ?? []
  return {
    guest,
    event,
    venue,
    tables,
    table: tables.find((t) => t.id === guest.table_id) ?? null,
  }
}
