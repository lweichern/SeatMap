import type { Venue, VenueTable, VenueTableLayout } from '../types'
import type { LayoutWithTables, VenueRepo } from './types'

const KEY = 'seatmap.v1'

interface Db {
  venues: Venue[]
  layouts: VenueTableLayout[]
  tables: VenueTable[]
}

const EMPTY: Db = { venues: [], layouts: [], tables: [] }

/**
 * localStorage-backed repo so the planner app runs with zero configuration.
 * Used automatically when NEXT_PUBLIC_SUPABASE_URL is not set.
 */
export class LocalVenueRepo implements VenueRepo {
  constructor(private storage: Storage) {}

  private read(): Db {
    const raw = this.storage.getItem(KEY)
    if (!raw) return structuredClone(EMPTY)
    try {
      return JSON.parse(raw) as Db
    } catch {
      return structuredClone(EMPTY)
    }
  }

  private write(db: Db) {
    this.storage.setItem(KEY, JSON.stringify(db))
  }

  async listVenues(): Promise<Venue[]> {
    return this.read().venues
  }

  async getVenue(id: string): Promise<Venue | null> {
    return this.read().venues.find((v) => v.id === id) ?? null
  }

  async saveVenue(venue: Venue): Promise<void> {
    const db = this.read()
    const i = db.venues.findIndex((v) => v.id === venue.id)
    if (i >= 0) db.venues[i] = venue
    else db.venues.push(venue)
    this.write(db)
  }

  async deleteVenue(id: string): Promise<void> {
    const db = this.read()
    const layoutIds = new Set(
      db.layouts.filter((l) => l.venue_id === id).map((l) => l.id),
    )
    db.venues = db.venues.filter((v) => v.id !== id)
    db.layouts = db.layouts.filter((l) => l.venue_id !== id)
    db.tables = db.tables.filter((t) => !layoutIds.has(t.layout_id))
    this.write(db)
  }

  async listLayouts(venueId: string): Promise<VenueTableLayout[]> {
    return this.read().layouts.filter((l) => l.venue_id === venueId)
  }

  async getLayout(layoutId: string): Promise<LayoutWithTables | null> {
    const db = this.read()
    const layout = db.layouts.find((l) => l.id === layoutId)
    if (!layout) return null
    return { ...layout, tables: db.tables.filter((t) => t.layout_id === layoutId) }
  }

  async saveLayout(layout: VenueTableLayout, tables: VenueTable[]): Promise<void> {
    const db = this.read()
    const i = db.layouts.findIndex((l) => l.id === layout.id)
    if (i >= 0) db.layouts[i] = layout
    else db.layouts.push(layout)
    db.tables = db.tables
      .filter((t) => t.layout_id !== layout.id)
      .concat(tables.map((t) => ({ ...t, layout_id: layout.id })))
    this.write(db)
  }

  async deleteLayout(layoutId: string): Promise<void> {
    const db = this.read()
    db.layouts = db.layouts.filter((l) => l.id !== layoutId)
    db.tables = db.tables.filter((t) => t.layout_id !== layoutId)
    this.write(db)
  }
}
