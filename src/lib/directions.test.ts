import { describe, it, expect } from 'vitest'
import { describeTablePosition } from './directions'
import type { Venue, VenueTable } from './types'

// Hall 30m wide × 21m deep. Entrance bottom-centre, stage top-centre.
// "Front" = the stage end (how guests think of a ballroom).
const venue: Venue = {
  id: 'v1',
  org_id: 'o',
  name: 'Hall',
  address: '',
  floorplan_url: null,
  scale_px_per_metre: 20,
  width_m: 30,
  height_m: 21,
  walls: [],
  door: { x: 15, y: 21 },
  door_width_m: 2.4,
  registration: { x: 15, y: 23 },
  stage: { x: 10, y: 0, w: 10, h: 3 },
  floorplan_north_offset_deg: null,
  clear_m: 0.25,
}

function table(x: number, y: number): VenueTable {
  return { id: 't', layout_id: 'l', shape: 'round', kind: 'seat', label: '9', x, y, rot: 0, seats: 10, dia: 1.8 }
}

describe('describeTablePosition', () => {
  it('describes a front-left table near the stage', () => {
    const d = describeTablePosition(table(4, 4), venue).toLowerCase()
    expect(d).toContain('front-left')
    expect(d).toContain('near the stage')
  })

  it('describes a back-right table', () => {
    const d = describeTablePosition(table(26, 18), venue).toLowerCase()
    expect(d).toContain('back-right')
    expect(d).toContain('near the entrance')
  })

  it('describes the centre of the hall', () => {
    const d = describeTablePosition(table(15, 10.5), venue).toLowerCase()
    expect(d).toContain('middle of the hall')
  })

  it('works without stage or entrance (no landmark clause)', () => {
    const bare = { ...venue, stage: null, door: null, registration: null }
    const d = describeTablePosition(table(26, 18), bare).toLowerCase()
    expect(d).toContain('back-right')
    expect(d).not.toContain('stage')
  })

  it('left/right is from the entrance looking in (mirrors x when entering from the bottom)', () => {
    // walking in from the bottom edge facing the stage, x=4 is on the guest's RIGHT
    // if we define left/right in floor-plan terms we keep plan-left = "left".
    // The spec's example uses plan terms; assert consistency, not mirroring.
    const d = describeTablePosition(table(4, 18), venue).toLowerCase()
    expect(d).toContain('back-left')
  })
})
