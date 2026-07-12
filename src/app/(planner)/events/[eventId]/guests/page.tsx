'use client'

import Link from 'next/link'
import { use, useCallback, useEffect, useMemo, useState } from 'react'
import { getRepo } from '@/lib/repo'
import { newTableId } from '@/lib/layout-ops'
import { ImportDialog } from '@/components/guests/ImportDialog'
import { ConstraintsPanel } from '@/components/guests/ConstraintsPanel'
import type { Guest, GuestConstraint, GuestSide, WeddingEvent } from '@/lib/types'

type SideFilter = 'all' | GuestSide
const EMPTY_NEW = { name: '', party: 1 }

export default function GuestsPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = use(params)
  const [event, setEvent] = useState<WeddingEvent | null>(null)
  const [guests, setGuests] = useState<Guest[]>([])
  const [constraints, setConstraints] = useState<GuestConstraint[]>([])
  const [q, setQ] = useState('')
  const [side, setSide] = useState<SideFilter>('all')
  const [vipOnly, setVipOnly] = useState(false)
  const [importing, setImporting] = useState(false)
  const [newGuest, setNewGuest] = useState(EMPTY_NEW)

  const refresh = useCallback(async () => {
    const repo = getRepo()
    const [e, gs, cs] = await Promise.all([
      repo.getEvent(eventId),
      repo.listGuests(eventId),
      repo.listConstraints(eventId),
    ])
    setEvent(e)
    setGuests(gs)
    setConstraints(cs)
  }, [eventId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return guests.filter((g) => {
      if (needle && !g.name.toLowerCase().includes(needle) && !(g.phone ?? '').includes(needle))
        return false
      if (side !== 'all' && g.side !== side) return false
      if (vipOnly && !g.is_vip) return false
      return true
    })
  }, [guests, q, side, vipOnly])

  const totalPax = guests.reduce((s, g) => s + g.party_size, 0)

  async function patch(id: string, p: Partial<Guest>) {
    const g = guests.find((x) => x.id === id)
    if (!g) return
    const updated = { ...g, ...p }
    setGuests((gs) => gs.map((x) => (x.id === id ? updated : x)))
    await getRepo().saveGuest(updated)
  }

  async function addManual() {
    const name = newGuest.name.trim()
    if (!name) return
    await getRepo().saveGuest({
      id: newTableId(),
      event_id: eventId,
      name,
      phone: null,
      email: null,
      party_size: newGuest.party,
      side: 'both',
      group_tag: null,
      is_vip: false,
      table_id: null,
      qr_token: null,
      checked_in_at: null,
      locked: false,
    })
    setNewGuest(EMPTY_NEW)
    refresh()
  }

  const input = 'rounded border border-slate-300 px-2 py-1 text-xs w-full'

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <div className="flex items-center gap-3">
        <Link href="/events" className="text-sm text-slate-400 hover:text-slate-700">
          ← Events
        </Link>
        <h1 className="text-xl font-bold text-slate-900">{event?.couple_names}</h1>
        <span className="text-sm text-slate-400">
          {guests.length} guests · {totalPax} pax
        </span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setImporting(true)}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Import CSV/Excel
          </button>
          <Link
            href={`/events/${eventId}/allocate`}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
          >
            Seating →
          </Link>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or phone…"
          className="w-56 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
        <select
          value={side}
          onChange={(e) => setSide(e.target.value as SideFilter)}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="all">Both sides</option>
          <option value="bride">Bride</option>
          <option value="groom">Groom</option>
          <option value="both">Shared</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={vipOnly}
            onChange={(e) => setVipOnly(e.target.checked)}
          />
          VIP only
        </label>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2 w-20">Pax</th>
                <th className="px-3 py-2 w-28">Side</th>
                <th className="px-3 py-2 w-36">Group</th>
                <th className="px-3 py-2 w-16">VIP</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => (
                <tr key={g.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-3 py-1.5">
                    <input
                      value={g.name}
                      onChange={(e) => patch(g.id, { name: e.target.value })}
                      className={input}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      min={1}
                      value={g.party_size}
                      onChange={(e) =>
                        patch(g.id, { party_size: Math.max(1, Number(e.target.value)) })
                      }
                      className={input}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <select
                      value={g.side}
                      onChange={(e) => patch(g.id, { side: e.target.value as GuestSide })}
                      className={input}
                    >
                      <option value="bride">bride</option>
                      <option value="groom">groom</option>
                      <option value="both">both</option>
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      value={g.group_tag ?? ''}
                      onChange={(e) => patch(g.id, { group_tag: e.target.value || null })}
                      placeholder="—"
                      className={input}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={g.is_vip}
                      onChange={(e) => patch(g.id, { is_vip: e.target.checked })}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <button
                      onClick={async () => {
                        await getRepo().deleteGuest(g.id)
                        refresh()
                      }}
                      className="text-slate-300 hover:text-red-600"
                      title="Remove guest"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
              <tr>
                <td className="px-3 py-2">
                  <input
                    value={newGuest.name}
                    onChange={(e) => setNewGuest({ ...newGuest, name: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && addManual()}
                    placeholder="+ Add guest…"
                    className={input}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={1}
                    value={newGuest.party}
                    onChange={(e) =>
                      setNewGuest({ ...newGuest, party: Math.max(1, Number(e.target.value)) })
                    }
                    className={input}
                  />
                </td>
                <td colSpan={4} className="px-3 py-2">
                  <button
                    onClick={addManual}
                    disabled={!newGuest.name.trim()}
                    className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-40"
                  >
                    Add
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          {guests.length === 0 && (
            <p className="p-8 text-center text-sm text-slate-400">
              No guests yet — import a spreadsheet or add them above.
            </p>
          )}
        </div>

        <ConstraintsPanel
          eventId={eventId}
          guests={guests}
          constraints={constraints}
          onAdd={async (c) => {
            await getRepo().saveConstraint(c)
            refresh()
          }}
          onRemove={async (id) => {
            await getRepo().deleteConstraint(id)
            refresh()
          }}
        />
      </div>

      {importing && (
        <ImportDialog
          eventId={eventId}
          onClose={() => setImporting(false)}
          onImport={async (gs) => {
            await getRepo().saveGuests(gs)
            refresh()
          }}
        />
      )}
    </div>
  )
}
