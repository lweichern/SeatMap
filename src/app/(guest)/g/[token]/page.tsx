'use client'

import dynamic from 'next/dynamic'
import { Component, use, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { resolveGuest, type GuestView } from '@/lib/guest-view'
import { describeTablePosition } from '@/lib/directions'
import { Hall2D, type HallViewProps } from '@/components/guest/Hall2D'
import { PhotoTab } from '@/components/guest/PhotoTab'
import { findPath } from '@/lib/pathfinding'
import type { HallSceneProps } from '@/lib/scene-builder'

const GuestHall3D = dynamic(() => import('@/components/guest/GuestHall3D'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-slate-500">
      Loading map…
    </div>
  ),
})

/** If WebGL is broken in any way, the 2D map takes over. Never a blank screen. */
class MapErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export default function GuestPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const search = useSearchParams()
  const [view, setView] = useState<GuestView | null | 'loading'>('loading')
  const [use3d, setUse3d] = useState(false)
  const [tab, setTab] = useState<'map' | 'menu' | 'photos'>('map')

  useEffect(() => {
    resolveGuest(token).then(setView)
    setUse3d(webglAvailable() && search.get('2d') !== '1')
  }, [token, search])

  if (view === 'loading') {
    return (
      <Shell>
        <p className="mt-24 text-center text-slate-400">Finding your seat…</p>
      </Shell>
    )
  }

  if (!view) {
    return (
      <Shell>
        <div className="mt-20 px-6 text-center">
          <p className="text-2xl font-bold text-slate-100">Hmm, that link isn&apos;t working</p>
          <p className="mt-3 text-slate-400">
            This QR code isn&apos;t valid. Please see the greeter at the entrance —
            they&apos;ll find your table in seconds.
          </p>
        </div>
      </Shell>
    )
  }

  const { guest, event, venue, tables, table } = view
  return (
    <GuestBody
      guest={guest}
      event={event}
      venue={venue}
      tables={tables}
      table={table}
      use3d={use3d}
      tab={tab}
      setTab={setTab}
    />
  )
}

function GuestBody({
  guest,
  event,
  venue,
  tables,
  table,
  use3d,
  tab,
  setTab,
}: {
  guest: GuestView['guest']
  event: GuestView['event']
  venue: GuestView['venue']
  tables: GuestView['tables']
  table: GuestView['table']
  use3d: boolean
  tab: 'map' | 'menu' | 'photos'
  setTab: (t: 'map' | 'menu' | 'photos') => void
}) {
  // walking route: desk → door → table, same solver the editor uses
  const route = useMemo(
    () => (table && (venue.registration || venue.door) ? findPath(venue, tables, table.id) : null),
    [venue, tables, table],
  )

  const hallProps: HallViewProps = {
    widthM: venue.width_m ?? 40,
    heightM: venue.height_m ?? 25,
    walls: venue.walls,
    door: venue.door,
    doorWidthM: venue.door_width_m,
    registration: venue.registration,
    stage: venue.stage,
    tables,
    guestTableId: table?.id ?? null,
    route: route?.path,
    routeOk: route?.ok,
  }
  const sceneProps: HallSceneProps = {
    walls: venue.walls,
    door: venue.door,
    doorWidthM: venue.door_width_m,
    registration: venue.registration,
    stage: venue.stage,
    tables,
    highlightTableId: table?.id ?? null,
    route,
    fallbackSpan: { w: venue.width_m ?? 30, h: venue.height_m ?? 20 },
  }

  return (
    <Shell>
      <header className="px-6 pt-8 text-center">
        <p className="text-sm uppercase tracking-widest text-slate-400">
          {event.couple_names}
        </p>
        <p className="mt-1 text-lg text-slate-300">Welcome, {guest.name}</p>
        {table ? (
          <>
            <p className="mt-4 text-[17vw] font-black leading-none tracking-tight text-amber-400 sm:text-8xl">
              TABLE {table.label}
            </p>
            <p className="mt-3 text-slate-300">{describeTablePosition(table, venue)}</p>
            {guest.party_size > 1 && (
              <p className="mt-1 text-sm text-slate-500">
                {guest.party_size} seats reserved for your party
              </p>
            )}
          </>
        ) : (
          <p className="mt-6 text-2xl font-bold text-slate-100">
            Please see the greeter for your table
          </p>
        )}
      </header>

      <div className="mx-auto mt-6 flex w-full max-w-md gap-2 px-6">
        {(
          [
            ['map', 'Find my table'],
            ...(event.menu && event.menu.length > 0 ? [['menu', 'Menu']] : []),
            ['photos', 'Photos'],
          ] as ['map' | 'menu' | 'photos', string][]
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full py-2 text-sm font-semibold ${
              tab === t ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'map' && (
        <div className="mx-auto mt-4 h-[62vh] w-full max-w-3xl overflow-hidden rounded-t-2xl px-2">
          {use3d ? (
            <MapErrorBoundary fallback={<Hall2D {...hallProps} />}>
              <GuestHall3D {...sceneProps} />
            </MapErrorBoundary>
          ) : (
            <Hall2D {...hallProps} />
          )}
        </div>
      )}

      {tab === 'menu' && (
        <div className="mx-auto mt-6 w-full max-w-md px-6 pb-10">
          <p className="text-center text-xs uppercase tracking-widest text-slate-500">
            Tonight&apos;s menu
          </p>
          <ol className="mt-4 space-y-4">
            {(event.menu ?? []).map((m, i) => (
              <li key={m.id}>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-amber-500/40 text-xs font-bold text-amber-400">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-100">{m.name}</p>
                    {m.description && (
                      <p className="mt-0.5 text-sm text-slate-400">{m.description}</p>
                    )}
                  </div>
                </div>
                {m.photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.photo}
                    alt={m.name}
                    loading="lazy"
                    className="mt-2 aspect-video w-full rounded-xl object-cover"
                  />
                )}
              </li>
            ))}
          </ol>
          <p className="mt-8 text-center text-xs text-slate-600">
            {(event.menu ?? []).length} courses · served in this order
          </p>
        </div>
      )}

      {tab === 'photos' && (
        <PhotoTab eventId={event.id} guestId={guest.id} photoMode={event.photo_mode} />
      )}
    </Shell>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-slate-900 pb-6">{children}</div>
}
