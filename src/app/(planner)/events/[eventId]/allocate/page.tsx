'use client'

import Link from 'next/link'
import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getRepo } from '@/lib/repo'
import { allocate, type AllocationResult } from '@/lib/allocate'
import { AllocateMap } from '@/components/allocate/AllocateMap'
import { seatsOf } from '@/lib/layout-ops'
import type {
  Guest,
  GuestConstraint,
  Venue,
  VenueTable,
  WeddingEvent,
} from '@/lib/types'

export default function AllocatePage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = use(params)
  const [event, setEvent] = useState<WeddingEvent | null>(null)
  const [venue, setVenue] = useState<Venue | null>(null)
  const [tables, setTables] = useState<VenueTable[]>([])
  const [guests, setGuests] = useState<Guest[]>([])
  const [constraints, setConstraints] = useState<GuestConstraint[]>([])
  const [result, setResult] = useState<AllocationResult | null>(null)
  const [running, setRunning] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const workerRef = useRef<Worker | null>(null)

  const load = useCallback(async () => {
    const repo = getRepo()
    const e = await repo.getEvent(eventId)
    if (!e) return
    const [v, l, gs, cs] = await Promise.all([
      repo.getVenue(e.venue_id),
      repo.getLayout(e.layout_id),
      repo.listGuests(eventId),
      repo.listConstraints(eventId),
    ])
    setEvent(e)
    setVenue(v)
    setTables(l?.tables ?? [])
    // declined RSVPs never reach the seating board
    setGuests(gs.filter((g) => g.rsvp !== 'no'))
    setConstraints(cs)
  }, [eventId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => () => workerRef.current?.terminate(), [])

  const persist = useCallback(async (updated: Guest[]) => {
    setGuests(updated)
    await getRepo().saveGuests(updated)
  }, [])

  const runAllocation = useCallback(() => {
    if (!tables.length || !guests.length) return
    setRunning(true)
    const input = {
      guests,
      tables,
      constraints,
      stage: venue?.stage ?? null,
      seed: Date.now() % 100000,
    }
    const apply = (r: AllocationResult) => {
      setResult(r)
      setRunning(false)
      persist(
        guests.map((g) =>
          g.locked ? g : { ...g, table_id: r.assignments[g.id] ?? null },
        ),
      )
    }
    try {
      const worker = new Worker(
        new URL('../../../../../workers/allocate.worker.ts', import.meta.url),
      )
      workerRef.current = worker
      worker.onmessage = (e: MessageEvent<AllocationResult>) => {
        apply(e.data)
        worker.terminate()
      }
      worker.onerror = () => {
        worker.terminate()
        apply(allocate(input)) // worker unavailable → run inline
      }
      worker.postMessage(input)
    } catch {
      apply(allocate(input))
    }
  }, [tables, guests, constraints, venue, persist])

  const byTable = useMemo(() => {
    const m = new Map<string | null, Guest[]>()
    for (const g of guests) {
      const key = g.table_id && tables.some((t) => t.id === g.table_id) ? g.table_id : null
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(g)
    }
    return m
  }, [guests, tables])

  const guestName = (id: string) => guests.find((g) => g.id === id)?.name ?? '?'

  async function moveGuest(guestId: string, tableId: string | null) {
    const updated = guests.map((g) =>
      g.id === guestId ? { ...g, table_id: tableId } : g,
    )
    await persist(updated)
  }

  async function toggleLock(guestId: string) {
    const updated = guests.map((g) =>
      g.id === guestId ? { ...g, locked: !g.locked } : g,
    )
    await persist(updated)
  }

  const unassigned = byTable.get(null) ?? []
  const paxByTable = useMemo(() => {
    const m = new Map<string, number>()
    for (const [tid, gs] of byTable) {
      if (tid) m.set(tid, gs.reduce((s, g) => s + g.party_size, 0))
    }
    return m
  }, [byTable])
  const selectedTable = tables.find((t) => t.id === selectedTableId) ?? null
  const selectedPax = selectedTableId ? (paxByTable.get(selectedTableId) ?? 0) : 0
  const seatedPax = guests
    .filter((g) => g.table_id)
    .reduce((s, g) => s + g.party_size, 0)

  function Chip({ g }: { g: Guest }) {
    return (
      <span
        draggable
        onDragStart={(e) => {
          // carry the id in the drag payload so the drop never depends on state
          e.dataTransfer.setData('text/plain', g.id)
          e.dataTransfer.effectAllowed = 'move'
          // ⚠️ defer the ghost-style re-render: mutating the dragged element
          // during dragstart makes Chrome CANCEL the drag (the "first drag
          // does nothing, second works" bug)
          setTimeout(() => setDragId(g.id), 0)
        }}
        onDragEnd={() => setDragId(null)}
        className={`inline-flex cursor-grab items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
          g.locked
            ? 'border-amber-300 bg-amber-50 text-amber-900'
            : 'border-slate-200 bg-white text-slate-700'
        } ${dragId === g.id ? 'opacity-40' : ''}`}
        title={g.group_tag ?? undefined}
      >
        {g.is_vip && <span className="text-amber-500">★</span>}
        {g.name}
        {g.party_size > 1 && <span className="text-slate-400">×{g.party_size}</span>}
        <button
          onClick={() => toggleLock(g.id)}
          className={g.locked ? 'text-amber-600' : 'text-slate-300 hover:text-slate-500'}
          title={g.locked ? 'Unlock (include in re-allocation)' : 'Lock to this table'}
        >
          {g.locked ? '🔒' : '🔓'}
        </button>
      </span>
    )
  }

  function DropZone({
    tableId,
    children,
    className,
  }: {
    tableId: string | null
    children: React.ReactNode
    className: string
  }) {
    return (
      <div
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
        }}
        onDrop={(e) => {
          e.preventDefault()
          const id = e.dataTransfer.getData('text/plain') || dragId
          if (id) moveGuest(id, tableId)
          setDragId(null)
        }}
        className={className}
      >
        {children}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/events/${eventId}/guests`}
          className="text-sm text-slate-400 hover:text-slate-700"
        >
          ← Guests
        </Link>
        <h1 className="text-xl font-bold text-slate-900">
          Seating — {event?.couple_names}
        </h1>
        <span className="text-sm text-slate-400">
          {seatedPax} pax seated · {unassigned.length} guest(s) unassigned
        </span>
        <button
          onClick={runAllocation}
          disabled={running || guests.length === 0 || tables.length === 0}
          className="ml-auto rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
        >
          {running ? 'Allocating…' : 'Auto-allocate'}
        </button>
      </div>

      {tables.length === 0 && (
        <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          This event&apos;s layout has no tables yet — add tables in the hall editor first.
        </p>
      )}

      {result && result.broken.length > 0 && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <strong>Unsatisfiable rules — fix the guest list or add tables:</strong>
          <ul className="mt-1 list-inside list-disc">
            {result.broken.map((b, i) => (
              <li key={i}>
                {guestName(b.guest_a_id)} and {guestName(b.guest_b_id)} could not be
                separated
              </li>
            ))}
          </ul>
        </div>
      )}
      {result && result.unseated.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <strong>Not enough seats for:</strong>{' '}
          {result.unseated.map(guestName).join(', ')}
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[260px_1fr_290px]">
        <DropZone
          tableId={null}
          className="h-fit rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-3"
        >
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Unassigned ({unassigned.length})
          </h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {unassigned.map((g) => (
              <Chip key={g.id} g={g} />
            ))}
            {unassigned.length === 0 && (
              <p className="text-xs text-slate-400">Everyone is seated 🎉</p>
            )}
          </div>
          <p className="mt-3 text-[10px] leading-snug text-slate-400">
            Drag a guest onto a table on the map — or onto this box to
            unassign them.
          </p>
        </DropZone>

        {/* the map IS the floor plan the hall editor drew */}
        <div className="h-[68vh] min-h-96 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {venue ? (
            <AllocateMap
              venue={venue}
              tables={tables}
              paxByTable={paxByTable}
              selectedId={selectedTableId}
              onSelect={setSelectedTableId}
              onDropGuest={(guestId, tableId) => {
                moveGuest(guestId, tableId)
                setSelectedTableId(tableId)
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              Loading floor plan…
            </div>
          )}
        </div>

        <div className="h-fit rounded-lg border border-slate-200 bg-white p-3">
          {selectedTable ? (
            <>
              <div className="flex items-baseline justify-between">
                <h3 className="font-semibold text-slate-900">
                  Table {selectedTable.label}
                </h3>
                <span
                  className={`text-xs font-medium ${
                    selectedPax > seatsOf(selectedTable) ? 'text-red-600' : 'text-slate-400'
                  }`}
                >
                  {selectedPax}/{seatsOf(selectedTable)} seats
                </span>
              </div>
              <DropZone
                tableId={selectedTable.id}
                className="mt-2 flex min-h-16 flex-wrap content-start gap-1.5 rounded-md border border-dashed border-slate-200 p-2"
              >
                {(byTable.get(selectedTable.id) ?? []).map((g) => (
                  <Chip key={g.id} g={g} />
                ))}
                {(byTable.get(selectedTable.id) ?? []).length === 0 && (
                  <p className="text-xs text-slate-400">
                    Empty — drop guests here or on the map.
                  </p>
                )}
              </DropZone>
            </>
          ) : (
            <p className="text-xs leading-relaxed text-slate-400">
              Click a table on the map to see who&apos;s seated there. Colours:
              white = empty, blue = partially filled, green = full, red = over
              capacity.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
