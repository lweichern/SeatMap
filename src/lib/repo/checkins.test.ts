import { describe, it, expect, beforeEach } from 'vitest'
import { LocalVenueRepo } from './local'
import type { Guest, WeddingEvent } from '../types'

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

const EVENT: WeddingEvent = {
  id: 'e1',
  org_id: 'o',
  venue_id: 'v1',
  layout_id: 'l1',
  couple_names: 'A & B',
  event_date: '2026-09-12',
  starts_at: null,
  photo_mode: 'off',
  guest_token_secret: 's',
}

function guest(id: string): Guest {
  return {
    id,
    event_id: 'e1',
    name: id,
    phone: null,
    email: null,
    party_size: 1,
    side: 'both',
    group_tag: null,
    is_vip: false,
    table_id: 't1',
    qr_token: null,
    checked_in_at: null,
    locked: false,
  }
}

describe('syncCheckins', () => {
  let repo: LocalVenueRepo

  beforeEach(async () => {
    repo = new LocalVenueRepo(new MemStorage() as unknown as Storage)
    await repo.saveEvent(EVENT)
    await repo.saveGuests([guest('g1'), guest('g2')])
  })

  it('applies a check-in to the guest row and appends to the log', async () => {
    await repo.syncCheckins([
      { op: 'checkin', event_id: 'e1', guest_id: 'g1', checked_in_at: '2026-09-12T11:00:00Z', device_id: 'tablet-1' },
    ])
    const g1 = (await repo.listGuests('e1')).find((g) => g.id === 'g1')!
    expect(g1.checked_in_at).toBe('2026-09-12T11:00:00Z')
    expect((await repo.listCheckinLog('e1')).length).toBe(1)
  })

  it('is idempotent — resubmitting the same op does not duplicate the log', async () => {
    const op = { op: 'checkin' as const, event_id: 'e1', guest_id: 'g1', checked_in_at: '2026-09-12T11:00:00Z', device_id: 'tablet-1' }
    await repo.syncCheckins([op])
    await repo.syncCheckins([op, op])
    expect((await repo.listCheckinLog('e1')).length).toBe(1)
  })

  it('keeps the EARLIEST timestamp when duplicates disagree', async () => {
    await repo.syncCheckins([
      { op: 'checkin', event_id: 'e1', guest_id: 'g1', checked_in_at: '2026-09-12T11:05:00Z', device_id: 'tablet-2' },
    ])
    await repo.syncCheckins([
      { op: 'checkin', event_id: 'e1', guest_id: 'g1', checked_in_at: '2026-09-12T11:00:00Z', device_id: 'tablet-1' },
    ])
    const g1 = (await repo.listGuests('e1')).find((g) => g.id === 'g1')!
    expect(g1.checked_in_at).toBe('2026-09-12T11:00:00Z')
    // later timestamp arriving after does not move it forward
    await repo.syncCheckins([
      { op: 'checkin', event_id: 'e1', guest_id: 'g1', checked_in_at: '2026-09-12T11:30:00Z', device_id: 'tablet-3' },
    ])
    const again = (await repo.listGuests('e1')).find((g) => g.id === 'g1')!
    expect(again.checked_in_at).toBe('2026-09-12T11:00:00Z')
  })

  it('undo clears the guest check-in but keeps the log (append-only)', async () => {
    await repo.syncCheckins([
      { op: 'checkin', event_id: 'e1', guest_id: 'g1', checked_in_at: '2026-09-12T11:00:00Z', device_id: 'tablet-1' },
    ])
    await repo.syncCheckins([
      { op: 'undo', event_id: 'e1', guest_id: 'g1', checked_in_at: '2026-09-12T11:02:00Z', device_id: 'tablet-1' },
    ])
    const g1 = (await repo.listGuests('e1')).find((g) => g.id === 'g1')!
    expect(g1.checked_in_at).toBeNull()
    expect((await repo.listCheckinLog('e1')).length).toBe(1)
  })
})
