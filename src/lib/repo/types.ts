import type {
  Guest,
  GuestConstraint,
  Venue,
  VenueTable,
  VenueTableLayout,
  WeddingEvent,
} from '../types'

export interface LayoutWithTables extends VenueTableLayout {
  tables: VenueTable[]
}

export interface CheckinOp {
  op: 'checkin' | 'undo'
  event_id: string
  guest_id: string
  checked_in_at: string
  device_id: string
}

export interface CheckinLogEntry {
  id: string
  event_id: string
  guest_id: string
  checked_in_at: string
  device_id: string
  synced_at: string
}

export interface VenueRepo {
  listEvents(): Promise<WeddingEvent[]>
  getEvent(id: string): Promise<WeddingEvent | null>
  saveEvent(event: WeddingEvent): Promise<void>
  deleteEvent(id: string): Promise<void>
  listGuests(eventId: string): Promise<Guest[]>
  saveGuest(guest: Guest): Promise<void>
  saveGuests(guests: Guest[]): Promise<void>
  deleteGuest(id: string): Promise<void>
  listConstraints(eventId: string): Promise<GuestConstraint[]>
  saveConstraint(c: GuestConstraint): Promise<void>
  deleteConstraint(id: string): Promise<void>
  /** Idempotent: dedupes on (guest_id, device_id, checked_in_at); guest keeps EARLIEST check-in. */
  syncCheckins(ops: CheckinOp[]): Promise<void>
  listCheckinLog(eventId: string): Promise<CheckinLogEntry[]>
  listVenues(): Promise<Venue[]>
  getVenue(id: string): Promise<Venue | null>
  saveVenue(venue: Venue): Promise<void>
  deleteVenue(id: string): Promise<void>
  listLayouts(venueId: string): Promise<VenueTableLayout[]>
  getLayout(layoutId: string): Promise<LayoutWithTables | null>
  saveLayout(layout: VenueTableLayout, tables: VenueTable[]): Promise<void>
  deleteLayout(layoutId: string): Promise<void>
}
