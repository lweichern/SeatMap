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
  listVenues(): Promise<Venue[]>
  getVenue(id: string): Promise<Venue | null>
  saveVenue(venue: Venue): Promise<void>
  deleteVenue(id: string): Promise<void>
  listLayouts(venueId: string): Promise<VenueTableLayout[]>
  getLayout(layoutId: string): Promise<LayoutWithTables | null>
  saveLayout(layout: VenueTableLayout, tables: VenueTable[]): Promise<void>
  deleteLayout(layoutId: string): Promise<void>
}
