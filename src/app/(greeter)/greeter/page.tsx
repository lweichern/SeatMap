'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getRepo } from '@/lib/repo'
import { getGreeterDb } from '@/lib/greeter-db'
import { ensureTokens } from '@/lib/qr-export'
import type { WeddingEvent } from '@/lib/types'

/**
 * Event picker + offline cache loader. This page needs connectivity;
 * everything after it must not.
 */
export default function GreeterHome() {
  const router = useRouter()
  const [events, setEvents] = useState<WeddingEvent[]>([])
  const [cached, setCached] = useState<{ eventId: string | null; guestCount: number; coupleNames: string }>()
  const [loading, setLoading] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    getRepo()
      .listEvents()
      .then(setEvents)
      .catch(() => setError('Could not load events — are you online?'))
    getGreeterDb().status().then(setCached)
  }, [])

  async function loadEvent(e: WeddingEvent) {
    setLoading(e.id)
    setError('')
    try {
      const repo = getRepo()
      const [rawGuests, layout] = await Promise.all([
        repo.listGuests(e.id),
        repo.getLayout(e.layout_id),
      ])
      // tokens must exist before caching — the QR on the door is the token
      const guests = await ensureTokens(e, rawGuests)
      const fresh = guests.filter((g, i) => g !== rawGuests[i])
      if (fresh.length > 0) await repo.saveGuests(fresh)

      let deviceId = localStorage.getItem('seatmap.device_id')
      if (!deviceId) {
        deviceId = `tablet-${Math.random().toString(36).slice(2, 8)}`
        localStorage.setItem('seatmap.device_id', deviceId)
      }
      await getGreeterDb().cacheEvent({
        eventId: e.id,
        secret: e.guest_token_secret,
        coupleNames: e.couple_names,
        deviceId,
        guests,
        tables: layout?.tables ?? [],
      })
      router.push('/greeter/checkin')
    } catch (err) {
      console.error(err)
      setError('Caching failed — check connectivity and retry.')
      setLoading('')
    }
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-10">
      <h1 className="text-2xl font-bold">Greeter check-in</h1>
      <p className="mt-1 text-sm text-slate-400">
        Load an event over wifi <em>before doors open</em>. After that, this
        tablet works with zero bars.
      </p>

      {cached?.eventId && (
        <button
          onClick={() => router.push('/greeter/checkin')}
          className="mt-6 w-full rounded-xl border-2 border-emerald-500 bg-emerald-500/10 p-4 text-left"
        >
          <span className="text-sm font-medium text-emerald-400">
            ✅ Ready for offline — {cached.guestCount} guests cached
          </span>
          <p className="text-xs text-slate-400">
            {cached.coupleNames} · tap to continue checking in
          </p>
        </button>
      )}

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <div className="mt-6 space-y-3">
        {events.map((e) => (
          <button
            key={e.id}
            disabled={loading !== ''}
            onClick={() => loadEvent(e)}
            className="w-full rounded-xl bg-slate-800 p-4 text-left hover:bg-slate-700 disabled:opacity-50"
          >
            <span className="font-semibold">{e.couple_names}</span>
            <p className="text-xs text-slate-400">{e.event_date}</p>
            {loading === e.id && (
              <p className="mt-1 text-xs text-amber-400">Caching guests…</p>
            )}
          </button>
        ))}
        {events.length === 0 && !error && (
          <p className="text-sm text-slate-500">No events found.</p>
        )}
      </div>
    </div>
  )
}
