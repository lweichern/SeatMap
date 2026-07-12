import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Venue, VenueTable, VenueTableLayout } from '../types'
import type { LayoutWithTables, VenueRepo } from './types'

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
}
