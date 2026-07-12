// @vitest-environment node
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { GreeterDb } from './greeter-db'
import { signToken } from './token'
import type { Guest, VenueTable } from './types'

const SECRET = 'secret-1'

function guest(id: string, over: Partial<Guest> = {}): Guest {
  return {
    id,
    event_id: 'e1',
    name: `Guest ${id}`,
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
    ...over,
  }
}

function table(id: string, label: string): VenueTable {
  return { id, layout_id: 'l1', label, x: 0, y: 0, seats: 10, shape: 'round', diameter_m: 1.8 }
}

describe('GreeterDb', () => {
  let db: GreeterDb

  beforeEach(async () => {
    db = new GreeterDb(`test-${Math.random()}`)
    const guests = [
      guest('g1', { qr_token: await signToken('e1', 'g1', SECRET), phone: '0123456789' }),
      guest('g2', { qr_token: await signToken('e1', 'g2', SECRET), name: '陈美玲' }),
    ]
    await db.cacheEvent({
      eventId: 'e1',
      secret: SECRET,
      coupleNames: 'A & B',
      deviceId: 'tablet-1',
      guests,
      tables: [table('t1', '1'), table('t2', '2')],
    })
  })

  it('reports cached counts (the "ready for offline" state)', async () => {
    const status = await db.status()
    expect(status).toMatchObject({ eventId: 'e1', guestCount: 2, tableCount: 2 })
  })

  it('resolves a valid scanned token to the guest, fully offline', async () => {
    const token = await signToken('e1', 'g2', SECRET)
    const hit = await db.lookupToken(token)
    expect(hit?.guest.name).toBe('陈美玲')
    expect(hit?.table?.label).toBe('1')
  })

  it('rejects a forged token', async () => {
    const forged = await signToken('e1', 'g2', 'wrong-secret')
    expect(await db.lookupToken(forged)).toBeNull()
  })

  it('rejects a valid token for a different event', async () => {
    const other = await signToken('e2', 'g1', SECRET)
    expect(await db.lookupToken(other)).toBeNull()
  })

  it('searches by name and phone', async () => {
    expect((await db.search('美玲')).map((g) => g.id)).toEqual(['g2'])
    expect((await db.search('01234')).map((g) => g.id)).toEqual(['g1'])
    expect(await db.search('')).toHaveLength(0)
  })

  it('check-in writes guest state + outbox op', async () => {
    await db.checkIn('g1', '2026-09-12T11:00:00Z')
    const g = await db.getGuest('g1')
    expect(g?.checked_in_at).toBe('2026-09-12T11:00:00Z')
    const pending = await db.pendingOps()
    expect(pending.length).toBe(1)
    expect(pending[0]).toMatchObject({ op: 'checkin', guest_id: 'g1', device_id: 'tablet-1' })
  })

  it('check-in is first-scan-wins locally', async () => {
    await db.checkIn('g1', '2026-09-12T11:00:00Z')
    await db.checkIn('g1', '2026-09-12T11:09:00Z')
    expect((await db.getGuest('g1'))?.checked_in_at).toBe('2026-09-12T11:00:00Z')
    expect((await db.pendingOps()).length).toBe(1) // second scan is a no-op
  })

  it('undo clears state and queues an undo op', async () => {
    await db.checkIn('g1', '2026-09-12T11:00:00Z')
    await db.undoCheckIn('g1', '2026-09-12T11:01:00Z')
    expect((await db.getGuest('g1'))?.checked_in_at).toBeNull()
    const ops = await db.pendingOps()
    expect(ops.map((o) => o.op)).toEqual(['checkin', 'undo'])
  })

  it('walk-in adds a guest assigned to a table', async () => {
    const g = await db.addWalkIn('Uninvited Cousin', 't2', 2)
    expect((await db.getGuest(g.id))?.table_id).toBe('t2')
    expect((await db.status()).guestCount).toBe(3)
    const pending = await db.pendingOps()
    expect(pending.some((o) => o.op === 'walkin' && o.guest_id === g.id)).toBe(true)
  })

  it('markSynced clears the outbox', async () => {
    await db.checkIn('g1', '2026-09-12T11:00:00Z')
    const ops = await db.pendingOps()
    await db.markSynced(ops.map((o) => o.seq!))
    expect(await db.pendingOps()).toHaveLength(0)
  })

  it('occupancy counts checked-in pax per table', async () => {
    await db.checkIn('g1', '2026-09-12T11:00:00Z')
    const occ = await db.occupancy()
    const t1 = occ.find((o) => o.table.id === 't1')!
    expect(t1.checkedInPax).toBe(1)
    expect(t1.totalPax).toBe(2)
  })
})
