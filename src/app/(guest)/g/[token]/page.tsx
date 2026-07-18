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
    <div className="flex h-full items-center justify-center bg-[#14100a] text-sm text-[#d9c48e]">
      Setting the scene…
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

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV']

export default function GuestPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const search = useSearchParams()
  const [view, setView] = useState<GuestView | null | 'loading'>('loading')
  const [webgl, setWebgl] = useState(false)
  const [pref3d, setPref3d] = useState(true)
  const [tab, setTab] = useState<'map' | 'menu' | 'photos'>('map')

  useEffect(() => {
    resolveGuest(token).then(setView)
    setWebgl(webglAvailable())
    setPref3d(search.get('2d') !== '1')
  }, [token, search])

  if (view === 'loading') {
    return (
      <Shell>
        <div className="gv-rise pt-36 text-center">
          <Flourish className="mx-auto" />
          <p className="gv-display mt-5 text-2xl italic text-(--ink-soft)">
            Finding your seat…
          </p>
        </div>
      </Shell>
    )
  }

  if (!view) {
    return (
      <Shell>
        <div className="gv-rise mx-auto mt-28 max-w-sm px-6 text-center">
          <Flourish className="mx-auto" />
          <p className="gv-display mt-5 text-3xl italic">This link isn&apos;t quite right</p>
          <p className="mt-3 text-[15px] leading-relaxed text-(--ink-soft)">
            The QR code couldn&apos;t be read. Please see the greeter at the entrance —
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
      use3d={webgl && pref3d}
      webgl={webgl}
      setPref3d={setPref3d}
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
  webgl,
  setPref3d,
  tab,
  setTab,
}: {
  guest: GuestView['guest']
  event: GuestView['event']
  venue: GuestView['venue']
  tables: GuestView['tables']
  table: GuestView['table']
  use3d: boolean
  webgl: boolean
  setPref3d: (v: boolean) => void
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
      <header className="px-6 pt-10 text-center">
        <p className="gv-caps gv-rise text-[11px] text-(--gold)">
          The wedding celebration of
        </p>
        <h1
          className="gv-display gv-rise mt-2 text-4xl italic sm:text-5xl"
          style={{ animationDelay: '.08s' }}
        >
          {event.couple_names}
        </h1>
        <Flourish className="gv-rise mx-auto mt-4" delay=".16s" />
        <p
          className="gv-rise mt-4 text-[15px] text-(--ink-soft)"
          style={{ animationDelay: '.24s' }}
        >
          Welcome, <span className="font-semibold text-(--ink)">{guest.name}</span>
        </p>
        {table ? (
          <div className="gv-rise" style={{ animationDelay: '.32s' }}>
            <p className="gv-caps mt-5 text-[11px] text-(--ink-faint)">Your table</p>
            <p className="gv-tablenum leading-none">{table.label}</p>
            <p className="mt-2 text-[15px] text-(--ink-soft)">
              {describeTablePosition(table, venue)}
            </p>
            {guest.party_size > 1 && (
              <p className="mt-1 text-sm text-(--ink-faint)">
                {guest.party_size} seats reserved for your party
              </p>
            )}
          </div>
        ) : (
          <p
            className="gv-display gv-rise mt-8 text-2xl italic"
            style={{ animationDelay: '.32s' }}
          >
            Please see the greeter for your table
          </p>
        )}
      </header>

      <nav
        className="gv-rise mx-auto mt-8 flex max-w-md items-end justify-center gap-9 border-b border-(--line) px-6"
        style={{ animationDelay: '.42s' }}
      >
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
            className={`gv-caps relative pb-3 text-[11px] transition-colors ${
              tab === t ? 'text-(--ink)' : 'text-(--ink-faint)'
            }`}
          >
            {label}
            <span
              className={`absolute inset-x-0 -bottom-px mx-auto h-[2px] w-9 rounded-full bg-(--gold) transition-opacity duration-300 ${
                tab === t ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </button>
        ))}
      </nav>

      {tab === 'map' && (
        <section className="gv-rise mx-auto mt-6 w-full max-w-3xl px-3" style={{ animationDelay: '.5s' }}>
          <div className="overflow-hidden rounded-3xl border border-(--line) bg-[#14100a] shadow-[0_24px_60px_-24px_rgba(90,66,20,.45)]">
            <div className="flex items-center justify-between border-b border-(--line) bg-(--card) px-4 py-2.5">
              <p className="gv-caps text-[10px] text-(--ink-soft)">Ballroom map</p>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-[11px] text-(--ink-faint)">
                  <span className="h-2 w-2 rounded-full bg-[#f6c14d] shadow-[0_0_6px_#f6c14d]" />
                  Your table
                </span>
                {webgl && (
                  <div className="flex overflow-hidden rounded-full border border-(--line) text-[11px] font-semibold">
                    <button
                      onClick={() => setPref3d(true)}
                      className={`px-3 py-1 transition-colors ${
                        use3d
                          ? 'bg-(--gold) text-(--card)'
                          : 'text-(--ink-faint)'
                      }`}
                    >
                      3D
                    </button>
                    <button
                      onClick={() => setPref3d(false)}
                      className={`px-3 py-1 transition-colors ${
                        !use3d
                          ? 'bg-(--gold) text-(--card)'
                          : 'text-(--ink-faint)'
                      }`}
                    >
                      2D
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="h-[58vh] min-h-[380px]">
              {use3d ? (
                <MapErrorBoundary fallback={<Hall2D {...hallProps} />}>
                  <GuestHall3D {...sceneProps} />
                </MapErrorBoundary>
              ) : (
                <Hall2D {...hallProps} />
              )}
            </div>
          </div>
          {route && (
            <p className="mt-3 text-center text-[13px] text-(--ink-faint)">
              The glowing dots trace your walk from the entrance to your table.
            </p>
          )}
        </section>
      )}

      {tab === 'menu' && (
        <section className="mx-auto mt-8 w-full max-w-md px-6 pb-12">
          <p className="gv-caps gv-rise text-center text-[11px] text-(--gold)">
            This evening&apos;s menu
          </p>
          <ol className="mt-7 space-y-8">
            {(event.menu ?? []).map((m, i) => (
              <li key={m.id} className="gv-rise text-center" style={{ animationDelay: `${0.08 + i * 0.06}s` }}>
                <p className="gv-display text-base text-(--gold)">
                  {ROMAN[i] ?? i + 1}
                </p>
                <p className="gv-display mt-1 text-[22px] font-semibold leading-snug">{m.name}</p>
                {m.description && (
                  <p className="mt-1 text-sm leading-relaxed text-(--ink-soft)">
                    {m.description}
                  </p>
                )}
                {m.photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.photo}
                    alt={m.name}
                    loading="lazy"
                    className="mt-3 aspect-video w-full rounded-2xl border border-(--line) object-cover shadow-[0_14px_30px_-18px_rgba(90,66,20,.4)]"
                  />
                )}
              </li>
            ))}
          </ol>
          <Flourish className="mx-auto mt-10" />
          <p className="gv-caps mt-3 text-center text-[10px] text-(--ink-faint)">
            {(event.menu ?? []).length} courses · served in this order
          </p>
        </section>
      )}

      {tab === 'photos' && (
        <PhotoTab eventId={event.id} guestId={guest.id} photoMode={event.photo_mode} />
      )}
    </Shell>
  )
}

function Flourish({ className, delay }: { className?: string; delay?: string }) {
  return (
    <svg
      width="132"
      height="10"
      viewBox="0 0 132 10"
      className={className}
      style={delay ? { animationDelay: delay } : undefined}
      aria-hidden
    >
      <line x1="0" y1="5" x2="54" y2="5" stroke="var(--gold-soft)" strokeWidth="1" />
      <rect
        x="62"
        y="1"
        width="8"
        height="8"
        transform="rotate(45 66 5)"
        fill="none"
        stroke="var(--gold)"
        strokeWidth="1"
      />
      <line x1="78" y1="5" x2="132" y2="5" stroke="var(--gold-soft)" strokeWidth="1" />
    </svg>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="gv-shell pb-12">{children}</div>
}
