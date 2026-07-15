import type {
  Guest,
  GuestConstraint,
  Photo,
  PhotoStatus,
  Venue,
  VenueTable,
  VenueTableLayout,
  WeddingEvent,
} from '../types'
import type { CheckinLogEntry, CheckinOp, LayoutWithTables, VenueRepo } from './types'

const KEY = 'seatmap.v1'

interface Db {
  venues: Venue[]
  layouts: VenueTableLayout[]
  tables: VenueTable[]
  events: WeddingEvent[]
  guests: Guest[]
  constraints: GuestConstraint[]
  checkin_log: CheckinLogEntry[]
  photos: Photo[]
}

const EMPTY: Db = {
  venues: [],
  layouts: [],
  tables: [],
  events: [],
  guests: [],
  constraints: [],
  checkin_log: [],
  photos: [],
}

/** In-place upgrade of pre-HALL_EDITOR.md local data to the v2 model. */
function migrateHallEditorV2(db: Db) {
  for (const v of db.venues as (Venue & {
    entrance?: { x: number; y: number } | null
  })[]) {
    if (v.door === undefined) {
      v.door = v.entrance ? { x: v.entrance.x, y: v.entrance.y } : null
      delete v.entrance
    }
    v.door_width_m ??= 2.4
    v.registration ??= null
    v.floorplan_north_offset_deg ??= null
    v.clear_m ??= 0.25
  }
  for (const e of db.events) e.menu ??= []
  for (const t of db.tables as (Db['tables'][number] & {
    diameter_m?: number
    w_m?: number
    h_m?: number
  })[]) {
    if (t.kind === undefined) {
      const oldShape = t.shape as string
      t.shape = oldShape === 'rect' ? 'banquet' : 'round'
      t.kind = 'seat'
      t.rot ??= 0
      if (oldShape === 'rect') {
        t.len = t.w_m ?? 2.4
        t.wid = t.h_m ?? 0.9
        t.ends = true
      } else {
        t.dia = t.diameter_m ?? 1.8
      }
      delete t.diameter_m
      delete t.w_m
      delete t.h_m
    }
  }
}

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
      // merge over EMPTY so dbs written before newer collections existed still work
      const db = { ...structuredClone(EMPTY), ...(JSON.parse(raw) as Partial<Db>) }
      migrateHallEditorV2(db)
      return db
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

  async listEvents(): Promise<WeddingEvent[]> {
    return this.read().events
  }

  async getEvent(id: string): Promise<WeddingEvent | null> {
    return this.read().events.find((e) => e.id === id) ?? null
  }

  async saveEvent(event: WeddingEvent): Promise<void> {
    const db = this.read()
    const i = db.events.findIndex((e) => e.id === event.id)
    if (i >= 0) db.events[i] = event
    else db.events.push(event)
    this.write(db)
  }

  async deleteEvent(id: string): Promise<void> {
    const db = this.read()
    db.events = db.events.filter((e) => e.id !== id)
    db.guests = db.guests.filter((g) => g.event_id !== id)
    db.constraints = db.constraints.filter((c) => c.event_id !== id)
    this.write(db)
  }

  async listGuests(eventId: string): Promise<Guest[]> {
    return this.read().guests.filter((g) => g.event_id === eventId)
  }

  async saveGuest(guest: Guest): Promise<void> {
    await this.saveGuests([guest])
  }

  async saveGuests(guests: Guest[]): Promise<void> {
    const db = this.read()
    for (const guest of guests) {
      const i = db.guests.findIndex((g) => g.id === guest.id)
      if (i >= 0) db.guests[i] = guest
      else db.guests.push(guest)
    }
    this.write(db)
  }

  async deleteGuest(id: string): Promise<void> {
    const db = this.read()
    db.guests = db.guests.filter((g) => g.id !== id)
    db.constraints = db.constraints.filter(
      (c) => c.guest_a_id !== id && c.guest_b_id !== id,
    )
    this.write(db)
  }

  async listConstraints(eventId: string): Promise<GuestConstraint[]> {
    return this.read().constraints.filter((c) => c.event_id === eventId)
  }

  async saveConstraint(c: GuestConstraint): Promise<void> {
    const db = this.read()
    const i = db.constraints.findIndex((x) => x.id === c.id)
    if (i >= 0) db.constraints[i] = c
    else db.constraints.push(c)
    this.write(db)
  }

  async deleteConstraint(id: string): Promise<void> {
    const db = this.read()
    db.constraints = db.constraints.filter((c) => c.id !== id)
    this.write(db)
  }

  async syncCheckins(ops: CheckinOp[]): Promise<void> {
    const db = this.read()
    for (const op of ops) {
      const guest = db.guests.find((g) => g.id === op.guest_id)
      if (op.op === 'undo') {
        if (guest) guest.checked_in_at = null
        continue
      }
      // guest row keeps the EARLIEST check-in (flaky connections resubmit)
      if (guest) {
        guest.checked_in_at =
          guest.checked_in_at && guest.checked_in_at <= op.checked_in_at
            ? guest.checked_in_at
            : op.checked_in_at
      }
      // append-only log, deduped on the natural key
      const dupe = db.checkin_log.some(
        (l) =>
          l.guest_id === op.guest_id &&
          l.device_id === op.device_id &&
          l.checked_in_at === op.checked_in_at,
      )
      if (!dupe) {
        db.checkin_log.push({
          id: `${op.guest_id}:${op.device_id}:${op.checked_in_at}`,
          event_id: op.event_id,
          guest_id: op.guest_id,
          checked_in_at: op.checked_in_at,
          device_id: op.device_id,
          synced_at: new Date().toISOString(),
        })
      }
    }
    this.write(db)
  }

  async listCheckinLog(eventId: string): Promise<CheckinLogEntry[]> {
    return this.read().checkin_log.filter((l) => l.event_id === eventId)
  }

  async listPhotos(eventId: string, statuses?: PhotoStatus[]): Promise<Photo[]> {
    return this.read()
      .photos.filter(
        (p) => p.event_id === eventId && (!statuses || statuses.includes(p.status)),
      )
      .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at))
  }

  async savePhoto(photo: Photo): Promise<void> {
    const db = this.read()
    const i = db.photos.findIndex((p) => p.id === photo.id)
    if (i >= 0) db.photos[i] = photo
    else db.photos.push(photo)
    this.write(db)
  }

  async updatePhoto(id: string, patch: Partial<Photo>): Promise<void> {
    const db = this.read()
    const i = db.photos.findIndex((p) => p.id === id)
    if (i >= 0) {
      db.photos[i] = { ...db.photos[i], ...patch }
      this.write(db)
    }
  }
}
