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

export const TABLE_DEFAULTS = {
  seats: 10,
  shape: 'round' as TableShape,
  diameter_m: 1.8,
}

export const GRID_M = 0.5
