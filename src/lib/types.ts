// Domain types. ALL geometry is in metres — origin is the top-left of the
// floor plan. Conversion to pixels happens only at render time.

export interface Wall {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface Stage {
  x: number
  y: number
  w: number
  h: number
}

export type Shape = 'round' | 'banquet' | 'square' | 'oval' | 'buffet'
export type Kind = 'seat' | 'service'

/**
 * The single shape registry. `kind` is derived from it, never invented
 * elsewhere. Defaults are what a new table of that shape starts as.
 */
export const SHAPES: Record<
  Shape,
  { label: string; kind: Kind; defaults: Partial<TableObj> }
> = {
  round: { label: 'Round', kind: 'seat', defaults: { seats: 10, dia: 1.8 } },
  banquet: {
    label: 'Banquet',
    kind: 'seat',
    defaults: { seats: 8, len: 2.4, wid: 0.9, rot: 0, ends: true },
  },
  square: {
    label: 'Square',
    kind: 'seat',
    defaults: { seats: 8, len: 1.5, wid: 1.5, rot: 0, ends: true },
  },
  oval: {
    label: 'Oval',
    kind: 'seat',
    defaults: { seats: 12, len: 2.6, wid: 1.5, rot: 0 },
  },
  buffet: {
    label: 'Buffet',
    kind: 'service',
    defaults: { len: 3.0, wid: 0.8, rot: 0 },
  },
}

export const SERVICE_NAME_PRESETS = [
  'Buffet — Seafood',
  'Buffet — Vegetarian',
  'Buffet — Mains',
  'Buffet — Desserts',
  'Buffet — Salads',
  'Drinks Bar',
  'Cake Table',
  'Gift Table',
  'Photo Booth',
]

export interface TableObj {
  id: string
  layout_id: string
  shape: Shape
  /** Denormalised from SHAPES for query convenience. */
  kind: Kind
  /** "12" for seating, "Buffet — Seafood" for service. */
  label: string
  /** Centre, metres. */
  x: number
  y: number
  /** Degrees; 0 for round. */
  rot: number
  // seating only
  seats?: number
  dia?: number // round
  len?: number // banquet / square / oval / buffet
  wid?: number
  /** banquet/square: seat the short ends? false = head-table. */
  ends?: boolean
  /** Pinned; excluded from re-allocation. */
  locked?: boolean
}

/** Legacy alias — Phase 1–6 code referred to tables as VenueTable. */
export type VenueTable = TableObj

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
  /** From the calibration drag. Gates every downstream tool. */
  scale_px_per_metre: number | null
  width_m: number | null
  height_m: number | null
  walls: Wall[]
  /** ON a wall — a GAP carved out of it (2D, 3D and pathfinding grid). */
  door: { x: number; y: number } | null
  door_width_m: number
  /** OUTSIDE the walls, in the foyer. Optional, never load-bearing. */
  registration: { x: number; y: number } | null
  stage: Stage | null
  /** For v2 AR. Captured now — it's one tap. */
  floorplan_north_offset_deg: number | null
  /** Walking clearance beyond the chair ring (venue setting, not a constant). */
  clear_m: number
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

export type PhotoStatus = 'pending_ai' | 'pending_human' | 'approved' | 'rejected'

export interface Photo {
  id: string
  event_id: string
  guest_id: string | null
  /** Data URL in local mode; storage path in Supabase mode. */
  storage_path: string
  thumb_path: string | null
  status: PhotoStatus
  ai_flag_reason: string | null
  uploaded_at: string
  approved_at: string | null
  on_screen: boolean
}

export const GRID_M = 0.5
