import type { Venue, VenueTable, VenueTableLayout } from '../types'

export interface LayoutWithTables extends VenueTableLayout {
  tables: VenueTable[]
}

export interface VenueRepo {
  listVenues(): Promise<Venue[]>
  getVenue(id: string): Promise<Venue | null>
  saveVenue(venue: Venue): Promise<void>
  deleteVenue(id: string): Promise<void>
  listLayouts(venueId: string): Promise<VenueTableLayout[]>
  getLayout(layoutId: string): Promise<LayoutWithTables | null>
  saveLayout(layout: VenueTableLayout, tables: VenueTable[]): Promise<void>
  deleteLayout(layoutId: string): Promise<void>
}
