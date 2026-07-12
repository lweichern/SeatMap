import Dexie, { type Table } from 'dexie'
import { verifyToken } from './token'
import { newTableId } from './layout-ops'
import type { Guest, VenueTable } from './types'

/**
 * The greeter tablet's offline brain. EVERYTHING needed to check guests in —
 * guest list, tokens, table layout, the event secret for local HMAC
 * verification — is cached here before doors open. Zero bars required.
 */

export interface GreeterMeta {
  key: string // always 'meta'
  eventId: string
  secret: string
  coupleNames: string
  deviceId: string
  cachedAt: string
}

export interface OutboxOp {
  seq?: number
  op: 'checkin' | 'undo' | 'walkin'
  event_id: string
  guest_id: string
  checked_in_at: string
  device_id: string
  /** full guest row for walk-ins so the server can create it */
  guest?: Guest
}

export interface CacheEventInput {
  eventId: string
  secret: string
  coupleNames: string
  deviceId: string
  guests: Guest[]
  tables: VenueTable[]
}

export class GreeterDb extends Dexie {
  meta!: Table<GreeterMeta, string>
  guests!: Table<Guest, string>
  // 'tables' would shadow Dexie's built-in .tables property
  venueTables!: Table<VenueTable, string>
  outbox!: Table<OutboxOp, number>

  constructor(name = 'seatmap-greeter') {
    super(name)
    this.version(1).stores({
      meta: 'key',
      guests: 'id, qr_token, name',
      venueTables: 'id',
      outbox: '++seq',
    })
  }

  async cacheEvent(input: CacheEventInput): Promise<void> {
    await this.transaction('rw', [this.meta, this.guests, this.venueTables], async () => {
      await this.guests.clear()
      await this.venueTables.clear()
      await this.meta.put({
        key: 'meta',
        eventId: input.eventId,
        secret: input.secret,
        coupleNames: input.coupleNames,
        deviceId: input.deviceId,
        cachedAt: new Date().toISOString(),
      })
      await this.guests.bulkPut(input.guests)
      await this.venueTables.bulkPut(input.tables)
    })
  }

  async status(): Promise<{
    eventId: string | null
    coupleNames: string
    guestCount: number
    tableCount: number
    pendingOps: number
    cachedAt: string | null
  }> {
    const meta = await this.meta.get('meta')
    return {
      eventId: meta?.eventId ?? null,
      coupleNames: meta?.coupleNames ?? '',
      guestCount: await this.guests.count(),
      tableCount: await this.venueTables.count(),
      pendingOps: await this.outbox.count(),
      cachedAt: meta?.cachedAt ?? null,
    }
  }

  async getGuest(id: string): Promise<Guest | undefined> {
    return this.guests.get(id)
  }

  /** Verify a scanned token 100% locally and resolve guest + table. */
  async lookupToken(
    token: string,
  ): Promise<{ guest: Guest; table: VenueTable | null } | null> {
    const meta = await this.meta.get('meta')
    if (!meta) return null
    const payload = await verifyToken(token.trim(), meta.secret)
    if (!payload || payload.event_id !== meta.eventId) return null
    const guest = await this.guests.get(payload.guest_id)
    if (!guest) return null
    const table = guest.table_id ? ((await this.venueTables.get(guest.table_id)) ?? null) : null
    return { guest, table }
  }

  /** Name/phone search for the uncle who lost his QR. */
  async search(q: string): Promise<Guest[]> {
    const needle = q.trim().toLowerCase()
    if (!needle) return []
    const all = await this.guests.toArray()
    return all
      .filter(
        (g) =>
          g.name.toLowerCase().includes(needle) || (g.phone ?? '').includes(needle),
      )
      .slice(0, 20)
  }

  /** First scan wins locally; duplicate scans are no-ops. */
  async checkIn(guestId: string, at: string): Promise<Guest | null> {
    const meta = await this.meta.get('meta')
    if (!meta) return null
    return this.transaction('rw', [this.guests, this.outbox], async () => {
      const guest = await this.guests.get(guestId)
      if (!guest) return null
      if (guest.checked_in_at) return guest
      const updated = { ...guest, checked_in_at: at }
      await this.guests.put(updated)
      await this.outbox.add({
        op: 'checkin',
        event_id: meta.eventId,
        guest_id: guestId,
        checked_in_at: at,
        device_id: meta.deviceId,
      })
      return updated
    })
  }

  async undoCheckIn(guestId: string, at: string): Promise<void> {
    const meta = await this.meta.get('meta')
    if (!meta) return
    await this.transaction('rw', [this.guests, this.outbox], async () => {
      const guest = await this.guests.get(guestId)
      if (!guest || !guest.checked_in_at) return
      await this.guests.put({ ...guest, checked_in_at: null })
      await this.outbox.add({
        op: 'undo',
        event_id: meta.eventId,
        guest_id: guestId,
        checked_in_at: at,
        device_id: meta.deviceId,
      })
    })
  }

  /** Walk-ins happen at every single wedding. Checked in immediately. */
  async addWalkIn(name: string, tableId: string, partySize = 1): Promise<Guest> {
    const meta = await this.meta.get('meta')
    if (!meta) throw new Error('No event cached')
    const now = new Date().toISOString()
    const guest: Guest = {
      id: newTableId(),
      event_id: meta.eventId,
      name: name.trim(),
      phone: null,
      email: null,
      party_size: partySize,
      side: 'both',
      group_tag: 'Walk-in',
      is_vip: false,
      table_id: tableId,
      qr_token: null,
      checked_in_at: now,
      locked: false,
    }
    await this.transaction('rw', [this.guests, this.outbox], async () => {
      await this.guests.put(guest)
      await this.outbox.add({
        op: 'walkin',
        event_id: meta.eventId,
        guest_id: guest.id,
        checked_in_at: now,
        device_id: meta.deviceId,
        guest,
      })
    })
    return guest
  }

  async pendingOps(): Promise<OutboxOp[]> {
    return this.outbox.orderBy('seq').toArray()
  }

  async markSynced(seqs: number[]): Promise<void> {
    await this.outbox.bulkDelete(seqs)
  }

  async occupancy(): Promise<
    { table: VenueTable; checkedInPax: number; totalPax: number }[]
  > {
    const [tables, guests] = await Promise.all([
      this.venueTables.toArray(),
      this.guests.toArray(),
    ])
    return tables
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
      .map((table) => {
        const at = guests.filter((g) => g.table_id === table.id)
        return {
          table,
          checkedInPax: at
            .filter((g) => g.checked_in_at)
            .reduce((s, g) => s + g.party_size, 0),
          totalPax: at.reduce((s, g) => s + g.party_size, 0),
        }
      })
  }
}

let instance: GreeterDb | null = null
export function getGreeterDb(): GreeterDb {
  if (!instance) instance = new GreeterDb()
  return instance
}
