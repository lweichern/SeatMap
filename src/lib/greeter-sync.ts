import { getRepo } from './repo'
import { getGreeterDb, type OutboxOp } from './greeter-db'

/**
 * Push the outbox to the server. Safe to call any time — every op is
 * idempotent server-side, so a sync that dies halfway just retries later.
 * Returns the number of ops flushed.
 */
export async function flushOutbox(): Promise<number> {
  const db = getGreeterDb()
  const ops = await db.pendingOps()
  if (ops.length === 0) return 0
  const repo = getRepo()

  // walk-ins first: their guest rows must exist before check-in ops reference them
  const walkins = ops.filter((o): o is OutboxOp & { guest: NonNullable<OutboxOp['guest']> } =>
    o.op === 'walkin' && !!o.guest,
  )
  if (walkins.length > 0) {
    await repo.saveGuests(walkins.map((o) => o.guest))
  }

  const checkinOps = ops
    .filter((o) => o.op !== 'walkin' || o.guest)
    .map((o) => ({
      op: o.op === 'undo' ? ('undo' as const) : ('checkin' as const),
      event_id: o.event_id,
      guest_id: o.guest_id,
      checked_in_at: o.checked_in_at,
      device_id: o.device_id,
    }))
  await repo.syncCheckins(checkinOps)

  await db.markSynced(ops.map((o) => o.seq!))
  return ops.length
}

/** Auto-sync loop: flush whenever connectivity returns + every 30s. */
export function startSyncLoop(onSync: (flushed: number, pending: number) => void) {
  let stopped = false
  const tick = async () => {
    if (stopped || !navigator.onLine) return
    try {
      const flushed = await flushOutbox()
      const { pendingOps } = await getGreeterDb().status()
      onSync(flushed, pendingOps)
    } catch (err) {
      console.error('sync failed, will retry', err)
    }
  }
  const interval = setInterval(tick, 30_000)
  window.addEventListener('online', tick)
  tick()
  return () => {
    stopped = true
    clearInterval(interval)
    window.removeEventListener('online', tick)
  }
}
