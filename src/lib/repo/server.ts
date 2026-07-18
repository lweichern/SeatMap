import { LocalVenueRepo } from './local'
import type { VenueRepo } from './types'

/**
 * Demo-mode repo backed by the dev server's shared store (/api/store), so
 * EVERY device on the network sees the same data — the laptop running the
 * pitch, the phone scanning a QR, the tablet at the door.
 *
 * Implementation: each call fetches the store snapshot, runs the exact
 * LocalVenueRepo logic against it, and writes it back if it changed. No
 * logic duplication; last-write-wins is acceptable at demo scale. Falls
 * back to browser localStorage if the API is unreachable, and migrates any
 * pre-existing localStorage data up to the shared store on first contact.
 */

const KEY = 'seatmap.v1'

class Snapshot {
  dirty = false
  constructor(public value: string | null) {}
  getItem() {
    return this.value
  }
  setItem(_k: string, v: string) {
    this.value = v
    this.dirty = true
  }
  removeItem() {
    this.value = null
    this.dirty = true
  }
}

async function fetchStore(): Promise<{ ok: boolean; raw: string | null }> {
  try {
    const res = await fetch('/api/store', { cache: 'no-store' })
    if (!res.ok) return { ok: false, raw: null }
    const text = await res.text()
    return { ok: true, raw: text && text !== 'null' ? text : null }
  } catch {
    return { ok: false, raw: null }
  }
}

async function putStore(body: string): Promise<void> {
  await fetch('/api/store', { method: 'PUT', body })
}

let migrated = false

export function createServerRepo(): VenueRepo {
  const call = async (method: string, args: unknown[]) => {
    const store = await fetchStore()
    let raw = store.raw

    // one-time: lift any data this browser accumulated pre-shared-store
    if (store.ok && raw === null && !migrated && typeof localStorage !== 'undefined') {
      migrated = true
      const legacy = localStorage.getItem(KEY)
      if (legacy) {
        raw = legacy
        await putStore(legacy)
      }
    }

    const snap = new Snapshot(store.ok ? raw : (localStorage.getItem(KEY) ?? null))
    const local = new LocalVenueRepo(snap as unknown as Storage)
    const fn = (local as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[method]
    const result = await fn.apply(local, args)
    if (snap.dirty && snap.value !== null) {
      if (store.ok) await putStore(snap.value)
      else localStorage.setItem(KEY, snap.value)
    }
    return result
  }

  return new Proxy(
    {},
    {
      get: (_t, prop: string) => {
        return (...args: unknown[]) => call(prop, args)
      },
    },
  ) as VenueRepo
}
