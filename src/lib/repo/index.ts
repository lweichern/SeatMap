import { createServerRepo } from './server'
import { SupabaseVenueRepo } from './supabase'
import type { VenueRepo } from './types'

let repo: VenueRepo | null = null

/**
 * Supabase when configured; otherwise the dev server's shared store (which
 * itself falls back to browser localStorage if the API is unreachable).
 * Same interface throughout — callers never know the difference.
 */
export function getRepo(): VenueRepo {
  if (repo) return repo
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  repo = url && key ? new SupabaseVenueRepo(url, key) : createServerRepo()
  return repo
}

export type { VenueRepo, LayoutWithTables } from './types'
