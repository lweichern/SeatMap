import { createClient, type SupabaseClient } from '@supabase/supabase-js'
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

export class SupabaseVenueRepo implements VenueRepo {
  private client: SupabaseClient

  constructor(url: string, anonKey: string) {
    this.client = createClient(url, anonKey)
  }

  async listVenues(): Promise<Venue[]> {
    const { data, error } = await this.client.from('venues').select('*').order('name')
    if (error) throw error
    return (data ?? []) as Venue[]
  }

  async getVenue(id: string): Promise<Venue | null> {
    const { data, error } = await this.client
      .from('venues')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return (data as Venue) ?? null
  }

  async saveVenue(venue: Venue): Promise<void> {
    const { error } = await this.client.from('venues').upsert(venue)
    if (error) throw error
  }

  async deleteVenue(id: string): Promise<void> {
    const { error } = await this.client.from('venues').delete().eq('id', id)
    if (error) throw error
  }

  async listLayouts(venueId: string): Promise<VenueTableLayout[]> {
    const { data, error } = await this.client
      .from('venue_table_layouts')
      .select('*')
      .eq('venue_id', venueId)
      .order('name')
    if (error) throw error
    return (data ?? []) as VenueTableLayout[]
  }

  async getLayout(layoutId: string): Promise<LayoutWithTables | null> {
    const { data, error } = await this.client
      .from('venue_table_layouts')
      .select('*, venue_tables(*)')
      .eq('id', layoutId)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    const { venue_tables, ...layout } = data as VenueTableLayout & {
      venue_tables: VenueTable[]
    }
    return { ...layout, tables: venue_tables ?? [] }
  }

  async saveLayout(layout: VenueTableLayout, tables: VenueTable[]): Promise<void> {
    const { error } = await this.client.from('venue_table_layouts').upsert(layout)
    if (error) throw error
    // Replace-all: simplest correct sync for a <100-row set edited as a whole.
    const del = await this.client
      .from('venue_tables')
      .delete()
      .eq('layout_id', layout.id)
    if (del.error) throw del.error
    if (tables.length > 0) {
      const ins = await this.client
        .from('venue_tables')
        .insert(tables.map((t) => ({ ...t, layout_id: layout.id })))
      if (ins.error) throw ins.error
    }
  }

  async deleteLayout(layoutId: string): Promise<void> {
    const { error } = await this.client
      .from('venue_table_layouts')
      .delete()
      .eq('id', layoutId)
    if (error) throw error
  }

  async listEvents(): Promise<WeddingEvent[]> {
    const { data, error } = await this.client
      .from('events')
      .select('*')
      .order('event_date')
    if (error) throw error
    return (data ?? []) as WeddingEvent[]
  }

  async getEvent(id: string): Promise<WeddingEvent | null> {
    const { data, error } = await this.client
      .from('events')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return (data as WeddingEvent) ?? null
  }

  async saveEvent(event: WeddingEvent): Promise<void> {
    const { error } = await this.client.from('events').upsert(event)
    if (error) throw error
  }

  async deleteEvent(id: string): Promise<void> {
    const { error } = await this.client.from('events').delete().eq('id', id)
    if (error) throw error
  }

  async listGuests(eventId: string): Promise<Guest[]> {
    const { data, error } = await this.client
      .from('guests')
      .select('*')
      .eq('event_id', eventId)
      .order('name')
    if (error) throw error
    return (data ?? []) as Guest[]
  }

  async saveGuest(guest: Guest): Promise<void> {
    await this.saveGuests([guest])
  }

  async saveGuests(guests: Guest[]): Promise<void> {
    if (guests.length === 0) return
    const { error } = await this.client.from('guests').upsert(guests)
    if (error) throw error
  }

  async deleteGuest(id: string): Promise<void> {
    const { error } = await this.client.from('guests').delete().eq('id', id)
    if (error) throw error
  }

  async listConstraints(eventId: string): Promise<GuestConstraint[]> {
    const { data, error } = await this.client
      .from('guest_constraints')
      .select('*')
      .eq('event_id', eventId)
    if (error) throw error
    return (data ?? []) as GuestConstraint[]
  }

  async saveConstraint(c: GuestConstraint): Promise<void> {
    const { error } = await this.client.from('guest_constraints').upsert(c)
    if (error) throw error
  }

  async deleteConstraint(id: string): Promise<void> {
    const { error } = await this.client
      .from('guest_constraints')
      .delete()
      .eq('id', id)
    if (error) throw error
  }

  async syncCheckins(ops: CheckinOp[]): Promise<void> {
    for (const op of ops) {
      if (op.op === 'undo') {
        const { error } = await this.client
          .from('guests')
          .update({ checked_in_at: null })
          .eq('id', op.guest_id)
        if (error) throw error
        continue
      }
      // append-only log — id derived from the natural key makes upsert idempotent
      const { error: logErr } = await this.client.from('checkin_log').upsert(
        {
          id: `${op.guest_id}:${op.device_id}:${op.checked_in_at}`,
          event_id: op.event_id,
          guest_id: op.guest_id,
          checked_in_at: op.checked_in_at,
          device_id: op.device_id,
        },
        { onConflict: 'id', ignoreDuplicates: true },
      )
      if (logErr) throw logErr
      // guest keeps EARLIEST check-in
      const { data: g, error: getErr } = await this.client
        .from('guests')
        .select('checked_in_at')
        .eq('id', op.guest_id)
        .maybeSingle()
      if (getErr) throw getErr
      if (!g?.checked_in_at || g.checked_in_at > op.checked_in_at) {
        const { error } = await this.client
          .from('guests')
          .update({ checked_in_at: op.checked_in_at })
          .eq('id', op.guest_id)
        if (error) throw error
      }
    }
  }

  async listCheckinLog(eventId: string): Promise<CheckinLogEntry[]> {
    const { data, error } = await this.client
      .from('checkin_log')
      .select('*')
      .eq('event_id', eventId)
    if (error) throw error
    return (data ?? []) as CheckinLogEntry[]
  }

  async listPhotos(eventId: string, statuses?: PhotoStatus[]): Promise<Photo[]> {
    let q = this.client
      .from('photos')
      .select('*')
      .eq('event_id', eventId)
      .order('uploaded_at', { ascending: false })
    if (statuses) q = q.in('status', statuses)
    const { data, error } = await q
    if (error) throw error
    return (data ?? []) as Photo[]
  }

  async savePhoto(photo: Photo): Promise<void> {
    const { error } = await this.client.from('photos').upsert(photo)
    if (error) throw error
  }

  async updatePhoto(id: string, patch: Partial<Photo>): Promise<void> {
    const { error } = await this.client.from('photos').update(patch).eq('id', id)
    if (error) throw error
  }
}
