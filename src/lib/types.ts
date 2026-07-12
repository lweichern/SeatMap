// Domain types. ALL geometry is in metres — origin is the top-left of the
// floor plan. Conversion to pixels happens only at render time.

export interface Wall {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface Entrance {
  x: number
  y: number
  /** Direction a guest faces when walking in, degrees clockwise from north (up). */
  facing_deg: number
}

export interface Stage {
  x: number
  y: number
  w: number
  h: number
}

export type TableShape = 'round' | 'rect'

export interface VenueTable {
  id: string
  layout_id: string
  label: string
  x: number
  y: number
  seats: number
  shape: TableShape
  diameter_m: number
  w_m?: number
  h_m?: number
}

export interface VenueTableLayout {
  id: string
  venue_id: string
  name: string
  capacity_total: number
}

export interface Venue {
  id: string
  org_id: string
  name: string
  address: string
  floorplan_url: string | null
  scale_px_per_metre: number | null
  width_m: number | null
  height_m: number | null
  walls: Wall[]
  entrance: Entrance | null
  stage: Stage | null
}

export type PhotoMode = 'live_feed' | 'moderated_only' | 'off'

export interface WeddingEvent {
  id: string
  org_id: string
  venue_id: string
  layout_id: string
  couple_names: string
  event_date: string // ISO date
  starts_at: string | null
  photo_mode: PhotoMode
  guest_token_secret: string
}

export type GuestSide = 'bride' | 'groom' | 'both'

export interface Guest {
  id: string
  event_id: string
  name: string
  phone: string | null
  email: string | null
  party_size: number
  side: GuestSide
  group_tag: string | null
  is_vip: boolean
  table_id: string | null
  qr_token: string | null
  checked_in_at: string | null
  /** Pinned by the planner — excluded from re-allocation. Client-side only. */
  locked: boolean
}

export type ConstraintType = 'must_sit_together' | 'must_not_sit_together'

export interface GuestConstraint {
  id: string
  event_id: string
  guest_a_id: string
  guest_b_id: string
  type: ConstraintType
}

export const TABLE_DEFAULTS = {
  seats: 10,
  shape: 'round' as TableShape,
  diameter_m: 1.8,
}

export const GRID_M = 0.5
