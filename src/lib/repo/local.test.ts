import { describe, it, expect, beforeEach } from 'vitest'
import { LocalVenueRepo } from './local'
import type { Venue, VenueTable, VenueTableLayout } from '../types'

// Minimal localStorage shim for node environment
class MemStorage {
  private m = new Map<string, string>()
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v))
  }
  removeItem(k: string) {
    this.m.delete(k)
  }
}

function venue(over: Partial<Venue> = {}): Venue {
  return {
    id: 'v1',
    org_id: 'org1',
    name: 'Grand Ballroom @ Hilton KL',
    address: 'Jalan Sultan Ismail',
    floorplan_url: null,
    scale_px_per_metre: 20,
    width_m: 40,
    height_m: 25,
    walls: [{ x1: 0, y1: 0, x2: 40, y2: 0 }],
    door: { x: 20, y: 25 },
    door_width_m: 2.4,
    registration: { x: 20, y: 27 },
    stage: { x: 15, y: 0, w: 10, h: 4 },
    floorplan_north_offset_deg: null,
    clear_m: 0.25,
    ...over,
  }
}

describe('LocalVenueRepo', () => {
  let repo: LocalVenueRepo

  beforeEach(() => {
    repo = new LocalVenueRepo(new MemStorage() as unknown as Storage)
  })

  it('saves and lists venues', async () => {
    await repo.saveVenue(venue())
    const all = await repo.listVenues()
    expect(all.length).toBe(1)
    expect(all[0].name).toContain('Grand Ballroom')
    expect(all[0].door).toEqual({ x: 20, y: 25 })
  })

  it('round-trips a layout with its tables', async () => {
    await repo.saveVenue(venue())
    const layout: VenueTableLayout = {
      id: 'l1',
      venue_id: 'v1',
      name: '300 pax',
      capacity_total: 300,
    }
    const tables: VenueTable[] = [1, 2, 3].map((n) => ({
      id: `t${n}`,
      layout_id: 'l1',
      shape: 'round' as const,
      kind: 'seat' as const,
      label: String(n),
      x: n * 3,
      y: 5,
      rot: 0,
      seats: 10,
      dia: 1.8,
    }))
    await repo.saveLayout(layout, tables)
    const layouts = await repo.listLayouts('v1')
    expect(layouts.map((l) => l.name)).toEqual(['300 pax'])
    const got = await repo.getLayout('l1')
    expect(got?.tables.length).toBe(3)
    expect(got?.tables[0].x).toBe(3)
  })

  it('deletes a venue and its layouts', async () => {
    await repo.saveVenue(venue())
    await repo.saveLayout(
      { id: 'l1', venue_id: 'v1', name: 'A', capacity_total: 0 },
      [],
    )
    await repo.deleteVenue('v1')
    expect(await repo.listVenues()).toEqual([])
    expect(await repo.getLayout('l1')).toBeNull()
  })
})
