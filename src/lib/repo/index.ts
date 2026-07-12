import { LocalVenueRepo } from './local'
import { SupabaseVenueRepo } from './supabase'
import type { VenueRepo } from './types'

let repo: VenueRepo | null = null

/**
 * Supabase when configured, localStorage otherwise — same interface, so the
 * editor never knows the difference. Client-side only.
 */
export function getRepo(): VenueRepo {
  if (repo) return repo
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  repo =
    url && key
      ? new SupabaseVenueRepo(url, key)
      : new LocalVenueRepo(window.localStorage)
  return repo
}

export type { VenueRepo, LayoutWithTables } from './types'
