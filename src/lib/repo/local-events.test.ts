import { describe, it, expect, beforeEach } from 'vitest'
import { LocalVenueRepo } from './local'
import type { Guest, GuestConstraint, WeddingEvent } from '../types'

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

function event(over: Partial<WeddingEvent> = {}): WeddingEvent {
  return {
    id: 'e1',
    org_id: 'org1',
    venue_id: 'v1',
    layout_id: 'l1',
    couple_names: 'Wei Chern & Jia Ling',
    event_date: '2026-09-12',
    starts_at: null,
    photo_mode: 'moderated_only',
    guest_token_secret: 'secret-uuid',
    menu: [],
    ...over,
  }
}

function guest(over: Partial<Guest> = {}): Guest {
  return {
    id: Math.random().toString(36).slice(2),
    event_id: 'e1',
    name: 'Uncle Lim',
    phone: null,
    email: null,
    party_size: 1,
    side: 'both',
    group_tag: null,
    is_vip: false,
    table_id: null,
    qr_token: null,
    checked_in_at: null,
    locked: false,
    ...over,
  }
}

describe('LocalVenueRepo — events/guests/constraints', () => {
  let repo: LocalVenueRepo

  beforeEach(() => {
    repo = new LocalVenueRepo(new MemStorage() as unknown as Storage)
  })

  it('round-trips events', async () => {
    await repo.saveEvent(event())
    const all = await repo.listEvents()
    expect(all.length).toBe(1)
    expect(all[0].couple_names).toContain('Wei Chern')
    expect(await repo.getEvent('e1')).not.toBeNull()
  })

  it('bulk-saves and lists guests per event', async () => {
    await repo.saveEvent(event())
    await repo.saveGuests([guest({ id: 'g1' }), guest({ id: 'g2', name: 'Aunty Tan' })])
    const gs = await repo.listGuests('e1')
    expect(gs.length).toBe(2)
    await repo.saveGuest(guest({ id: 'g1', name: 'Uncle Lim Sr', table_id: 't5' }))
    const g1 = (await repo.listGuests('e1')).find((g) => g.id === 'g1')!
    expect(g1.name).toBe('Uncle Lim Sr')
    expect(g1.table_id).toBe('t5')
    await repo.deleteGuest('g2')
    expect((await repo.listGuests('e1')).length).toBe(1)
  })

  it('round-trips constraints and cascades on event delete', async () => {
    await repo.saveEvent(event())
    await repo.saveGuests([guest({ id: 'g1' }), guest({ id: 'g2' })])
    const c: GuestConstraint = {
      id: 'c1',
      event_id: 'e1',
      guest_a_id: 'g1',
      guest_b_id: 'g2',
      type: 'must_not_sit_together',
    }
    await repo.saveConstraint(c)
    expect((await repo.listConstraints('e1')).length).toBe(1)
    await repo.deleteEvent('e1')
    expect(await repo.listEvents()).toEqual([])
    expect(await repo.listGuests('e1')).toEqual([])
    expect(await repo.listConstraints('e1')).toEqual([])
  })
})
