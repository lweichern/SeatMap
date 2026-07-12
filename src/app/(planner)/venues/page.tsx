'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getRepo } from '@/lib/repo'
import { newTableId } from '@/lib/layout-ops'
import type { Venue, VenueTableLayout } from '@/lib/types'

const LOCAL_ORG = 'local-org'

export default function VenuesPage() {
  const router = useRouter()
  const [venues, setVenues] = useState<Venue[]>([])
  const [layouts, setLayouts] = useState<Record<string, VenueTableLayout[]>>({})
  const [newName, setNewName] = useState('')
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    const repo = getRepo()
    const vs = await repo.listVenues()
    setVenues(vs)
    const entries = await Promise.all(
      vs.map(async (v) => [v.id, await repo.listLayouts(v.id)] as const),
    )
    setLayouts(Object.fromEntries(entries))
    setLoaded(true)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function createVenue() {
    const name = newName.trim()
    if (!name) return
    await getRepo().saveVenue({
      id: newTableId(),
      org_id: LOCAL_ORG,
      name,
      address: '',
      floorplan_url: null,
      scale_px_per_metre: null,
      width_m: null,
      height_m: null,
      walls: [],
      entrance: null,
      stage: null,
    })
    setNewName('')
    refresh()
  }

  async function createLayout(venueId: string) {
    const id = newTableId()
    await getRepo().saveLayout(
      { id, venue_id: venueId, name: 'New layout', capacity_total: 0 },
      [],
    )
    router.push(`/venues/${venueId}/layouts/${id}`)
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Venue library</h1>
      <p className="mt-1 text-sm text-slate-500">
        Map a hall once, reuse it for every event there.
      </p>

      <div className="mt-6 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && createVenue()}
          placeholder="e.g. Grand Ballroom @ Hilton KL"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          onClick={createVenue}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Add venue
        </button>
      </div>

      <div className="mt-8 space-y-4">
        {loaded && venues.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
            No venues yet — add your first hall above.
          </p>
        )}
        {venues.map((v) => (
          <div key={v.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">{v.name}</h2>
                <p className="text-xs text-slate-400">
                  {v.scale_px_per_metre ? 'Scale set' : 'Scale not set'} ·{' '}
                  {v.entrance ? 'Entrance marked' : 'Entrance missing'} ·{' '}
                  {(layouts[v.id] ?? []).length} layout(s)
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => createLayout(v.id)}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
                >
                  New layout
                </button>
                <button
                  onClick={async () => {
                    if (confirm(`Delete venue “${v.name}” and all its layouts?`)) {
                      await getRepo().deleteVenue(v.id)
                      refresh()
                    }
                  }}
                  className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
            {(layouts[v.id] ?? []).length > 0 && (
              <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
                {(layouts[v.id] ?? []).map((l) => (
                  <li key={l.id} className="flex items-center justify-between py-2">
                    <span className="text-sm text-slate-700">
                      {l.name}
                      <span className="ml-2 text-xs text-slate-400">
                        {l.capacity_total} pax
                      </span>
                    </span>
                    <button
                      onClick={() => router.push(`/venues/${v.id}/layouts/${l.id}`)}
                      className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                    >
                      Open editor
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
